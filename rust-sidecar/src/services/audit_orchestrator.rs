//! Audit Orchestrator - Ties Crypto + Storage for RG-Check Evidence
//! 
//! Ported from SecuraMem L1 layer. This is the "evidence root of trust"
//! that GPT-5 described - every policy decision flows through here.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::crypto::OperatorSigningKey;
use super::evidence_store::EvidenceStore;
use super::policy_engine::{PolicyEnforcementEvent, RgRiskLevel, PolicyActionTrigger};

/// Audit orchestrator - the evidence root of trust
/// 
/// All analytics flow through here to be signed and logged.
/// This satisfies RG-Check requirements for:
/// - Documented risk detection
/// - Consistent policy enforcement
/// - Immutable audit trail
pub struct AuditOrchestrator {
    store: EvidenceStore,
    signer: OperatorSigningKey,
}

impl AuditOrchestrator {
    /// Create a new audit orchestrator
    pub fn new(store: EvidenceStore, signer: OperatorSigningKey) -> Self {
        Self { store, signer }
    }
    
    /// Log a policy enforcement event
    /// 
    /// This is called after every risk assessment. It:
    /// 1. Creates a unique receipt ID
    /// 2. Signs the policy decision with the operator's key
    /// 3. Appends to the immutable hash chain
    pub async fn log_policy_event(
        &self,
        event: &PolicyEnforcementEvent,
        player_id_hash: Option<&str>,
        redacted_input: &str,
    ) -> Result<EvidenceReceipt> {
        let receipt_id = Uuid::new_v4().to_string();
        let timestamp = chrono::Utc::now().to_rfc3339();
        
        // Build the audit data
        let audit_data = serde_json::json!({
            "event_id": event.event_id,
            "timestamp": timestamp,
            "player_id_hash": player_id_hash,
            "input_redacted": redacted_input,
            "risk_score": event.risk_score,
            "risk_level": format!("{:?}", event.rg_risk_level),
            "policy_action": format!("{:?}", event.policy_action_trigger),
            "secondary_actions": event.secondary_actions.iter()
                .map(|a| format!("{:?}", a))
                .collect::<Vec<_>>(),
            "reasoning": event.reasoning,
            "processing_time_ms": event.processing_time_ms,
        });
        
        // Sign the data
        let data_str = audit_data.to_string();
        let signature = self.signer.sign(data_str.as_bytes());
        
        // Determine operation type based on risk level
        let operation = match event.rg_risk_level {
            RgRiskLevel::Critical => "CRISIS_DETECTION",
            RgRiskLevel::HighFinancialHarm => "HIGH_RISK_ASSESSMENT",
            _ => "RISK_ASSESSMENT",
        };
        
        // Append to hash chain
        let entry_hash = self.store.append(
            &receipt_id,
            "RG_CHECK_ENGINE",
            operation,
            audit_data.clone(),
            &signature,
            self.signer.key_id(),
        ).await?;
        
        Ok(EvidenceReceipt {
            receipt_id,
            timestamp,
            entry_hash,
            signature,
            key_id: self.signer.key_id().to_string(),
            operation: operation.to_string(),
        })
    }
    
    /// Log a marketing suppression event
    pub async fn log_marketing_suppression(
        &self,
        player_id_hash: &str,
        reason: &str,
        duration_days: u32,
        triggering_event_id: &str,
    ) -> Result<EvidenceReceipt> {
        let receipt_id = Uuid::new_v4().to_string();
        let timestamp = chrono::Utc::now().to_rfc3339();
        
        let audit_data = serde_json::json!({
            "event_type": "MARKETING_SUPPRESSION",
            "timestamp": timestamp,
            "player_id_hash": player_id_hash,
            "reason": reason,
            "duration_days": duration_days,
            "triggering_event_id": triggering_event_id,
            "expires_at": chrono::Utc::now()
                .checked_add_signed(chrono::Duration::days(duration_days as i64))
                .map(|d| d.to_rfc3339()),
        });
        
        let data_str = audit_data.to_string();
        let signature = self.signer.sign(data_str.as_bytes());
        
        let entry_hash = self.store.append(
            &receipt_id,
            "RG_CHECK_ENGINE",
            "MARKETING_SUPPRESSION",
            audit_data,
            &signature,
            self.signer.key_id(),
        ).await?;
        
        Ok(EvidenceReceipt {
            receipt_id,
            timestamp,
            entry_hash,
            signature,
            key_id: self.signer.key_id().to_string(),
            operation: "MARKETING_SUPPRESSION".to_string(),
        })
    }
    
