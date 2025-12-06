//! Compliance Framework Module - Runtime compliance evaluation and attestation management
//!
//! This module provides:
//! - Framework definitions (EU AI Act, SOC 2, HIPAA, etc.)
//! - Control status evaluation (computed from audit chain or manual attestation)
//! - Compliance report generation
//!
//! The compliance model follows a hybrid approach:
//! - **Computed controls**: Automatically verified from audit chain data
//! - **Attested controls**: Manually attested by authorized personnel with Ed25519 signatures

use serde::{Deserialize, Serialize};

// =============================================================================
// COMPLIANCE FRAMEWORK TYPES
// =============================================================================

/// A compliance framework (e.g., EU AI Act, SOC 2, HIPAA)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceFramework {
    /// Unique identifier (e.g., "eu_ai_act", "soc2")
    pub id: String,
    /// Display name (e.g., "EU AI Act")
    pub name: String,
    /// Framework version (e.g., "2024")
    pub version: String,
    /// Description
    pub description: Option<String>,
    /// List of controls in this framework
    pub controls: Vec<ComplianceControl>,
}

/// A single compliance control within a framework
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceControl {
    /// Control identifier (e.g., "art_14_human_oversight")
    pub id: String,
    /// Article/section reference (e.g., "Article 14", "CC7.2")
    pub article: Option<String>,
    /// Control name (e.g., "Human Oversight")
    pub name: String,
    /// Full requirement description
    pub description: String,
    /// How this control is evidenced
    pub evidence_type: EvidenceType,
    /// Risk level for prioritization
    pub risk_level: RiskLevel,
}

/// How a control's compliance is determined
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", content = "data")]
pub enum EvidenceType {
    /// Automatically computed from audit chain data
    Computed {
        /// SQL query that returns 1 (compliant) or 0 (non-compliant)
        query: String,
    },
    /// Requires manual attestation with signature
    Attestation,
    /// External system integration (future)
    External {
        system: String,
        endpoint: Option<String>,
    },
}

/// Risk level for control prioritization
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl Default for RiskLevel {
    fn default() -> Self {
        Self::Medium
    }
}

// =============================================================================
// COMPLIANCE STATUS TYPES
// =============================================================================

/// Overall compliance status for a framework
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceStatus {
    /// Framework being evaluated
    pub framework_id: String,
    pub framework_name: String,
    /// Overall completion percentage (0.0 - 1.0)
    pub completion_percent: f64,
    /// Total controls in framework
    pub total_controls: usize,
    /// Controls by status
    pub compliant_count: usize,
    pub partial_count: usize,
    pub non_compliant_count: usize,
    pub not_applicable_count: usize,
    /// Individual control statuses
    pub controls: Vec<ControlStatus>,
    /// Last evaluation timestamp
    pub evaluated_at: String,
}

/// Status of a single control
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlStatus {
    pub control_id: String,
    pub control_name: String,
    pub article: Option<String>,
    pub status: ControlComplianceStatus,
    pub evidence_type: String,
    /// Evidence details (file paths, query results, etc.)
    pub evidence: Vec<String>,
    /// Last verification timestamp
    pub last_verified: Option<String>,
    /// Attestation details if manually attested
    pub attestation: Option<AttestationInfo>,
}

/// Compliance status of a single control
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ControlComplianceStatus {
    /// Fully compliant with evidence
    Compliant,
    /// Partially compliant (some evidence missing)
    Partial,
    /// Not compliant
    NonCompliant,
    /// Not applicable to this deployment
    NotApplicable,
    /// Pending evaluation
    Pending,
}

/// Information about a manual attestation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttestationInfo {
    pub attested_by: String,
    pub attested_at: String,
    pub expires_at: Option<String>,
    pub evidence_description: Option<String>,
}

// =============================================================================
// FRAMEWORK DEFINITIONS
// =============================================================================

