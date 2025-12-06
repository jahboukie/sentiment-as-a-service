//! Application state shared across handlers
//!
//! Includes SecuraMem cryptographic infrastructure for court-admissible evidence.

use std::time::Instant;
use std::sync::Arc;
use tokio::sync::RwLock;
use anyhow::Result;

use crate::config::Config;
use super::{
    Anonymizer, ClaudeClient, LocalSentimentAnalyzer, CrisisDetector, 
    CacheService, AuditLogger, AuditOrchestrator, EvidenceStore, OperatorSigningKey
};

/// Shared application state for RG-Check Compliance Engine
pub struct AppState {
    pub config: Config,
    pub anonymizer: Anonymizer,
    pub claude_client: Option<ClaudeClient>,
    pub local_analyzer: LocalSentimentAnalyzer,
    pub crisis_detector: CrisisDetector,
    pub cache: CacheService,
    pub audit_logger: Option<AuditLogger>,
    /// SecuraMem audit orchestrator - cryptographically signed evidence
    pub audit_orchestrator: Option<Arc<AuditOrchestrator>>,
    pub start_time: Instant,
}

impl AppState {
    /// Create new app state (synchronous initialization)
    pub fn new(config: Config) -> Result<Self> {
        let claude_client = if let Some(ref api_key) = config.anthropic_api_key {
            if !api_key.is_empty() {
                Some(ClaudeClient::new(
                    api_key.clone(),
                    config.claude_model.clone(),
                )?)
            } else {
                None
            }
        } else {
            None
        };
        
        let cache = CacheService::new(
            config.cache_max_entries,
            config.cache_max_entries / 2,
        );
        
        // Legacy audit logger (will be replaced by orchestrator)
        let audit_logger = Some(AuditLogger::new());
        
        Ok(Self {
            config,
            anonymizer: Anonymizer::new(),
            claude_client,
            local_analyzer: LocalSentimentAnalyzer::new(),
            crisis_detector: CrisisDetector::new(),
            cache,
            audit_logger,
            audit_orchestrator: None, // Initialized async in init_evidence_system
            start_time: Instant::now(),
        })
    }
    
    /// Initialize the SecuraMem evidence system (async)
    /// 
    /// This sets up:
    /// - Ed25519 signing key (generated or loaded from file)
    /// - SQLite evidence store with hash chain
    /// - Audit orchestrator for signing policy decisions
    pub async fn init_evidence_system(&mut self) -> Result<()> {
        let data_dir = std::path::PathBuf::from(".rg-check");
        let db_path = data_dir.join("evidence.db");
        let key_path = data_dir.join("operator.key");
        
        // Initialize or load signing key
        let signer = if key_path.exists() {
            tracing::info!("Loading existing operator signing key...");
            OperatorSigningKey::load_from_file(&key_path)?
        } else {
            tracing::info!("Generating new operator signing key...");
            let key = OperatorSigningKey::generate();
            key.save_to_file(&key_path)?;
            key
        };
        
        tracing::info!("Operator Key ID: {}", signer.key_id());
        
        // Initialize evidence store
        let store = EvidenceStore::init(&db_path).await?;
        
        // Create orchestrator
        let orchestrator = AuditOrchestrator::new(store, signer);
        
        // Verify chain integrity on startup
        let verification = orchestrator.verify_integrity().await?;
        if verification.is_valid {
            tracing::info!(
                "✓ Evidence chain verified: {} entries, last hash: {:.16}...",
                verification.total_entries,
                verification.last_hash
            );
        } else {
            tracing::error!(
                "✗ Evidence chain BROKEN at {} locations!",
                verification.broken_links.len()
            );
        }
        
        self.audit_orchestrator = Some(Arc::new(orchestrator));
        
        Ok(())
    }
    
    pub fn uptime_seconds(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }
    
    pub fn has_claude(&self) -> bool {
        self.claude_client.is_some()
    }
    
    /// Check if cryptographic evidence system is enabled
    pub fn has_evidence_system(&self) -> bool {
        self.audit_orchestrator.is_some()
    }
}
