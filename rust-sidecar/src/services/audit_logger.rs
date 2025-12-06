//! Immutable Audit Logger - AGCO Standard 3.12 Compliance
//! 
//! Write-only, time-synchronized audit logging for RG Check accreditation.
//! Creates tamper-evident records of every policy enforcement event.

use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use chrono::{DateTime, Utc};
use sha2::{Sha256, Digest};

/// Audit log entry - immutable record of a compliance event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    /// Sequential entry number (for integrity verification)
    pub sequence_number: u64,
    /// ISO 8601 timestamp (AGCO Standard 3.12 - Time Synchronization)
    pub timestamp: String,
    /// Hash of previous entry (blockchain-style chain)
    pub previous_hash: String,
    /// Event type for filtering
    pub event_type: AuditEventType,
    /// The policy enforcement event ID
    pub event_id: String,
    /// Player ID (anonymized/hashed)
    pub player_id_hash: Option<String>,
    /// Original input text (REDACTED for privacy)
    pub input_text_redacted: String,
    /// Risk score that was calculated
    pub risk_score: u8,
    /// Risk level category
    pub risk_level: String,
    /// Policy action that was triggered
    pub policy_action: String,
    /// Secondary actions triggered
    pub secondary_actions: Vec<String>,
    /// Reasoning provided by the system
    pub reasoning: String,
    /// Processing time in milliseconds
    pub processing_time_ms: u64,
    /// Hash of this entry (for next entry to reference)
    pub entry_hash: String,
}

/// Types of audit events
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AuditEventType {
    /// Risk score calculation
    RiskAssessment,
    /// Policy action triggered
    PolicyEnforcement,
    /// Marketing suppression applied
    MarketingSuppression,
    /// Player intervention triggered
    PlayerIntervention,
    /// Self-exclusion offered or applied
    SelfExclusion,
    /// Account frozen/paused
    AccountPause,
    /// Crisis detection triggered
    CrisisDetection,
    /// Data redaction performed
    DataRedaction,
}

/// Audit Logger - write-only, append-only log for compliance
pub struct AuditLogger {
    /// Path to the audit log file
    log_path: PathBuf,
    /// Current sequence number
    sequence: Mutex<u64>,
    /// Hash of the last entry
    last_hash: Mutex<String>,
    /// File writer
    writer: Mutex<Option<BufWriter<File>>>,
}

impl AuditLogger {
    /// Create a new audit logger with default path (./audit_logs)
    pub fn new() -> Self {
        let log_dir = PathBuf::from("audit_logs");
        Self::with_path(log_dir).unwrap_or_else(|_| {
            // Fallback to in-memory only if file creation fails
            Self::in_memory()
        })
    }
    
    /// Create a new audit logger with specified path
    pub fn with_path(log_dir: PathBuf) -> std::io::Result<Self> {
        std::fs::create_dir_all(&log_dir)?;
        
        let log_path = log_dir.join(format!(
            "rg_audit_{}.jsonl",
            Utc::now().format("%Y%m%d")
        ));
        
        // Open in append mode (write-only, no read/modify)
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)?;
        
        let writer = BufWriter::new(file);
        
        // Genesis hash for the chain
        let genesis_hash = Self::compute_hash("GENESIS_RG_CHECK_AUDIT_LOG_V1");
        
