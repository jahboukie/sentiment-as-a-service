//! Policy Engine - RG Check Compliance Decision Maker
//! 
//! Replaces simple crisis detection with sophisticated rule-based
//! policy enforcement aligned with RG Check Standards.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Risk levels categorized by gambling harm type (AGCO aligned)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RgRiskLevel {
    /// No significant risk indicators
    Low,
    /// Elevated emotional state, monitor closely
    ModerateEmotional,
    /// Financial stress indicators (chasing losses, rent money mentions)
    ModerateFinancialHarm,
    /// Time-based harm (session length, late night play)
    ModerateTimeBased,
    /// High financial distress, immediate intervention needed
    HighFinancialHarm,
    /// Crisis language detected (self-harm, suicidal ideation)
    Critical,
}

/// Actionable policy triggers for operator systems
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PolicyActionTrigger {
    /// No action required, continue monitoring
    NoAction,
    /// Add to 30-day marketing suppression list
    SuppressMarketing,
    /// Display cooling-off popup in UI
    SendCoolingOffPopup,
    /// Offer voluntary self-exclusion options
    OfferSelfExclusion,
    /// Route to specialized RG agent (bypass regular queue)
    EscalateToRgAgent,
    /// Route to senior RG specialist (high priority)
    EscalateToSeniorRgAgent,
    /// Immediate account freeze pending human review
    ForcePause,
    /// Mandatory break enforced by system
    EnforceMandatoryBreak,
}

/// Policy Enforcement Event (PEE) - the core output of the engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyEnforcementEvent {
    /// Unique event ID for audit trail
    pub event_id: String,
    /// Player identifier (anonymized)
    pub player_id: Option<String>,
    /// Timestamp (ISO 8601, AGCO Standard 3.12)
    pub timestamp: String,
    /// Calculated risk level
    pub rg_risk_level: RgRiskLevel,
    /// Unified risk score (0-100)
    pub risk_score: u8,
    /// Primary action to take
    pub policy_action_trigger: PolicyActionTrigger,
    /// Secondary/follow-up actions
    pub secondary_actions: Vec<PolicyActionTrigger>,
    /// Human-readable reasoning for audit
    pub reasoning: String,
    /// Operator-specific RG resources to display
    pub operator_rg_resources: Vec<OperatorRgResource>,
    /// Whether this event requires audit logging
    pub requires_audit: bool,
    /// Processing time in milliseconds
    pub processing_time_ms: u64,
}

/// Operator-specific responsible gambling resources
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperatorRgResource {
    /// Resource name (e.g., "ConnexOntario")
    pub name: String,
    /// Resource URL or phone number
    pub contact: String,
    /// Type of resource
    pub resource_type: ResourceType,
    /// Province/jurisdiction (for multi-region operators)
    pub jurisdiction: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceType {
    Phone,
    Website,
    Chat,
    SelfExclusionPortal,
    CoolingOffTool,
}

/// Input for risk fusion - combines emotional and behavioral data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskFusionInput {
    /// Emotional indicators from sentiment analysis
    pub emotional_score: f32,
    /// Primary emotion detected
    pub primary_emotion: String,
    /// Crisis indicators detected
    pub crisis_indicators: Vec<String>,
    /// Behavioral data from operator (optional)
    pub behavioral_data: Option<BehavioralData>,
    /// Raw text for audit (will be redacted)
    pub raw_text: Option<String>,
    /// Player session context
    pub session_context: Option<SessionContext>,
}

/// Behavioral data from operator's transactional systems
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehavioralData {
    /// Deposit velocity (deposits in last hour)
    pub deposits_last_hour: Option<u32>,
    /// Total deposited in session
    pub session_deposit_total: Option<f64>,
    /// Loss chasing indicator (deposit immediately after loss)
    pub chasing_losses: Option<bool>,
    /// Session duration in minutes
    pub session_duration_minutes: Option<u32>,
    /// Time since last break
    pub minutes_since_break: Option<u32>,
    /// Bet size increase percentage
    pub bet_size_increase_pct: Option<f32>,
    /// Is late night session (00:00-06:00)
    pub is_late_night: Option<bool>,
}

