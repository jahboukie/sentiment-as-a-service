//! Request types for the API

use serde::{Deserialize, Serialize};
use validator::Validate;

/// Request for sentiment analysis
#[derive(Debug, Deserialize, Validate)]
pub struct AnalyzeRequest {
    /// Text to analyze
    #[validate(length(min = 1, max = 50000))]
    pub text: String,
    
    /// Include detailed emotion breakdown
    pub include_emotions: Option<bool>,
    
    /// Include crisis risk assessment
    pub include_crisis: Option<bool>,
    
    /// Include key terms/phrases that drive sentiment
    pub include_key_terms: Option<bool>,
    
    /// Context hint for better analysis
    pub context: Option<AnalysisContext>,
}

/// Batch analysis request
#[derive(Debug, Deserialize, Validate)]
pub struct BatchAnalyzeRequest {
    /// Texts to analyze (max 50)
    #[validate(length(min = 1, max = 50))]
    pub texts: Vec<String>,
    
    pub include_emotions: Option<bool>,
    pub include_crisis: Option<bool>,
}

/// Request for text anonymization
#[derive(Debug, Deserialize, Validate)]
pub struct AnonymizeRequest {
    /// Text to anonymize
    #[validate(length(min = 1, max = 100000))]
    pub text: String,
    
    /// Anonymization level
    pub level: Option<AnonymizationLevel>,
    
    /// Epsilon value for differential privacy (default: 1.0)
    pub epsilon: Option<f64>,
    
    /// Return mapping of original -> replacement (for debugging)
    #[serde(default)]
    pub include_mapping: bool,
}

/// Request for crisis detection
#[derive(Debug, Deserialize, Validate)]
pub struct CrisisDetectRequest {
    /// Text to analyze for crisis signals
    #[validate(length(min = 1, max = 50000))]
    pub text: String,
    
    /// Sensitivity level (higher = more false positives, fewer misses)
    pub sensitivity: Option<f32>,
}

/// Request for emotion extraction
#[derive(Debug, Deserialize, Validate)]
pub struct EmotionsRequest {
    /// Text to analyze
    #[validate(length(min = 1, max = 50000))]
    pub text: String,
    
    /// Include emotion wheel visualization data
    pub include_wheel: Option<bool>,
    
    /// Maximum emotions to return
    pub max_emotions: Option<usize>,
}

/// Context hints for better analysis
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisContext {
    /// Customer service / support conversation
    CustomerService,
    /// Healthcare / medical context
    Healthcare,
    /// Mental health / therapy context
    MentalHealth,
    /// General social / relationship
    Social,
    /// Professional / workplace
    Professional,
    /// Crisis hotline / emergency
    CrisisLine,
    /// Custom context description
    Custom(String),
}

/// Anonymization levels
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AnonymizationLevel {
    /// Replace obvious PII (names, emails, phones, SSN)
    #[default]
    Basic,
    /// Basic + healthcare identifiers (MRN, insurance, provider names)
    Healthcare,
    /// Healthcare + differential privacy noise injection
    DifferentialPrivacy,
}
