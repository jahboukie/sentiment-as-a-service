//! Crisis detection service for mental health safety
//! Identifies potential crisis indicators in text

use once_cell::sync::Lazy;
use regex::Regex;

use crate::models::{CrisisAssessment, CrisisRiskLevel, CrisisIndicator, CrisisIndicatorType};

/// Suicide/self-harm keywords
static SUICIDE_KEYWORDS: Lazy<Vec<&'static str>> = Lazy::new(|| {
    vec![
        "kill myself", "end my life", "take my life", "end it all",
        "want to die", "wish I was dead", "better off dead",
        "don't want to live", "can't go on", "no reason to live",
        "suicide", "suicidal", "overdose", "slit my wrists",
        "jump off", "hang myself", "shoot myself", "pills to end",
    ]
});

/// Self-harm keywords
static SELF_HARM_KEYWORDS: Lazy<Vec<&'static str>> = Lazy::new(|| {
    vec![
        "hurt myself", "cutting", "self-harm", "self harm",
        "burn myself", "punish myself", "hit myself",
        "scratch myself", "starve myself", "bruise myself",
    ]
});

/// Hopelessness indicators
static HOPELESSNESS_KEYWORDS: Lazy<Vec<&'static str>> = Lazy::new(|| {
    vec![
        "no hope", "hopeless", "pointless", "worthless",
        "nothing matters", "no future", "never get better",
        "always be like this", "never change", "give up",
        "no way out", "trapped", "burden to everyone",
        "nobody cares", "no one would miss me", "better without me",
    ]
});

/// Violence indicators
static VIOLENCE_KEYWORDS: Lazy<Vec<&'static str>> = Lazy::new(|| {
    vec![
        "kill someone", "hurt someone", "want to hurt",
        "make them pay", "revenge", "violent thoughts",
        "attack", "murder", "shoot them", "stab",
    ]
});

/// Severe distress indicators
static DISTRESS_KEYWORDS: Lazy<Vec<&'static str>> = Lazy::new(|| {
    vec![
        "can't take it anymore", "at my breaking point",
        "losing my mind", "going crazy", "can't cope",
        "falling apart", "complete breakdown", "panic attack",
        "can't breathe", "overwhelming", "unbearable",
        "excruciating", "agonizing", "desperate",
    ]
});

/// Isolation indicators
static ISOLATION_KEYWORDS: Lazy<Vec<&'static str>> = Lazy::new(|| {
    vec![
        "all alone", "no one understands", "nobody to talk to",
        "completely isolated", "cut off from everyone",
        "pushed everyone away", "no friends", "no family",
        "no one cares about me", "invisible", "forgotten",
    ]
});

/// Substance abuse crisis indicators
static SUBSTANCE_KEYWORDS: Lazy<Vec<&'static str>> = Lazy::new(|| {
    vec![
        "overdose", "od'd", "binge drinking", "blackout drunk",
        "can't stop using", "relapsed", "withdrawal",
        "drug problem", "addiction crisis", "need a fix",
    ]
});

/// Psychosis indicators
static PSYCHOSIS_KEYWORDS: Lazy<Vec<&'static str>> = Lazy::new(|| {
    vec![
        "hearing voices", "seeing things", "paranoid",
        "they're watching me", "they're after me",
        "not real", "losing touch with reality",
        "delusions", "hallucinating", "conspiracy against me",
    ]
});

/// Regex for detecting farewell messages
static FAREWELL_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(goodbye\s+(everyone|world|all)|final\s+(message|goodbye|letter)|this\s+is\s+(it|the\s+end)|telling\s+you\s+goodbye)").unwrap()
});

/// Regex for detecting plan/method language
static PLAN_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(i('ve|'m\s+going\s+to|will)\s+(going\s+to\s+)?(do\s+it|end\s+it)|have\s+a\s+plan|know\s+how\s+(i'll|to)\s+do\s+it|decided\s+to|made\s+up\s+my\s+mind)").unwrap()
});

/// Regex for detecting access to means
static MEANS_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(have\s+(the\s+)?(pills|gun|rope|knife|weapon)|bought\s+(a\s+)?(gun|weapon|pills)|stockpiling|saved\s+up\s+(pills|medication))").unwrap()
});

pub struct CrisisDetector;

impl CrisisDetector {
    pub fn new() -> Self {
        Self
    }
    
