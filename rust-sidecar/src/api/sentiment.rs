//! Sentiment analysis endpoint

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use std::sync::Arc;

use crate::models::{AnalyzeRequest, AnalyzeResponse, ApiResponse};
use crate::services::{AppState, CachedAnalysis};

/// POST /v1/analyze - Main sentiment analysis endpoint
pub async fn analyze(
    State(state): State<Arc<AppState>>,
    Json(request): Json<AnalyzeRequest>,
) -> Result<Json<ApiResponse<AnalyzeResponse>>, (StatusCode, Json<ApiResponse<()>>)> {
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
    
    let include_emotions = request.include_emotions.unwrap_or(true);
    let include_crisis = request.include_crisis.unwrap_or(false);
    let include_key_terms = request.include_key_terms.unwrap_or(false);
    
    // Check cache first
    if let Some(cached) = state.cache.get_analysis(&request.text, include_emotions, include_crisis).await {
        return Ok(Json(ApiResponse::success(AnalyzeResponse {
            sentiment: cached.sentiment,
            emotions: cached.emotions,
            crisis: cached.crisis,
            key_terms: cached.key_terms,
            cached: true,
            processing_time_ms: 0,
        })));
    }
    
    let start = std::time::Instant::now();
    
    // Try Claude API first if available
    let result = if let Some(ref claude) = state.claude_client {
        match claude.analyze_sentiment(
            &request.text,
            include_emotions,
            include_crisis,
            include_key_terms,
            request.context.as_ref(),
        ).await {
            Ok((sentiment, emotions, crisis, key_terms)) => {
                (sentiment, emotions, crisis, key_terms)
            }
            Err(e) => {
                // Log error and fall back to local analysis
                tracing::warn!("Claude API error, falling back to local: {}", e);
                let (sentiment, emotions) = state.local_analyzer.analyze(&request.text);
                let crisis = if include_crisis {
                    Some(state.crisis_detector.detect(&request.text))
                } else {
                    None
                };
                (sentiment, emotions, crisis, None)
            }
        }
    } else {
        // No Claude client, use local analysis
        let (sentiment, emotions) = state.local_analyzer.analyze(&request.text);
        let crisis = if include_crisis {
            Some(state.crisis_detector.detect(&request.text))
        } else {
            None
        };
        (sentiment, emotions, crisis, None)
    };
    
    let processing_time_ms = start.elapsed().as_millis() as u64;
    
    // Cache the result
    let cached_result = CachedAnalysis {
        sentiment: result.0.clone(),
        emotions: result.1.clone(),
        crisis: result.2.clone(),
        key_terms: result.3.clone(),
    };
    state.cache.set_analysis(&request.text, include_emotions, include_crisis, cached_result).await;
    
    Ok(Json(ApiResponse::success(AnalyzeResponse {
        sentiment: result.0,
        emotions: result.1,
        crisis: result.2,
        key_terms: result.3,
        cached: false,
        processing_time_ms,
    })))
}