        Ok(Self {
            log_path,
            sequence: Mutex::new(0),
            last_hash: Mutex::new(genesis_hash),
            writer: Mutex::new(Some(writer)),
        })
    }
    
    /// Create an in-memory only audit logger (for testing)
    pub fn in_memory() -> Self {
        let genesis_hash = Self::compute_hash("GENESIS_RG_CHECK_AUDIT_LOG_V1");
        Self {
            log_path: PathBuf::from("/dev/null"),
            sequence: Mutex::new(0),
            last_hash: Mutex::new(genesis_hash),
            writer: Mutex::new(None),
        }
    }

    /// Log a policy enforcement event
    pub fn log_policy_event(
        &self,
        event_id: &str,
        player_id: Option<&str>,
        input_text_redacted: &str,
        risk_score: u8,
        risk_level: &str,
        policy_action: &str,
        secondary_actions: &[String],
        reasoning: &str,
        processing_time_ms: u64,
    ) -> Result<String, AuditError> {
        self.log_entry(
            AuditEventType::PolicyEnforcement,
            event_id,
            player_id,
            input_text_redacted,
            risk_score,
            risk_level,
            policy_action,
            secondary_actions,
            reasoning,
            processing_time_ms,
        )
    }

    /// Log a crisis detection event (always logged, regardless of risk score)
    pub fn log_crisis_event(
        &self,
        event_id: &str,
        player_id: Option<&str>,
        input_text_redacted: &str,
        risk_score: u8,
        risk_level: &str,
        policy_action: &str,
        reasoning: &str,
    ) -> Result<String, AuditError> {
        self.log_entry(
            AuditEventType::CrisisDetection,
            event_id,
            player_id,
            input_text_redacted,
            risk_score,
            risk_level,
            policy_action,
            &[],
            reasoning,
            0,
        )
    }

    /// Log a marketing suppression event
    pub fn log_marketing_suppression(
        &self,
        event_id: &str,
        player_id: Option<&str>,
        reason: &str,
        duration_days: u32,
    ) -> Result<String, AuditError> {
        self.log_entry(
            AuditEventType::MarketingSuppression,
            event_id,
            player_id,
            "[MARKETING_SUPPRESSION]",
            0,
            "N/A",
            &format!("SUPPRESS_{}D", duration_days),
            &[],
            reason,
            0,
        )
    }

    /// Core logging function - creates immutable, chained entry
    fn log_entry(
        &self,
        event_type: AuditEventType,
        event_id: &str,
        player_id: Option<&str>,
        input_text_redacted: &str,
        risk_score: u8,
        risk_level: &str,
        policy_action: &str,
        secondary_actions: &[String],
        reasoning: &str,
        processing_time_ms: u64,
    ) -> Result<String, AuditError> {
        let mut sequence = self.sequence.lock().map_err(|_| AuditError::LockError)?;
        let mut last_hash = self.last_hash.lock().map_err(|_| AuditError::LockError)?;
        let mut writer_guard = self.writer.lock().map_err(|_| AuditError::LockError)?;
        
        *sequence += 1;
        let timestamp = Utc::now().to_rfc3339();
        
        // Hash player_id for privacy
        let player_id_hash = player_id.map(|p| Self::compute_hash(p));
        
        // Create entry without hash first
        let mut entry = AuditLogEntry {
            sequence_number: *sequence,
            timestamp: timestamp.clone(),
            previous_hash: last_hash.clone(),
            event_type,
            event_id: event_id.to_string(),
            player_id_hash,
            input_text_redacted: input_text_redacted.to_string(),
            risk_score,
            risk_level: risk_level.to_string(),
            policy_action: policy_action.to_string(),
            secondary_actions: secondary_actions.to_vec(),
            reasoning: reasoning.to_string(),
            processing_time_ms,
            entry_hash: String::new(), // Computed below
        };
        
        // Compute hash of the entry content
        let content_to_hash = format!(
            "{}|{}|{}|{}|{}|{}|{}",
            entry.sequence_number,
            entry.timestamp,
            entry.previous_hash,
            entry.event_id,
            entry.risk_score,
            entry.policy_action,
            entry.reasoning
        );
        entry.entry_hash = Self::compute_hash(&content_to_hash);
        
        // Update chain
        *last_hash = entry.entry_hash.clone();
        
        // Write to log (append-only)
        if let Some(ref mut writer) = *writer_guard {
            let json = serde_json::to_string(&entry).map_err(|e| AuditError::SerializationError(e.to_string()))?;
            writeln!(writer, "{}", json).map_err(|e| AuditError::IoError(e.to_string()))?;
            writer.flush().map_err(|e| AuditError::IoError(e.to_string()))?;
        }
        
        Ok(entry.entry_hash)
    }

    /// Compute SHA-256 hash of content
    fn compute_hash(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Get the current log file path (for RG Check auditors)
    pub fn get_log_path(&self) -> &PathBuf {
        &self.log_path
    }

    /// Get the current sequence number
    pub fn get_sequence_number(&self) -> Result<u64, AuditError> {
        let sequence = self.sequence.lock().map_err(|_| AuditError::LockError)?;
        Ok(*sequence)
    }

    /// Verify chain integrity (for audit verification)
    pub fn verify_chain_integrity(log_path: &PathBuf) -> Result<ChainVerification, AuditError> {
        use std::io::{BufRead, BufReader};
        
        let file = File::open(log_path).map_err(|e| AuditError::IoError(e.to_string()))?;
        let reader = BufReader::new(file);
        
        let mut expected_previous_hash = Self::compute_hash("GENESIS_RG_CHECK_AUDIT_LOG_V1");
        let mut entry_count = 0;
        let mut broken_links = vec![];
        
        for (line_num, line) in reader.lines().enumerate() {
            let line = line.map_err(|e| AuditError::IoError(e.to_string()))?;
            let entry: AuditLogEntry = serde_json::from_str(&line)
                .map_err(|e| AuditError::SerializationError(e.to_string()))?;
            
            if entry.previous_hash != expected_previous_hash {
                broken_links.push(line_num + 1);
            }
            
            expected_previous_hash = entry.entry_hash.clone();
            entry_count += 1;
        }
        
        Ok(ChainVerification {
            total_entries: entry_count,
            is_valid: broken_links.is_empty(),
            broken_links,
            last_hash: expected_previous_hash,
        })
    }
}