    /// Log a player intervention event
    pub async fn log_intervention(
        &self,
        player_id_hash: &str,
        intervention_type: &str,
        message_shown: &str,
        player_response: Option<&str>,
        triggering_event_id: &str,
    ) -> Result<EvidenceReceipt> {
        let receipt_id = Uuid::new_v4().to_string();
        let timestamp = chrono::Utc::now().to_rfc3339();
        
        let audit_data = serde_json::json!({
            "event_type": "PLAYER_INTERVENTION",
            "timestamp": timestamp,
            "player_id_hash": player_id_hash,
            "intervention_type": intervention_type,
            "message_shown": message_shown,
            "player_response": player_response,
            "triggering_event_id": triggering_event_id,
        });
        
        let data_str = audit_data.to_string();
        let signature = self.signer.sign(data_str.as_bytes());
        
        let entry_hash = self.store.append(
            &receipt_id,
            "RG_CHECK_ENGINE",
            "PLAYER_INTERVENTION",
            audit_data,
            &signature,
            self.signer.key_id(),
        ).await?;
        
        Ok(EvidenceReceipt {
            receipt_id,
            timestamp,
            entry_hash,
            signature,
            key_id: self.signer.key_id().to_string(),
            operation: "PLAYER_INTERVENTION".to_string(),
        })
    }
    
    /// Log an escalation to human RG agent
    pub async fn log_escalation(
        &self,
        player_id_hash: &str,
        agent_id: Option<&str>,
        queue_name: &str,
        priority: &str,
        triggering_event_id: &str,
    ) -> Result<EvidenceReceipt> {
        let receipt_id = Uuid::new_v4().to_string();
        let timestamp = chrono::Utc::now().to_rfc3339();
        
        let audit_data = serde_json::json!({
            "event_type": "ESCALATION_TO_HUMAN",
            "timestamp": timestamp,
            "player_id_hash": player_id_hash,
            "agent_id": agent_id,
            "queue_name": queue_name,
            "priority": priority,
            "triggering_event_id": triggering_event_id,
        });
        
        let data_str = audit_data.to_string();
        let signature = self.signer.sign(data_str.as_bytes());
        
        let entry_hash = self.store.append(
            &receipt_id,
            "RG_CHECK_ENGINE",
            "ESCALATION_TO_HUMAN",
            audit_data,
            &signature,
            self.signer.key_id(),
        ).await?;
        
        Ok(EvidenceReceipt {
            receipt_id,
            timestamp,
            entry_hash,
            signature,
            key_id: self.signer.key_id().to_string(),
            operation: "ESCALATION_TO_HUMAN".to_string(),
        })
    }
    
    /// Verify the integrity of the audit chain
    pub async fn verify_integrity(&self) -> Result<super::evidence_store::ChainVerification> {
        self.store.verify_chain().await
    }
    
    /// Get audit statistics
    pub async fn get_stats(&self) -> Result<AuditStats> {
        let entry_count = self.store.count_entries().await?;
        let verification = self.store.verify_chain().await?;
        
        Ok(AuditStats {
            total_entries: entry_count,
            chain_valid: verification.is_valid,
            last_hash: verification.last_hash,
            key_id: self.signer.key_id().to_string(),
        })
    }
    
    /// Export audit log for RG-Check auditors
    pub async fn export_for_rgcheck(&self, start_date: Option<&str>, end_date: Option<&str>) -> Result<String> {
        self.store.export_for_audit(start_date, end_date).await
    }
    
    /// Get the operator's public key PEM (for auditors to verify signatures)
    pub fn get_public_key_pem(&self) -> Result<String> {
        self.signer.verifying_key_pem()
    }
}

/// Evidence receipt - proof that an event was logged
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceReceipt {
    /// Unique receipt ID (UUID)
    pub receipt_id: String,
    /// ISO 8601 timestamp (AGCO 3.12 compliant)
    pub timestamp: String,
    /// SHA-256 hash linking to chain
    pub entry_hash: String,
    /// Ed25519 signature (base64)
    pub signature: String,
    /// Signing key ID
    pub key_id: String,
    /// Operation type
    pub operation: String,
}

/// Audit statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditStats {
    pub total_entries: i64,
    pub chain_valid: bool,
    pub last_hash: String,
    pub key_id: String,
}