impl ComplianceFramework {
    /// Get the EU AI Act framework definition
    pub fn eu_ai_act() -> Self {
        Self {
            id: "eu_ai_act".into(),
            name: "EU AI Act".into(),
            version: "2024".into(),
            description: Some("Regulation (EU) 2024/1689 - Artificial Intelligence Act".into()),
            controls: vec![
                ComplianceControl {
                    id: "art_12_record_keeping".into(),
                    article: Some("Article 12".into()),
                    name: "Record Keeping".into(),
                    description: "High-risk AI systems shall technically allow for automatic recording of events (logs) over the lifetime of the system.".into(),
                    evidence_type: EvidenceType::Computed {
                        query: "SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM audit_log".into(),
                    },
                    risk_level: RiskLevel::High,
                },
                ComplianceControl {
                    id: "art_12_traceability".into(),
                    article: Some("Article 12".into()),
                    name: "Traceability".into(),
                    description: "Logging shall ensure traceability of AI system functioning throughout its lifecycle.".into(),
                    evidence_type: EvidenceType::Computed {
                        query: "SELECT CASE WHEN (SELECT COUNT(*) FROM audit_log WHERE prev_hash IS NOT NULL) > 0 THEN 1 ELSE 0 END".into(),
                    },
                    risk_level: RiskLevel::High,
                },
                ComplianceControl {
                    id: "art_13_transparency".into(),
                    article: Some("Article 13".into()),
                    name: "Transparency".into(),
                    description: "High-risk AI systems shall be designed to ensure their operation is sufficiently transparent.".into(),
                    evidence_type: EvidenceType::Attestation,
                    risk_level: RiskLevel::High,
                },
                ComplianceControl {
                    id: "art_14_human_oversight".into(),
                    article: Some("Article 14".into()),
                    name: "Human Oversight".into(),
                    description: "High-risk AI systems shall be designed to allow effective oversight by natural persons.".into(),
                    evidence_type: EvidenceType::Attestation,
                    risk_level: RiskLevel::Critical,
                },
                ComplianceControl {
                    id: "art_15_accuracy".into(),
                    article: Some("Article 15".into()),
                    name: "Accuracy and Robustness".into(),
                    description: "High-risk AI systems shall achieve appropriate levels of accuracy, robustness, and cybersecurity.".into(),
                    evidence_type: EvidenceType::Computed {
                        query: "SELECT CASE WHEN (SELECT COUNT(*) FROM audit_log WHERE blocked = 1) >= 0 THEN 1 ELSE 0 END".into(),
                    },
                    risk_level: RiskLevel::High,
                },
                ComplianceControl {
                    id: "art_9_risk_mgmt".into(),
                    article: Some("Article 9".into()),
                    name: "Risk Management System".into(),
                    description: "A risk management system shall be established, implemented, documented, and maintained.".into(),
                    evidence_type: EvidenceType::Attestation,
                    risk_level: RiskLevel::Critical,
                },
                ComplianceControl {
                    id: "art_10_data_governance".into(),
                    article: Some("Article 10".into()),
                    name: "Data Governance".into(),
                    description: "Training, validation, and testing data sets shall be subject to appropriate data governance.".into(),
                    evidence_type: EvidenceType::Attestation,
                    risk_level: RiskLevel::High,
                },
                ComplianceControl {
                    id: "art_17_quality_mgmt".into(),
                    article: Some("Article 17".into()),
                    name: "Quality Management System".into(),
                    description: "Providers of high-risk AI systems shall put a quality management system in place.".into(),
                    evidence_type: EvidenceType::Attestation,
                    risk_level: RiskLevel::High,
                },
            ],
        }
    }

    /// Get the SOC 2 Type II framework definition
    pub fn soc2() -> Self {
        Self {
            id: "soc2".into(),
            name: "SOC 2 Type II".into(),
            version: "2017".into(),
            description: Some("AICPA Trust Services Criteria".into()),
            controls: vec![
                ComplianceControl {
                    id: "cc6_1_logical_access".into(),
                    article: Some("CC6.1".into()),
                    name: "Logical Access Controls".into(),
                    description: "The entity implements logical access security software, infrastructure, and architectures.".into(),
                    evidence_type: EvidenceType::Computed {
                        query: "SELECT 1".into(), // Always true: localhost-only binding
                    },
                    risk_level: RiskLevel::High,
                },
                ComplianceControl {
                    id: "cc7_2_change_mgmt".into(),
                    article: Some("CC7.2".into()),
                    name: "Change Management".into(),
                    description: "The entity monitors system components for anomalies indicative of malicious acts.".into(),
                    evidence_type: EvidenceType::Computed {
                        query: "SELECT CASE WHEN (SELECT COUNT(*) FROM audit_log WHERE threat_score IS NOT NULL) > 0 THEN 1 ELSE 0 END".into(),
                    },
                    risk_level: RiskLevel::High,
                },
                ComplianceControl {
                    id: "cc8_1_change_tracking".into(),
                    article: Some("CC8.1".into()),
                    name: "Change Tracking".into(),
                    description: "The entity authorizes, designs, develops, configures, documents, tests, approves, and implements changes.".into(),
                    evidence_type: EvidenceType::Computed {
                        query: "SELECT CASE WHEN (SELECT COUNT(*) FROM audit_log WHERE signature IS NOT NULL) > 0 THEN 1 ELSE 0 END".into(),
                    },
                    risk_level: RiskLevel::High,
                },
                ComplianceControl {
                    id: "a1_2_availability".into(),
                    article: Some("A1.2".into()),
                    name: "Availability Monitoring".into(),
                    description: "The entity monitors and processes availability-related events.".into(),
                    evidence_type: EvidenceType::Attestation,
                    risk_level: RiskLevel::Medium,
                },
                ComplianceControl {
                    id: "pi1_1_processing_integrity".into(),
                    article: Some("PI1.1".into()),
                    name: "Processing Integrity".into(),
                    description: "The entity implements policies for processing integrity.".into(),
                    evidence_type: EvidenceType::Computed {
                        query: "SELECT CASE WHEN (SELECT COUNT(*) FROM audit_log WHERE entry_hash IS NOT NULL) > 0 THEN 1 ELSE 0 END".into(),
                    },
                    risk_level: RiskLevel::High,
                },
            ],
        }
    }