    /// Analyze text for crisis indicators
    pub fn detect(&self, text: &str) -> CrisisAssessment {
        let text_lower = text.to_lowercase();
        let mut indicators = Vec::new();
        let mut max_severity: f32 = 0.0;
        
        // Check suicidal ideation
        for keyword in SUICIDE_KEYWORDS.iter() {
            if text_lower.contains(keyword) {
                let severity = self.calculate_severity(keyword, &text_lower);
                max_severity = max_severity.max(severity);
                indicators.push(CrisisIndicator {
                    indicator_type: CrisisIndicatorType::SuicidalIdeation,
                    text_excerpt: self.extract_excerpt(&text_lower, keyword),
                    severity,
                });
                break; // One indicator per category
            }
        }
        
        // Check self-harm
        for keyword in SELF_HARM_KEYWORDS.iter() {
            if text_lower.contains(keyword) {
                let severity = self.calculate_severity(keyword, &text_lower);
                max_severity = max_severity.max(severity);
                indicators.push(CrisisIndicator {
                    indicator_type: CrisisIndicatorType::SelfHarm,
                    text_excerpt: self.extract_excerpt(&text_lower, keyword),
                    severity,
                });
                break;
            }
        }
        
        // Check hopelessness
        for keyword in HOPELESSNESS_KEYWORDS.iter() {
            if text_lower.contains(keyword) {
                let severity = self.calculate_severity(keyword, &text_lower) * 0.7;
                max_severity = max_severity.max(severity);
                indicators.push(CrisisIndicator {
                    indicator_type: CrisisIndicatorType::Hopelessness,
                    text_excerpt: self.extract_excerpt(&text_lower, keyword),
                    severity,
                });
                break;
            }
        }
        
        // Check violence
        for keyword in VIOLENCE_KEYWORDS.iter() {
            if text_lower.contains(keyword) {
                let severity = self.calculate_severity(keyword, &text_lower);
                max_severity = max_severity.max(severity);
                indicators.push(CrisisIndicator {
                    indicator_type: CrisisIndicatorType::ViolentIntent,
                    text_excerpt: self.extract_excerpt(&text_lower, keyword),
                    severity,
                });
                break;
            }
        }
        
        // Check severe distress
        for keyword in DISTRESS_KEYWORDS.iter() {
            if text_lower.contains(keyword) {
                let severity = self.calculate_severity(keyword, &text_lower) * 0.6;
                max_severity = max_severity.max(severity);
                indicators.push(CrisisIndicator {
                    indicator_type: CrisisIndicatorType::SevereDistress,
                    text_excerpt: self.extract_excerpt(&text_lower, keyword),
                    severity,
                });
                break;
            }
        }
        
        // Check isolation
        for keyword in ISOLATION_KEYWORDS.iter() {
            if text_lower.contains(keyword) {
                let severity = self.calculate_severity(keyword, &text_lower) * 0.5;
                max_severity = max_severity.max(severity);
                indicators.push(CrisisIndicator {
                    indicator_type: CrisisIndicatorType::Isolation,
                    text_excerpt: self.extract_excerpt(&text_lower, keyword),
                    severity,
                });
                break;
            }
        }
        
        // Check substance abuse
        for keyword in SUBSTANCE_KEYWORDS.iter() {
            if text_lower.contains(keyword) {
                let severity = self.calculate_severity(keyword, &text_lower) * 0.8;
                max_severity = max_severity.max(severity);
                indicators.push(CrisisIndicator {
                    indicator_type: CrisisIndicatorType::SubstanceAbuse,
                    text_excerpt: self.extract_excerpt(&text_lower, keyword),
                    severity,
                });
                break;
            }
        }
        
        // Check psychosis
        for keyword in PSYCHOSIS_KEYWORDS.iter() {
            if text_lower.contains(keyword) {
                let severity = self.calculate_severity(keyword, &text_lower) * 0.85;
                max_severity = max_severity.max(severity);
                indicators.push(CrisisIndicator {
                    indicator_type: CrisisIndicatorType::Psychosis,
                    text_excerpt: self.extract_excerpt(&text_lower, keyword),
                    severity,
                });
                break;
            }
        }
        
        // Check for farewell pattern (critical risk multiplier)
        if FAREWELL_PATTERN.is_match(&text_lower) {
            max_severity = (max_severity * 1.5).min(1.0);
            if let Some(m) = FAREWELL_PATTERN.find(&text_lower) {
                indicators.push(CrisisIndicator {
                    indicator_type: CrisisIndicatorType::SuicidalIdeation,
                    text_excerpt: m.as_str().to_string(),
                    severity: 0.9,
                });
            }
        }
        
        // Check for plan/method language (critical risk multiplier)
        if PLAN_PATTERN.is_match(&text_lower) {
            max_severity = (max_severity * 1.5).min(1.0);
            if let Some(m) = PLAN_PATTERN.find(&text_lower) {
                indicators.push(CrisisIndicator {
                    indicator_type: CrisisIndicatorType::SuicidalIdeation,
                    text_excerpt: format!("Has plan: {}", m.as_str()),
                    severity: 0.95,
                });
            }
        }
        
        // Check for means access (critical)
        if MEANS_PATTERN.is_match(&text_lower) {
            max_severity = 1.0; // Immediate critical
            if let Some(m) = MEANS_PATTERN.find(&text_lower) {
                indicators.push(CrisisIndicator {
                    indicator_type: CrisisIndicatorType::SuicidalIdeation,
                    text_excerpt: format!("Access to means: {}", m.as_str()),
                    severity: 1.0,
                });
            }
        }
        
        // Determine risk level
        let risk_level = match max_severity {
            s if s >= 0.9 => CrisisRiskLevel::Critical,
            s if s >= 0.7 => CrisisRiskLevel::High,
            s if s >= 0.4 => CrisisRiskLevel::Moderate,
            s if s > 0.0 => CrisisRiskLevel::Low,
            _ => CrisisRiskLevel::None,
        };
        
        // Calculate confidence based on number and strength of indicators
        let confidence = if indicators.is_empty() {
            0.9 // High confidence when no indicators found
        } else {
            let indicator_count = indicators.len() as f32;
            let avg_severity: f32 = indicators.iter().map(|i| i.severity).sum::<f32>() / indicator_count;
            (0.5 + (indicator_count / 10.0) + (avg_severity / 2.0)).min(0.95)
        };
        
        let requires_action = matches!(risk_level, CrisisRiskLevel::High | CrisisRiskLevel::Critical);
        
        CrisisAssessment {
            risk_level,
            confidence,
            indicators,
            requires_action,
        }
    }
    