/// Session context for risk assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionContext {
    /// Number of support contacts in last 30 days
    pub support_contacts_30d: Option<u32>,
    /// Previous self-exclusion history
    pub previous_self_exclusions: Option<u32>,
    /// Days since last self-exclusion ended
    pub days_since_exclusion_ended: Option<u32>,
    /// VIP/whale status
    pub is_vip: Option<bool>,
}

/// The Policy Engine - core decision maker
pub struct PolicyEngine {
    /// Ontario-specific RG resources
    ontario_resources: Vec<OperatorRgResource>,
}

impl PolicyEngine {
    pub fn new() -> Self {
        Self {
            ontario_resources: vec![
                OperatorRgResource {
                    name: "ConnexOntario".to_string(),
                    contact: "1-866-531-2600".to_string(),
                    resource_type: ResourceType::Phone,
                    jurisdiction: Some("Ontario".to_string()),
                },
                OperatorRgResource {
                    name: "ConnexOntario Chat".to_string(),
                    contact: "https://www.connexontario.ca".to_string(),
                    resource_type: ResourceType::Chat,
                    jurisdiction: Some("Ontario".to_string()),
                },
                OperatorRgResource {
                    name: "PlaySmart (OLG)".to_string(),
                    contact: "https://www.playsmart.ca".to_string(),
                    resource_type: ResourceType::Website,
                    jurisdiction: Some("Ontario".to_string()),
                },
                OperatorRgResource {
                    name: "iGO Self-Exclusion".to_string(),
                    contact: "https://igamingontario.ca/en/self-exclusion".to_string(),
                    resource_type: ResourceType::SelfExclusionPortal,
                    jurisdiction: Some("Ontario".to_string()),
                },
            ],
        }
    }

    /// Main policy decision function - fuses all inputs into a PolicyEnforcementEvent
    pub fn evaluate(&self, input: &RiskFusionInput) -> PolicyEnforcementEvent {
        let start = std::time::Instant::now();
        
        // Calculate unified risk score (0-100)
        let risk_score = self.calculate_risk_score(input);
        
        // Determine risk level category
        let rg_risk_level = self.categorize_risk(input, risk_score);
        
        // Determine primary action based on risk level
        let (primary_action, secondary_actions) = self.determine_actions(&rg_risk_level, input);
        
        // Generate reasoning for audit trail
        let reasoning = self.generate_reasoning(input, &rg_risk_level, risk_score);
        
        // Select appropriate resources
        let resources = self.select_resources(&rg_risk_level);
        
        let processing_time = start.elapsed().as_millis() as u64;
        
        PolicyEnforcementEvent {
            event_id: uuid::Uuid::new_v4().to_string(),
            player_id: None, // Set by caller
            timestamp: chrono::Utc::now().to_rfc3339(),
            rg_risk_level,
            risk_score,
            policy_action_trigger: primary_action,
            secondary_actions,
            reasoning,
            operator_rg_resources: resources,
            requires_audit: risk_score >= 40,
            processing_time_ms: processing_time,
        }
    }

    /// Calculate unified risk score (0-100) from all inputs
    fn calculate_risk_score(&self, input: &RiskFusionInput) -> u8 {
        let mut score: f32 = 0.0;
        
        // Emotional component (0-40 points)
        // Convert -1.0 to 1.0 sentiment to 0-40 risk
        let emotional_risk = ((1.0 - input.emotional_score) / 2.0) * 40.0;
        score += emotional_risk;
        
        // Crisis indicators (0-40 points)
        let crisis_weight = match input.crisis_indicators.len() {
            0 => 0.0,
            1 => 15.0,
            2 => 25.0,
            3 => 35.0,
            _ => 40.0,
        };
        score += crisis_weight;
        
        // Behavioral component (0-20 points)
        if let Some(ref behavioral) = input.behavioral_data {
            // Chasing losses is a strong indicator
            if behavioral.chasing_losses == Some(true) {
                score += 10.0;
            }
            
            // Multiple deposits in an hour
            if let Some(deposits) = behavioral.deposits_last_hour {
                if deposits >= 3 {
                    score += 5.0;
                }
            }
            
            // Late night + long session
            if behavioral.is_late_night == Some(true) {
                if let Some(duration) = behavioral.session_duration_minutes {
                    if duration > 120 {
                        score += 5.0;
                    }
                }
            }
        }
        
        // Session context modifiers
        if let Some(ref session) = input.session_context {
            // Recent self-exclusion history increases risk
            if let Some(days) = session.days_since_exclusion_ended {
                if days < 90 {
                    score += 10.0;
                }
            }
            
            // Frequent support contacts
            if let Some(contacts) = session.support_contacts_30d {
                if contacts >= 3 {
                    score += 5.0;
                }
            }
        }
        
        score.min(100.0).max(0.0) as u8
    }

