//! Claude API client for advanced sentiment analysis

use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::models::{SentimentResult, SentimentCategory, EmotionBreakdown, Emotion, CrisisAssessment, CrisisRiskLevel, CrisisIndicator, CrisisIndicatorType, AnalysisContext, KeyTerm};

const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";

pub struct ClaudeClient {
    client: Client,
    api_key: String,
    model: String,
}

#[derive(Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<Message>,
}

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ClaudeResponse {
    content: Vec<ContentBlock>,
}

#[derive(Deserialize)]
struct ContentBlock {
    text: String,
}

#[derive(Deserialize)]
struct SentimentAnalysisOutput {
    sentiment_score: f32,
    sentiment_category: String,
    confidence: f32,
    magnitude: f32,
    emotions: Option<EmotionsOutput>,
    crisis_assessment: Option<CrisisOutput>,
    key_terms: Option<Vec<KeyTermOutput>>,
}

#[derive(Deserialize)]
struct EmotionsOutput {
    primary: String,
    primary_score: f32,
    secondary: Vec<SecondaryEmotion>,
    intensity: f32,
}

#[derive(Deserialize)]
struct SecondaryEmotion {
    name: String,
    score: f32,
}

#[derive(Deserialize)]
struct CrisisOutput {
    risk_level: String,
    confidence: f32,
    indicators: Vec<IndicatorOutput>,
    requires_action: bool,
}

#[derive(Deserialize)]
struct IndicatorOutput {
    indicator_type: String,
    text_excerpt: String,
    severity: f32,
}

#[derive(Deserialize)]
struct KeyTermOutput {
    term: String,
    sentiment_impact: f32,
    frequency: u32,
}

impl ClaudeClient {
    pub fn new(api_key: String, model: String) -> Result<Self> {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;
        
        Ok(Self {
            client,
            api_key,
            model,
        })
    }
    
