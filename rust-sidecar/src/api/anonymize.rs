//! Text anonymization endpoint

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use std::sync::Arc;

use crate::models::{AnonymizeRequest, AnonymizeResponse, ApiResponse, AnonymizationLevel};
use crate::services::AppState;

/// POST /v1/anonymize - Anonymize PII from text
pub async fn anonymize(
    State(state): State<Arc<AppState>>,
    Json(request): Json<AnonymizeRequest>,
) -> Result<Json<ApiResponse<AnonymizeResponse>>, (StatusCode, Json<ApiResponse<()>>)> {
    // Validate request
    if request.text.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::error("Text cannot be empty")),
        ));
    }
    
    if request.text.len() > 100000 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::error("Text exceeds maximum length of 100000 characters")),
        ));
    }
    
    let level = request.level.unwrap_or(AnonymizationLevel::Basic);
    let level_str = match level {
        AnonymizationLevel::Basic => "basic",
        AnonymizationLevel::Healthcare => "healthcare",
        AnonymizationLevel::DifferentialPrivacy => "differential_privacy",
    };
    
    // Check cache
    if let Some(cached) = state.cache.get_anonymized(&request.text, level_str).await {
        return Ok(Json(ApiResponse::success(AnonymizeResponse {
            anonymized_text: cached,
            level: level.clone(),
            redactions_count: 0, // Can't know from cache
            cached: true,
        })));
    }
    
    // Perform anonymization
    let (anonymized_text, redactions) = match level {
        AnonymizationLevel::Basic => {
            state.anonymizer.basic_anonymization(&request.text)
        }
        AnonymizationLevel::Healthcare => {
            state.anonymizer.healthcare_anonymization(&request.text)
        }
        AnonymizationLevel::DifferentialPrivacy => {
            let epsilon = request.epsilon.unwrap_or(1.0);
            state.anonymizer.differential_privacy_anonymization(&request.text, epsilon)
        }
    };
    
    // Cache the result
    state.cache.set_anonymized(&request.text, level_str, anonymized_text.clone()).await;
    
    Ok(Json(ApiResponse::success(AnonymizeResponse {
        anonymized_text,
        level,
        redactions_count: redactions.len() as u32,
        cached: false,
    })))
}
