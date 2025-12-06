//! Risk Score Fusion API - AGCO Standard 2.10
//! 
//! POST /v1/risk/score
//! Fuses emotional sentiment with behavioral data to produce unified risk score.

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::models::ApiResponse;
use crate::services::{
    AppState, PolicyEngine, RiskFusionInput, BehavioralData, SessionContext,
    PolicyEnforcementEvent, RgRiskLevel, PolicyActionTrigger
};

/// Request for risk score fusion
#[derive(Debug, Deserialize)]
pub struct RiskScoreRequest {
    /// Text content to analyze (chat message, support ticket, etc.)
    pub text: String,
    /// Player identifier (will be hashed for privacy)
    pub player_id: Option<String>,
    /// Behavioral data from operator's transactional systems
    pub behavioral_data: Option<BehavioralDataInput>,
    /// Session context for enhanced risk assessment
    pub session_context: Option<SessionContextInput>,
    /// Context type for analysis
    pub context: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BehavioralDataInput {
    pub deposits_last_hour: Option<u32>,
    pub session_deposit_total: Option<f64>,
    pub chasing_losses: Option<bool>,
    pub session_duration_minutes: Option<u32>,
    pub minutes_since_break: Option<u32>,
    pub bet_size_increase_pct: Option<f32>,
    pub is_late_night: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SessionContextInput {
    pub support_contacts_30d: Option<u32>,
    pub previous_self_exclusions: Option<u32>,
    pub days_since_exclusion_ended: Option<u32>,
    pub is_vip: Option<bool>,
}

/// Response from risk score fusion
#[derive(Debug, Serialize)]
pub struct RiskScoreResponse {
    /// Unified risk score (0-100)
    pub risk_score: u8,
    /// Risk level category (AGCO aligned)
    pub rg_risk_level: RgRiskLevel,
    /// Primary policy action to trigger
    pub policy_action_trigger: PolicyActionTrigger,
    /// Secondary actions to consider
    pub secondary_actions: Vec<PolicyActionTrigger>,
    /// Human-readable reasoning for audit
    pub reasoning: String,
    /// Whether marketing should be suppressed
    pub suppress_marketing: bool,
    /// Operator-specific RG resources to display
    pub operator_rg_resources: Vec<ResourceInfo>,
    /// Whether this event was logged to audit vault
    pub audit_logged: bool,
    /// Processing time in milliseconds
    pub processing_time_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct ResourceInfo {
    pub name: String,
    pub contact: String,
    pub resource_type: String,
}

/// POST /v1/risk/score - Fuse emotional + behavioral data into risk score
pub async fn risk_score(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RiskScoreRequest>,
) -> Result<Json<ApiResponse<RiskScoreResponse>>, (StatusCode, Json<ApiResponse<()>>)> {
    // Validate request
    if request.text.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::error("Text cannot be empty")),
        ));
    }
    
    if request.text.len() > 50000 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::error("Text exceeds maximum length of 50000 characters")),
        ));
    }
    
    let start = std::time::Instant::now();
    
    // Step 1: Analyze sentiment using existing local analyzer
    let (sentiment, emotions) = state.local_analyzer.analyze(&request.text);
    
    // Step 2: Run crisis detection
    let crisis = state.crisis_detector.detect(&request.text);
    
    // Step 3: Build risk fusion input
    let risk_input = RiskFusionInput {
        emotional_score: sentiment.score,
        primary_emotion: emotions.as_ref()
            .map(|e| e.primary.name.clone())
            .unwrap_or_else(|| "neutral".to_string()),
        crisis_indicators: crisis.indicators.iter()
            .map(|i| format!("{:?}", i.indicator_type))
            .collect(),
        behavioral_data: request.behavioral_data.map(|b| BehavioralData {
            deposits_last_hour: b.deposits_last_hour,
            session_deposit_total: b.session_deposit_total,
            chasing_losses: b.chasing_losses,
            session_duration_minutes: b.session_duration_minutes,
            minutes_since_break: b.minutes_since_break,
            bet_size_increase_pct: b.bet_size_increase_pct,
            is_late_night: b.is_late_night,
        }),
        raw_text: Some(request.text.clone()),
        session_context: request.session_context.map(|s| SessionContext {
            support_contacts_30d: s.support_contacts_30d,
            previous_self_exclusions: s.previous_self_exclusions,
            days_since_exclusion_ended: s.days_since_exclusion_ended,
            is_vip: s.is_vip,
        }),
    };
    
    // Step 4: Run through policy engine
    let policy_engine = PolicyEngine::new();
    let policy_event = policy_engine.evaluate(&risk_input);
    
    // Step 5: Log to audit vault if required
    let audit_logged = if policy_event.requires_audit {
        if let Some(ref audit_logger) = state.audit_logger {
            // Redact the text before logging
            let (redacted_text, _) = state.anonymizer.basic_anonymization(&request.text);
            
            let _ = audit_logger.log_policy_event(
                &policy_event.event_id,
                request.player_id.as_deref(),
                &format!("[REDACTED: {}]", &redacted_text[..redacted_text.len().min(100)]),
                policy_event.risk_score,
                &format!("{:?}", policy_event.rg_risk_level),
                &format!("{:?}", policy_event.policy_action_trigger),
                &policy_event.secondary_actions.iter()
                    .map(|a| format!("{:?}", a))
                    .collect::<Vec<_>>(),
                &policy_event.reasoning,
                policy_event.processing_time_ms,
            );
            true
        } else {
            false
        }
    } else {
        false
    };
    
    let processing_time = start.elapsed().as_millis() as u64;
    
    // Check if marketing should be suppressed
    let suppress_marketing = matches!(
        policy_event.policy_action_trigger,
        PolicyActionTrigger::SuppressMarketing |
        PolicyActionTrigger::EscalateToRgAgent |
        PolicyActionTrigger::EscalateToSeniorRgAgent |
        PolicyActionTrigger::ForcePause
    ) || policy_event.secondary_actions.contains(&PolicyActionTrigger::SuppressMarketing);
    
    let response = RiskScoreResponse {
        risk_score: policy_event.risk_score,
        rg_risk_level: policy_event.rg_risk_level,
        policy_action_trigger: policy_event.policy_action_trigger,
        secondary_actions: policy_event.secondary_actions,
        reasoning: policy_event.reasoning,
        suppress_marketing,
        operator_rg_resources: policy_event.operator_rg_resources.iter().map(|r| {
            ResourceInfo {
                name: r.name.clone(),
                contact: r.contact.clone(),
                resource_type: format!("{:?}", r.resource_type),
            }
        }).collect(),
        audit_logged,
        processing_time_ms: processing_time,
    };
    
    Ok(Json(ApiResponse::success(response)))
}