    /// Calculate severity based on keyword and context
    fn calculate_severity(&self, keyword: &str, text: &str) -> f32 {
        let base_severity: f32 = match keyword {
            k if k.contains("kill") || k.contains("suicide") || k.contains("die") => 0.9,
            k if k.contains("hurt") || k.contains("harm") => 0.7,
            k if k.contains("hopeless") || k.contains("worthless") => 0.6,
            _ => 0.5,
        };
        
        // Check for immediacy words
        let immediacy_boost: f32 = if text.contains("right now") || text.contains("tonight") || 
            text.contains("today") || text.contains("about to") {
            0.15
        } else {
            0.0
        };
        
        // Check for certainty words
        let certainty_boost: f32 = if text.contains("definitely") || text.contains("going to") ||
            text.contains("will ") || text.contains("decided") {
            0.1
        } else {
            0.0
        };
        
        (base_severity + immediacy_boost + certainty_boost).min(1.0_f32)
    }
    
    /// Extract a text excerpt around the keyword
    fn extract_excerpt(&self, text: &str, keyword: &str) -> String {
        if let Some(pos) = text.find(keyword) {
            let start = pos.saturating_sub(30);
            let end = (pos + keyword.len() + 30).min(text.len());
            let excerpt = &text[start..end];
            
            // Clean up to word boundaries
            let excerpt = excerpt.trim();
            if start > 0 {
                format!("...{}", excerpt)
            } else if end < text.len() {
                format!("{}...", excerpt)
            } else {
                excerpt.to_string()
            }
        } else {
            keyword.to_string()
        }
    }
}

impl Default for CrisisDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_no_crisis() {
        let detector = CrisisDetector::new();
        let result = detector.detect("I had a great day at work and feel happy.");
        assert!(matches!(result.risk_level, CrisisRiskLevel::None));
        assert!(result.indicators.is_empty());
    }
    
    #[test]
    fn test_suicidal_ideation() {
        let detector = CrisisDetector::new();
        let result = detector.detect("I want to end my life, nothing matters anymore.");
        // Should detect some crisis indicators
        assert!(!result.indicators.is_empty());
        // Check for suicidal or hopelessness indicators
        let has_crisis = result.indicators.iter().any(|i| 
            matches!(i.indicator_type, CrisisIndicatorType::SuicidalIdeation | CrisisIndicatorType::Hopelessness)
        );
        assert!(has_crisis, "Should detect suicidal ideation or hopelessness");
    }
    
    #[test]
    fn test_self_harm() {
        let detector = CrisisDetector::new();
        let result = detector.detect("I've been cutting again to cope with stress.");
        assert!(!result.indicators.is_empty());
        assert!(result.indicators.iter().any(|i| matches!(i.indicator_type, CrisisIndicatorType::SelfHarm)));
    }
    
    #[test]
    fn test_hopelessness() {
        let detector = CrisisDetector::new();
        let result = detector.detect("I feel completely hopeless, like nothing will ever get better.");
        assert!(!result.indicators.is_empty());
        assert!(result.indicators.iter().any(|i| matches!(i.indicator_type, CrisisIndicatorType::Hopelessness)));
    }
    
    #[test]
    fn test_plan_detection() {
        let detector = CrisisDetector::new();
        let result = detector.detect("I've decided to kill myself tonight. I have a plan to do it.");
        // This text should trigger high-level alerts
        assert!(!result.indicators.is_empty());
        assert!(result.requires_action);
    }
    
    #[test]
    fn test_means_access() {
        let detector = CrisisDetector::new();
        let result = detector.detect("I want to die. I have the pills ready.");
        // Should detect crisis due to explicit suicidal ideation
        assert!(!result.indicators.is_empty());
        assert!(result.requires_action);
    }
    
    #[test]
    fn test_moderate_distress() {
        let detector = CrisisDetector::new();
        let result = detector.detect("I'm at my breaking point and can't cope anymore.");
        // Should detect distress indicators
        assert!(!result.indicators.is_empty());
    }
}
