//! Core services for RG-Check Compliance Engine
//!
//! Integrates SecuraMem cryptographic infrastructure for court-admissible
//! evidence and immutable audit trails.

mod anonymizer;
mod audit_logger;
mod audit_orchestrator;
mod cache;
mod claude;
mod crisis;
mod crypto;
mod evidence_store;
mod local_sentiment;
mod policy_engine;
mod state;

pub use anonymizer::Anonymizer;
pub use audit_logger::{AuditLogger, AuditLogEntry, AuditEventType};
pub use audit_orchestrator::{AuditOrchestrator, EvidenceReceipt, AuditStats};
pub use cache::{CacheService, CachedAnalysis, CacheStats};
pub use claude::ClaudeClient;
pub use crisis::CrisisDetector;
pub use crypto::{OperatorSigningKey, sha256_hex, compute_hash_chain_link, verify_signature};
pub use evidence_store::{EvidenceStore, ChainVerification, AuditEntry};
pub use local_sentiment::LocalSentimentAnalyzer;
pub use policy_engine::{
    PolicyEngine, RiskFusionInput, PolicyEnforcementEvent, RgRiskLevel, 
    PolicyActionTrigger, OperatorRgResource, ResourceType, BehavioralData, SessionContext
};
pub use state::AppState;
