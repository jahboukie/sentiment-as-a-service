//! Core sentiment data types

use serde::{Deserialize, Serialize};

/// Core sentiment analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentResult {
    /// Score from -1.0 (very negative) to 1.0 (very positive)
    pub score: f32,
    
    /// Categorical label
    pub category: SentimentCategory,
    
    /// Confidence in the analysis (0.0 - 1.0)
    pub confidence: f32,
    
    /// Magnitude/intensity of sentiment (0.0 - 1.0)
    pub magnitude: f32,
}

/// Sentiment category
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SentimentCategory {
    VeryNegative,
    Negative,
    Neutral,
    Positive,
    VeryPositive,
    Mixed,
}

impl SentimentCategory {
    pub fn from_score(score: f32) -> Self {
        match score {
            s if s <= -0.6 => Self::VeryNegative,
            s if s <= -0.2 => Self::Negative,
            s if s <= 0.2 => Self::Neutral,
            s if s <= 0.6 => Self::Positive,
            _ => Self::VeryPositive,
        }
    }
}

/// Emotion breakdown
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmotionBreakdown {
    pub primary: Emotion,
    pub secondary: Vec<Emotion>,
    pub intensity: f32,
}

/// Individual emotion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Emotion {
    pub name: String,
    pub score: f32,
}

/// Crisis assessment result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrisisAssessment {
    /// Risk level
    pub risk_level: CrisisRiskLevel,
    
    /// Confidence in assessment
    pub confidence: f32,
    
    /// Specific indicators detected
    pub indicators: Vec<CrisisIndicator>,
    
    /// Whether immediate action is recommended
    pub requires_action: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CrisisRiskLevel {
    None,
    Low,
    Moderate,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrisisIndicator {
    pub indicator_type: CrisisIndicatorType,
    pub text_excerpt: String,
    pub severity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CrisisIndicatorType {
    SuicidalIdeation,
    SelfHarm,
    ViolentIntent,
    SevereDistress,
    Hopelessness,
    Isolation,
    SubstanceAbuse,
    Psychosis,
    Other,
}

/// Anonymization replacement info (internal use)
#[derive(Debug, Clone)]
pub struct PiiMatch {
    pub original: String,
    pub replacement: String,
    pub pii_type: PiiType,
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PiiType {
    Email,
    Phone,
    Ssn,
    CreditCard,
    Name,
    Address,
    DateOfBirth,
    MedicalRecordNumber,
    InsuranceId,
    DrugName,
    ProviderName,
    IpAddress,
    Other,
}