    pub async fn analyze_sentiment(
        &self,
        text: &str,
        include_emotions: bool,
        include_crisis: bool,
        include_key_terms: bool,
        context: Option<&AnalysisContext>,
    ) -> Result<(SentimentResult, Option<EmotionBreakdown>, Option<CrisisAssessment>, Option<Vec<KeyTerm>>)> {
        let prompt = self.build_prompt(text, include_emotions, include_crisis, include_key_terms, context);
        
        let request = ClaudeRequest {
            model: self.model.clone(),
            max_tokens: 1500,
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt,
            }],
        };
        
        let response = self.client
            .post(CLAUDE_API_URL)
            .header("Content-Type", "application/json")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&request)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Claude API error {}: {}", status, error_text));
        }
        
        let claude_response: ClaudeResponse = response.json().await?;
        let json_text = &claude_response.content.first()
            .ok_or_else(|| anyhow!("Empty response from Claude"))?
            .text;
        
        // Extract JSON from response (may be wrapped in markdown)
        let json_str = self.extract_json(json_text)?;
        let output: SentimentAnalysisOutput = serde_json::from_str(&json_str)?;
        
        // Convert to our types
        let sentiment = SentimentResult {
            score: output.sentiment_score,
            category: self.parse_category(&output.sentiment_category),
            confidence: output.confidence,
            magnitude: output.magnitude,
        };
        
        let emotions = output.emotions.map(|e| EmotionBreakdown {
            primary: Emotion {
                name: e.primary,
                score: e.primary_score,
            },
            secondary: e.secondary.into_iter().map(|s| Emotion {
                name: s.name,
                score: s.score,
            }).collect(),
            intensity: e.intensity,
        });
        
        let crisis = output.crisis_assessment.map(|c| CrisisAssessment {
            risk_level: self.parse_risk_level(&c.risk_level),
            confidence: c.confidence,
            indicators: c.indicators.into_iter().map(|i| CrisisIndicator {
                indicator_type: self.parse_indicator_type(&i.indicator_type),
                text_excerpt: i.text_excerpt,
                severity: i.severity,
            }).collect(),
            requires_action: c.requires_action,
        });
        
        let key_terms = output.key_terms.map(|terms| {
            terms.into_iter().map(|t| KeyTerm {
                term: t.term,
                sentiment_impact: t.sentiment_impact,
                frequency: t.frequency,
            }).collect()
        });
        
        Ok((sentiment, emotions, crisis, key_terms))
    }
    
    fn build_prompt(
        &self,
        text: &str,
        include_emotions: bool,
        include_crisis: bool,
        include_key_terms: bool,
        context: Option<&AnalysisContext>,
    ) -> String {
        let context_hint = match context {
            Some(AnalysisContext::CustomerService) => "This is from a customer service interaction.",
            Some(AnalysisContext::Healthcare) => "This is healthcare/medical context.",
            Some(AnalysisContext::MentalHealth) => "This is mental health/therapy context. Be extra vigilant for crisis signals.",
            Some(AnalysisContext::Social) => "This is general social/relationship context.",
            Some(AnalysisContext::Professional) => "This is professional/workplace context.",
            Some(AnalysisContext::CrisisLine) => "This is from a crisis hotline. Prioritize safety assessment.",
            Some(AnalysisContext::Custom(s)) => s,
            None => "",
        };
        
        format!(r#"Analyze the sentiment of the following text. {context_hint}

TEXT:
"{text}"

Provide your analysis as JSON with this exact structure:
{{
  "sentiment_score": <float -1.0 to 1.0>,
  "sentiment_category": "<very_negative|negative|neutral|positive|very_positive|mixed>",
  "confidence": <float 0.0 to 1.0>,
  "magnitude": <float 0.0 to 1.0 indicating intensity>{emotions_section}{crisis_section}{key_terms_section}
}}

Return ONLY valid JSON, no other text."#,
            context_hint = context_hint,
            text = text,
            emotions_section = if include_emotions {
                r#",
  "emotions": {{
    "primary": "<emotion name>",
    "primary_score": <float 0.0 to 1.0>,
    "secondary": [{{"name": "<emotion>", "score": <float>}}],
    "intensity": <float 0.0 to 1.0>
  }}"#
            } else { "" },
            crisis_section = if include_crisis {
                r#",
  "crisis_assessment": {{
    "risk_level": "<none|low|moderate|high|critical>",
    "confidence": <float 0.0 to 1.0>,
    "indicators": [{{"indicator_type": "<type>", "text_excerpt": "<relevant text>", "severity": <float>}}],
    "requires_action": <boolean>
  }}"#
            } else { "" },
            key_terms_section = if include_key_terms {
                r#",
  "key_terms": [{{"term": "<word/phrase>", "sentiment_impact": <float -1.0 to 1.0>, "frequency": <int>}}]"#
            } else { "" },
        )
    }
    
    fn extract_json(&self, text: &str) -> Result<String> {
        // Try to find JSON in the response (may be wrapped in markdown code blocks)
        if let Some(start) = text.find('{') {
            if let Some(end) = text.rfind('}') {
                return Ok(text[start..=end].to_string());
            }
        }
        Err(anyhow!("No JSON found in response"))
    }
    
    fn parse_category(&self, s: &str) -> SentimentCategory {
        match s.to_lowercase().as_str() {
            "very_negative" => SentimentCategory::VeryNegative,
            "negative" => SentimentCategory::Negative,
            "neutral" => SentimentCategory::Neutral,
            "positive" => SentimentCategory::Positive,
            "very_positive" => SentimentCategory::VeryPositive,
            "mixed" => SentimentCategory::Mixed,
            _ => SentimentCategory::Neutral,
        }
    }
    
    fn parse_risk_level(&self, s: &str) -> CrisisRiskLevel {
        match s.to_lowercase().as_str() {
            "none" => CrisisRiskLevel::None,
            "low" => CrisisRiskLevel::Low,
            "moderate" => CrisisRiskLevel::Moderate,
            "high" => CrisisRiskLevel::High,
            "critical" => CrisisRiskLevel::Critical,
            _ => CrisisRiskLevel::None,
        }
    }
    
    fn parse_indicator_type(&self, s: &str) -> CrisisIndicatorType {
        match s.to_lowercase().replace('_', "").as_str() {
            "suicidalideation" | "suicidal" => CrisisIndicatorType::SuicidalIdeation,
            "selfharm" => CrisisIndicatorType::SelfHarm,
            "violentintent" | "violence" => CrisisIndicatorType::ViolentIntent,
            "severedistress" | "distress" => CrisisIndicatorType::SevereDistress,
            "hopelessness" => CrisisIndicatorType::Hopelessness,
            "isolation" => CrisisIndicatorType::Isolation,
            "substanceabuse" | "substance" => CrisisIndicatorType::SubstanceAbuse,
            "psychosis" => CrisisIndicatorType::Psychosis,
            _ => CrisisIndicatorType::Other,
        }
    }
}