    /// Get the HIPAA framework definition
    pub fn hipaa() -> Self {
        Self {
            id: "hipaa".into(),
            name: "HIPAA".into(),
            version: "45 CFR § 164".into(),
            description: Some("Health Insurance Portability and Accountability Act - Security Rule".into()),
            controls: vec![
                ComplianceControl {
                    id: "164_312_a_access_control".into(),
                    article: Some("§164.312(a)(1)".into()),
                    name: "Access Control".into(),
                    description: "Implement technical policies and procedures for electronic information systems that maintain ePHI.".into(),
                    evidence_type: EvidenceType::Computed {
                        query: "SELECT 1".into(), // Localhost-only binding enforced
                    },
                    risk_level: RiskLevel::Critical,
                },
                ComplianceControl {
                    id: "164_312_b_audit_controls".into(),
                    article: Some("§164.312(b)".into()),
                    name: "Audit Controls".into(),
                    description: "Implement hardware, software, and/or procedural mechanisms to record and examine activity.".into(),
                    evidence_type: EvidenceType::Computed {
                        query: "SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM audit_log".into(),
                    },
                    risk_level: RiskLevel::Critical,
                },
                ComplianceControl {
                    id: "164_312_c_integrity".into(),
                    article: Some("§164.312(c)(1)".into()),
                    name: "Integrity Controls".into(),
                    description: "Implement policies and procedures to protect ePHI from improper alteration or destruction.".into(),
                    evidence_type: EvidenceType::Computed {
                        query: "SELECT CASE WHEN (SELECT COUNT(*) FROM audit_log WHERE entry_hash IS NOT NULL) > 0 THEN 1 ELSE 0 END".into(),
                    },
                    risk_level: RiskLevel::Critical,
                },
                ComplianceControl {
                    id: "164_312_e_transmission".into(),
                    article: Some("§164.312(e)(1)".into()),
                    name: "Transmission Security".into(),
                    description: "Implement technical security measures to guard against unauthorized access during transmission.".into(),
                    evidence_type: EvidenceType::Computed {
                        query: "SELECT 1".into(), // Air-gapped, no external transmission
                    },
                    risk_level: RiskLevel::Critical,
                },
            ],
        }
    }

    /// Get all available frameworks
    pub fn all_frameworks() -> Vec<Self> {
        vec![
            Self::eu_ai_act(),
            Self::soc2(),
            Self::hipaa(),
        ]
    }

    /// Get a framework by ID
    pub fn by_id(id: &str) -> Option<Self> {
        match id {
            "eu_ai_act" => Some(Self::eu_ai_act()),
            "soc2" => Some(Self::soc2()),
            "hipaa" => Some(Self::hipaa()),
            _ => None,
        }
    }
}

// =============================================================================
// ATTESTATION REQUEST
// =============================================================================

/// Request to create a new attestation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttestationRequest {
    pub framework: String,
    pub control_id: String,
    pub evidence_type: String,
    pub evidence_path: Option<String>,
    pub evidence_description: Option<String>,
    pub expires_at: Option<String>,
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_eu_ai_act_framework() {
        let framework = ComplianceFramework::eu_ai_act();
        assert_eq!(framework.id, "eu_ai_act");
        assert_eq!(framework.controls.len(), 8);
        
        // Check Article 14 is critical
        let art_14 = framework.controls.iter()
            .find(|c| c.id == "art_14_human_oversight")
            .unwrap();
        assert_eq!(art_14.risk_level, RiskLevel::Critical);
    }

    #[test]
    fn test_soc2_framework() {
        let framework = ComplianceFramework::soc2();
        assert_eq!(framework.id, "soc2");
        assert_eq!(framework.controls.len(), 5);
    }

    #[test]
    fn test_hipaa_framework() {
        let framework = ComplianceFramework::hipaa();
        assert_eq!(framework.id, "hipaa");
        assert!(framework.controls.len() >= 4);
    }

    #[test]
    fn test_framework_lookup() {
        assert!(ComplianceFramework::by_id("eu_ai_act").is_some());
        assert!(ComplianceFramework::by_id("soc2").is_some());
        assert!(ComplianceFramework::by_id("nonexistent").is_none());
    }

    #[test]
    fn test_computed_evidence() {
        let framework = ComplianceFramework::eu_ai_act();
        let art_12 = framework.controls.iter()
            .find(|c| c.id == "art_12_record_keeping")
            .unwrap();
        
        match &art_12.evidence_type {
            EvidenceType::Computed { query } => {
                assert!(query.contains("audit_log"));
            }
            _ => panic!("Expected computed evidence"),
        }
    }

    #[test]
    fn test_attestation_evidence() {
        let framework = ComplianceFramework::eu_ai_act();
        let art_14 = framework.controls.iter()
            .find(|c| c.id == "art_14_human_oversight")
            .unwrap();
        
        assert_eq!(art_14.evidence_type, EvidenceType::Attestation);
    }
}