    /// Categorize risk level based on score and indicators
    fn categorize_risk(&self, input: &RiskFusionInput, score: u8) -> RgRiskLevel {
        // Check for critical indicators first
        let critical_keywords = ["suicide", "kill myself", "end it all", "want to die", "self-harm"];
        for indicator in &input.crisis_indicators {
            let lower = indicator.to_lowercase();
            for keyword in &critical_keywords {
                if lower.contains(keyword) {
                    return RgRiskLevel::Critical;
                }
            }
        }
        
        // Check for financial harm indicators
        let financial_keywords = ["rent money", "mortgage", "savings", "ruined", "bankrupt", "loan"];
        let has_financial_distress = input.crisis_indicators.iter().any(|i| {
            let lower = i.to_lowercase();
            financial_keywords.iter().any(|k| lower.contains(k))
        });
        
        if has_financial_distress && score >= 60 {
            return RgRiskLevel::HighFinancialHarm;
        }
        
        // Score-based categorization
        match score {
            0..=25 => RgRiskLevel::Low,
            26..=45 => {
                if input.primary_emotion == "anger" || input.primary_emotion == "fear" {
                    RgRiskLevel::ModerateEmotional
                } else if has_financial_distress {
                    RgRiskLevel::ModerateFinancialHarm
                } else {
                    RgRiskLevel::ModerateEmotional
                }
            }
            46..=70 => {
                if has_financial_distress {
                    RgRiskLevel::ModerateFinancialHarm
                } else if let Some(ref b) = input.behavioral_data {
                    if b.session_duration_minutes.unwrap_or(0) > 180 {
                        RgRiskLevel::ModerateTimeBased
                    } else {
                        RgRiskLevel::ModerateEmotional
                    }
                } else {
                    RgRiskLevel::ModerateEmotional
                }
            }
            71..=100 => RgRiskLevel::HighFinancialHarm,
            _ => RgRiskLevel::Low,
        }
    }

    /// Determine actions based on risk level
    fn determine_actions(
        &self,
        risk_level: &RgRiskLevel,
        input: &RiskFusionInput,
    ) -> (PolicyActionTrigger, Vec<PolicyActionTrigger>) {
        match risk_level {
            RgRiskLevel::Low => (PolicyActionTrigger::NoAction, vec![]),
            
            RgRiskLevel::ModerateEmotional => (
                PolicyActionTrigger::SendCoolingOffPopup,
                vec![PolicyActionTrigger::SuppressMarketing],
            ),
            
            RgRiskLevel::ModerateFinancialHarm => (
                PolicyActionTrigger::SuppressMarketing,
                vec![
                    PolicyActionTrigger::SendCoolingOffPopup,
                    PolicyActionTrigger::OfferSelfExclusion,
                ],
            ),
            
            RgRiskLevel::ModerateTimeBased => (
                PolicyActionTrigger::EnforceMandatoryBreak,
                vec![PolicyActionTrigger::SendCoolingOffPopup],
            ),
            
            RgRiskLevel::HighFinancialHarm => (
                PolicyActionTrigger::EscalateToRgAgent,
                vec![
                    PolicyActionTrigger::SuppressMarketing,
                    PolicyActionTrigger::OfferSelfExclusion,
                ],
            ),
            
            RgRiskLevel::Critical => (
                PolicyActionTrigger::ForcePause,
                vec![
                    PolicyActionTrigger::EscalateToSeniorRgAgent,
                    PolicyActionTrigger::SuppressMarketing,
                ],
            ),
        }
    }

