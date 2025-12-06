//! Policy Intervention API - RG Check Standard 4
//! 
//! POST /v1/policy/intervene
//! Triggers policy enforcement events based on high-risk emotional/crisis indicators.

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::models::ApiResponse;
use crate::services::{
    AppState, PolicyEngine, RiskFusionInput, RgRiskLevel, 
    PolicyActionTrigger, OperatorRgResource, ResourceType, AuditEventType
};

/// Request for policy intervention check
#[derive(Debug, Deserialize)]
pub struct PolicyInterveneRequest {
    /// Text content triggering potential intervention
    pub text: String,
    /// Player identifier
    pub player_id: Option<String>,
    /// Force intervention check even for low-risk content
    #[serde(default)]
    pub force_check: bool,
}

/// Response for policy intervention
#[derive(Debug, Serialize)]
pub struct PolicyInterveneResponse {
    /// Whether intervention is required
    pub intervention_required: bool,
    /// The intervention event details (if triggered)
    pub intervention: Option<InterventionDetails>,
    /// Processing time in milliseconds
    pub processing_time_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct InterventionDetails {
    /// Unique intervention event ID
    pub event_id: String,
    /// Risk level that triggered intervention
    pub rg_risk_level: RgRiskLevel,
    /// Risk score (0-100)
    pub risk_score: u8,
    /// Primary action to execute
    pub action: PolicyActionTrigger,
    /// Additional actions to consider
    pub secondary_actions: Vec<PolicyActionTrigger>,
    /// Human-readable intervention message for the player
    pub player_message: String,
    /// Internal reasoning for audit
    pub audit_reasoning: String,
    /// Resources to display to the player
    pub resources: Vec<ResourceDisplay>,
    /// Whether account should be paused
    pub pause_account: bool,
    /// Duration of marketing suppression in days (0 = none)
    pub marketing_suppression_days: u32,
    /// Whether to escalate to human RG agent
    pub escalate_to_human: bool,
}

#[derive(Debug, Serialize)]
pub struct ResourceDisplay {
    pub name: String,
    pub contact: String,
    pub description: String,
}

/// POST /v1/policy/intervene - Check if intervention is needed
pub async fn policy_intervene(
    State(state): State<Arc<AppState>>,
    Json(request): Json<PolicyInterveneRequest>,
) -> Result<Json<ApiResponse<PolicyInterveneResponse>>, (StatusCode, Json<ApiResponse<()>>)> {
    if request.text.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::error("Text cannot be empty")),
        ));
    }
    
    let start = std::time::Instant::now();
    
    // Analyze content
    let (sentiment, emotions) = state.local_analyzer.analyze(&request.text);
    let crisis = state.crisis_detector.detect(&request.text);
    
    // Build risk input
    let risk_input = RiskFusionInput {
        emotional_score: sentiment.score,
        primary_emotion: emotions.as_ref()
            .map(|e| e.primary.name.clone())
            .unwrap_or_else(|| "neutral".to_string()),
        crisis_indicators: crisis.indicators.iter()
            .map(|i| format!("{:?}", i.indicator_type))
            .collect(),
        behavioral_data: None,
        raw_text: Some(request.text.clone()),
        session_context: None,
    };
    
    // Evaluate through policy engine
    let policy_engine = PolicyEngine::new();
    let policy_event = policy_engine.evaluate(&risk_input);
    
    // Determine if intervention is required
    let intervention_required = policy_event.risk_score >= 40 || 
        request.force_check ||
        !matches!(policy_event.policy_action_trigger, PolicyActionTrigger::NoAction);
    
    let processing_time = start.elapsed().as_millis() as u64;
    
    if !intervention_required {
        return Ok(Json(ApiResponse::success(PolicyInterveneResponse {
            intervention_required: false,
            intervention: None,
            processing_time_ms: processing_time,
        })));
    }
    
    // Build intervention details
    let player_message = generate_player_message(&policy_event.rg_risk_level, &policy_event.policy_action_trigger);
    
    let pause_account = matches!(policy_event.policy_action_trigger, PolicyActionTrigger::ForcePause);
    
    let marketing_suppression_days = if policy_event.secondary_actions.contains(&PolicyActionTrigger::SuppressMarketing) 
        || matches!(policy_event.policy_action_trigger, PolicyActionTrigger::SuppressMarketing) {
        30
    } else {
        0
    };
    
    let escalate_to_human = matches!(
        policy_event.policy_action_trigger,
        PolicyActionTrigger::EscalateToRgAgent | PolicyActionTrigger::EscalateToSeniorRgAgent
    );
    
    // Log to audit if we have a logger
    if let Some(ref audit_logger) = state.audit_logger {
        let (redacted_text, _) = state.anonymizer.basic_anonymization(&request.text);
        let _ = audit_logger.log_policy_event(
            &policy_event.event_id,
            request.player_id.as_deref(),
            &format!("[INTERVENTION: {}]", &redacted_text[..redacted_text.len().min(100)]),
            policy_event.risk_score,
            &format!("{:?}", policy_event.rg_risk_level),
            &format!("{:?}", policy_event.policy_action_trigger),
            &policy_event.secondary_actions.iter()
                .map(|a| format!("{:?}", a))
                .collect::<Vec<_>>(),
            &policy_event.reasoning,
            processing_time,
        );
    }
    
    let intervention = InterventionDetails {
        event_id: policy_event.event_id,
        rg_risk_level: policy_event.rg_risk_level,
        risk_score: policy_event.risk_score,
        action: policy_event.policy_action_trigger,
        secondary_actions: policy_event.secondary_actions,
        player_message,
        audit_reasoning: policy_event.reasoning,
        resources: policy_event.operator_rg_resources.iter().map(|r| {
            ResourceDisplay {
                name: r.name.clone(),
                contact: r.contact.clone(),
                description: get_resource_description(&r.resource_type),
            }
        }).collect(),
        pause_account,
        marketing_suppression_days,
        escalate_to_human,
    };
    
    Ok(Json(ApiResponse::success(PolicyInterveneResponse {
        intervention_required: true,
        intervention: Some(intervention),
        processing_time_ms: processing_time,
    })))
}

