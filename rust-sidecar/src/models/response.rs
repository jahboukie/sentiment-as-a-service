//! Response types for the API

use serde::Serialize;

use super::sentiment::{SentimentResult, CrisisAssessment, EmotionBreakdown};
use super::request::AnonymizationLevel;

/// Standard API response wrapper
#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
}

impl ApiResponse<()> {
    pub fn error(message: &str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.to_string()),
        }
    }
}

/// Sentiment analysis response
#[derive(Debug, Serialize)]
pub struct AnalyzeResponse {
    pub sentiment: SentimentResult,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emotions: Option<EmotionBreakdown>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub crisis: Option<CrisisAssessment>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_terms: Option<Vec<KeyTerm>>,
    
    /// Was this result cached?
    pub cached: bool,
    
    /// Processing time in milliseconds
    pub processing_time_ms: u64,
}

/// Key term with sentiment impact
#[derive(Debug, Clone, Serialize)]
pub struct KeyTerm {
    pub term: String,
    pub sentiment_impact: f32,
    pub frequency: u32,
}

/// Anonymization response
#[derive(Debug, Serialize)]
pub struct AnonymizeResponse {
    pub anonymized_text: String,
    pub level: AnonymizationLevel,
    pub redactions_count: u32,
    pub cached: bool,
}

/// Crisis resource information
#[derive(Debug, Clone, Serialize)]
pub struct CrisisResource {
    pub name: String,
    pub contact: String,
    pub resource_type: String,
}

/// Crisis detection response
#[derive(Debug, Serialize)]
pub struct CrisisDetectResponse {
    pub assessment: CrisisAssessment,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recommended_action: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub crisis_resources: Option<Vec<CrisisResource>>,
    
    pub processing_time_ms: u64,
}

/// Emotion wheel segment for visualization
#[derive(Debug, Clone, Serialize)]
pub struct WheelSegment {
    pub emotion: String,
    pub score: f32,
}

/// Emotion wheel visualization data
#[derive(Debug, Clone, Serialize)]
pub struct EmotionWheel {
    pub primary_emotions: Vec<WheelSegment>,
}

/// Emotions extraction response
#[derive(Debug, Serialize)]
pub struct EmotionsResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emotions: Option<EmotionBreakdown>,
    
    pub sentiment_context: SentimentResult,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emotion_wheel: Option<EmotionWheel>,
    
    pub processing_time_ms: u64,
}
