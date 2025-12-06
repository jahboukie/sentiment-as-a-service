//! API route handlers for RG-Check Compliance Engine
//!
//! Includes SecuraMem audit endpoints for RG-Check accreditation.

pub mod anonymize;
pub mod audit;
pub mod crisis;
pub mod emotions;
pub mod health;
pub mod metrics;
pub mod policy_intervene;
pub mod risk_score;
pub mod sentiment;

pub use health::health_check;
pub use sentiment::analyze;
pub use anonymize::anonymize;
pub use audit::{audit_stats, verify_chain, export_evidence, get_public_key};
pub use crisis::detect_crisis;
pub use emotions::analyze_emotions;
pub use metrics::get_metrics;
pub use risk_score::risk_score;
pub use policy_intervene::policy_intervene;