/// Generate player-facing message based on risk level
fn generate_player_message(risk_level: &RgRiskLevel, action: &PolicyActionTrigger) -> String {
    match (risk_level, action) {
        (RgRiskLevel::Critical, _) => {
            "We're concerned about you. A member of our Responsible Gaming team will reach out shortly. \
             In the meantime, please know that support is available 24/7 at ConnexOntario: 1-866-531-2600.".to_string()
        }
        (RgRiskLevel::HighFinancialHarm, _) => {
            "We've noticed you might be experiencing some frustration. Would you like to take a break? \
             You can set a cooling-off period or chat with our Responsible Gaming team.".to_string()
        }
        (_, PolicyActionTrigger::SendCoolingOffPopup) => {
            "It looks like you've been playing for a while. Taking regular breaks is an important part of \
             responsible gaming. Would you like to set a reminder or take a short break now?".to_string()
        }
        (_, PolicyActionTrigger::EnforceMandatoryBreak) => {
            "You've been playing for an extended period. We're giving you a short break to help you \
             play responsibly. Your session will resume shortly.".to_string()
        }
        (_, PolicyActionTrigger::OfferSelfExclusion) => {
            "If you feel like gambling is becoming too much, we offer self-exclusion options. \
             This is a free tool that can help you take a longer break from gambling.".to_string()
        }
        _ => {
            "Remember to play responsibly. If you need support, our Responsible Gaming team is here to help.".to_string()
        }
    }
}

fn get_resource_description(resource_type: &ResourceType) -> String {
    match resource_type {
        ResourceType::Phone => "24/7 confidential support line".to_string(),
        ResourceType::Website => "Online resources and information".to_string(),
        ResourceType::Chat => "Live chat support available".to_string(),
        ResourceType::SelfExclusionPortal => "Register for self-exclusion".to_string(),
        ResourceType::CoolingOffTool => "Set voluntary limits and breaks".to_string(),
    }
}
