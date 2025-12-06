//! Crisis detection endpoint

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use std::sync::Arc;

use crate::models::{CrisisDetectRequest, CrisisDetectResponse, ApiResponse, CrisisRiskLevel, CrisisResource};
use crate::services::AppState;

/// POST /v1/crisis/detect - Detect mental health crisis indicators
pub async fn detect_crisis(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CrisisDetectRequest>,
) -> Result<Json<ApiResponse<CrisisDetectResponse>>, (StatusCode, Json<ApiResponse<()>>)> {
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
    
    // Always use local detector for speed and privacy
    // (crisis detection should not send data to external APIs)
    let assessment = state.crisis_detector.detect(&request.text);
    
    let processing_time_ms = start.elapsed().as_millis() as u64;
    
    // Generate action recommendations based on risk level
    let recommended_action = match assessment.risk_level {
        CrisisRiskLevel::Critical => Some("IMMEDIATE ACTION REQUIRED: Connect user with emergency services (911) or crisis hotline (988 in US). Do not leave user alone.".to_string()),
        CrisisRiskLevel::High => Some("URGENT: Provide crisis resources immediately. Recommend professional help. Consider safety planning.".to_string()),
        CrisisRiskLevel::Moderate => Some("ATTENTION: Offer support resources. Encourage professional consultation. Follow up recommended.".to_string()),
        CrisisRiskLevel::Low => Some("MONITOR: Continue supportive conversation. Provide general mental health resources if appropriate.".to_string()),
        CrisisRiskLevel::None => None,
    };
    
    // Build crisis resources based on context
    let crisis_resources = if assessment.requires_action {
        Some(vec![
            CrisisResource {
                name: "National Suicide Prevention Lifeline".to_string(),
                contact: "988".to_string(),
                resource_type: "phone".to_string(),
            },
            CrisisResource {
                name: "Crisis Text Line".to_string(),
                contact: "Text HOME to 741741".to_string(),
                resource_type: "text".to_string(),
            },
            CrisisResource {
                name: "International Association for Suicide Prevention".to_string(),
                contact: "https://www.iasp.info/resources/Crisis_Centres/".to_string(),
                resource_type: "web".to_string(),
            },
        ])
    } else {
        None
    };
    
    Ok(Json(ApiResponse::success(CrisisDetectResponse {
        assessment,
        recommended_action,
        crisis_resources,
        processing_time_ms,
    })))
}