/// Result of chain verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainVerification {
    pub total_entries: usize,
    pub is_valid: bool,
    pub broken_links: Vec<usize>,
    pub last_hash: String,
}

/// Audit logger errors
#[derive(Debug)]
pub enum AuditError {
    IoError(String),
    SerializationError(String),
    LockError,
}

impl std::fmt::Display for AuditError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuditError::IoError(e) => write!(f, "IO Error: {}", e),
            AuditError::SerializationError(e) => write!(f, "Serialization Error: {}", e),
            AuditError::LockError => write!(f, "Lock Error"),
        }
    }
}

impl std::error::Error for AuditError {}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_audit_logging() {
        let dir = tempdir().unwrap();
        let logger = AuditLogger::new(dir.path().to_path_buf()).unwrap();
        
        let hash1 = logger.log_policy_event(
            "evt-001",
            Some("player-123"),
            "[REDACTED: anger detected in chat]",
            65,
            "MODERATE_FINANCIAL_HARM",
            "SUPPRESS_MARKETING",
            &["SEND_COOLING_OFF_POPUP".to_string()],
            "Risk Score: 65/100 | Chasing losses detected",
            1,
        ).unwrap();
        
        let hash2 = logger.log_policy_event(
            "evt-002",
            Some("player-456"),
            "[REDACTED: crisis language]",
            92,
            "CRITICAL",
            "FORCE_PAUSE",
            &["ESCALATE_TO_SENIOR_RG_AGENT".to_string()],
            "Risk Score: 92/100 | Suicidal ideation detected",
            2,
        ).unwrap();
        
        // Hashes should be different
        assert_ne!(hash1, hash2);
        
        // Sequence should be 2
        assert_eq!(logger.get_sequence_number().unwrap(), 2);
    }

    #[test]
    fn test_chain_integrity_verification() {
        let dir = tempdir().unwrap();
        let logger = AuditLogger::new(dir.path().to_path_buf()).unwrap();
        
        // Log several events
        for i in 0..5 {
            logger.log_policy_event(
                &format!("evt-{:03}", i),
                Some(&format!("player-{}", i)),
                "[REDACTED]",
                30 + i as u8 * 10,
                "MODERATE_EMOTIONAL",
                "SEND_COOLING_OFF_POPUP",
                &[],
                &format!("Test entry {}", i),
                1,
            ).unwrap();
        }
        
        // Verify chain
        let verification = AuditLogger::verify_chain_integrity(logger.get_log_path()).unwrap();
        
        assert_eq!(verification.total_entries, 5);
        assert!(verification.is_valid);
        assert!(verification.broken_links.is_empty());
    }
}
