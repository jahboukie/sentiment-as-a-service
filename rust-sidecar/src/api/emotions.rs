//! Emotion analysis endpoint

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use std::sync::Arc;

use crate::models::{EmotionsRequest, EmotionsResponse, ApiResponse, EmotionWheel, WheelSegment};
use crate::services::AppState;

/// POST /v1/emotions - Dedicated emotion analysis
pub async fn analyze_emotions(
    State(state): State<Arc<AppState>>,
    Json(request): Json<EmotionsRequest>,
) -> Result<Json<ApiResponse<EmotionsResponse>>, (StatusCode, Json<ApiResponse<()>>)> {
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
    
    // Use local analyzer for emotion detection
    let (sentiment, emotions) = state.local_analyzer.analyze(&request.text);
    
    let processing_time_ms = start.elapsed().as_millis() as u64;
    
    // Build emotion wheel data if detailed analysis requested
    let emotion_wheel = if request.include_wheel.unwrap_or(false) {
        emotions.as_ref().map(|e| {
            let primary_emotions: Vec<WheelSegment> = vec![
                WheelSegment { emotion: "joy".to_string(), score: 0.0 },
                WheelSegment { emotion: "sadness".to_string(), score: 0.0 },
                WheelSegment { emotion: "anger".to_string(), score: 0.0 },
                WheelSegment { emotion: "fear".to_string(), score: 0.0 },
                WheelSegment { emotion: "surprise".to_string(), score: 0.0 },
                WheelSegment { emotion: "disgust".to_string(), score: 0.0 },
                WheelSegment { emotion: "trust".to_string(), score: 0.0 },
                WheelSegment { emotion: "anticipation".to_string(), score: 0.0 },
            ].into_iter().map(|mut seg| {
                // Update scores based on detected emotions
                if seg.emotion == e.primary.name.to_lowercase() {
                    seg.score = e.primary.score;
                }
                for secondary in &e.secondary {
                    if seg.emotion == secondary.name.to_lowercase() {
                        seg.score = secondary.score;
                    }
                }
                seg
            }).collect();
            
            EmotionWheel { primary_emotions }
        })
    } else {
        None
    };
    
    Ok(Json(ApiResponse::success(EmotionsResponse {
        emotions,
        sentiment_context: sentiment,
        emotion_wheel,
        processing_time_ms,
    })))
}