    /// Generate human-readable reasoning for audit trail
    fn generate_reasoning(&self, input: &RiskFusionInput, level: &RgRiskLevel, score: u8) -> String {
        let mut reasons = vec![];
        
        reasons.push(format!("Risk Score: {}/100", score));
        reasons.push(format!("Primary Emotion: {}", input.primary_emotion));
        
        if !input.crisis_indicators.is_empty() {
            reasons.push(format!("Crisis Indicators: {}", input.crisis_indicators.join(", ")));
        }
        
        if let Some(ref behavioral) = input.behavioral_data {
            if behavioral.chasing_losses == Some(true) {
                reasons.push("Behavioral: Chasing losses detected".to_string());
            }
            if let Some(deposits) = behavioral.deposits_last_hour {
                if deposits >= 2 {
                    reasons.push(format!("Behavioral: {} deposits in last hour", deposits));
                }
            }
        }
        
        reasons.push(format!("Risk Level: {:?}", level));
        
        reasons.join(" | ")
    }

    /// Select appropriate resources based on risk level
    fn select_resources(&self, level: &RgRiskLevel) -> Vec<OperatorRgResource> {
        match level {
            RgRiskLevel::Low => vec![],
            RgRiskLevel::ModerateEmotional | RgRiskLevel::ModerateTimeBased => {
                // Just the cooling-off tools
                self.ontario_resources
                    .iter()
                    .filter(|r| matches!(r.resource_type, ResourceType::CoolingOffTool | ResourceType::Website))
                    .cloned()
                    .collect()
            }
            RgRiskLevel::ModerateFinancialHarm | RgRiskLevel::HighFinancialHarm => {
                // All resources except chat
                self.ontario_resources
                    .iter()
                    .filter(|r| !matches!(r.resource_type, ResourceType::Chat))
                    .cloned()
                    .collect()
            }
            RgRiskLevel::Critical => {
                // All resources
                self.ontario_resources.clone()
            }
        }
    }
}

impl Default for PolicyEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_low_risk_score() {
        let engine = PolicyEngine::new();
        let input = RiskFusionInput {
            emotional_score: 0.5, // Positive sentiment
            primary_emotion: "joy".to_string(),
            crisis_indicators: vec![],
            behavioral_data: None,
            raw_text: None,
            session_context: None,
        };
        
        let result = engine.evaluate(&input);
        assert!(result.risk_score < 30);
        assert_eq!(result.policy_action_trigger, PolicyActionTrigger::NoAction);
    }

    #[test]
    fn test_chasing_losses_increases_risk() {
        let engine = PolicyEngine::new();
        let input = RiskFusionInput {
            emotional_score: -0.5, // Negative sentiment
            primary_emotion: "anger".to_string(),
            crisis_indicators: vec!["financial_distress".to_string()],
            behavioral_data: Some(BehavioralData {
                deposits_last_hour: Some(3),
                session_deposit_total: Some(500.0),
                chasing_losses: Some(true),
                session_duration_minutes: Some(45),
                minutes_since_break: None,
                bet_size_increase_pct: Some(50.0),
                is_late_night: Some(false),
            }),
            raw_text: None,
            session_context: None,
        };
        
        let result = engine.evaluate(&input);
        assert!(result.risk_score >= 50);
        assert_ne!(result.policy_action_trigger, PolicyActionTrigger::NoAction);
    }

    #[test]
    fn test_critical_crisis_triggers_force_pause() {
        let engine = PolicyEngine::new();
        let input = RiskFusionInput {
            emotional_score: -0.9,
            primary_emotion: "sadness".to_string(),
            crisis_indicators: vec!["suicidal_ideation".to_string(), "want to die".to_string()],
            behavioral_data: None,
            raw_text: None,
            session_context: None,
        };
        
        let result = engine.evaluate(&input);
        assert_eq!(result.rg_risk_level, RgRiskLevel::Critical);
        assert_eq!(result.policy_action_trigger, PolicyActionTrigger::ForcePause);
        assert!(result.requires_audit);
    }
}
