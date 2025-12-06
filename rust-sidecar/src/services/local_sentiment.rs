//! Local sentiment analysis engine - fallback when Claude is unavailable
//! Uses pattern matching and lexicon-based analysis

use std::collections::HashMap;
use once_cell::sync::Lazy;
use crate::models::{SentimentResult, SentimentCategory, EmotionBreakdown, Emotion};

/// Healthcare-specific sentiment lexicon with domain weights
static POSITIVE_LEXICON: Lazy<HashMap<&'static str, f32>> = Lazy::new(|| {
    let mut m = HashMap::new();
    // General positive
    m.insert("good", 2.0);
    m.insert("great", 3.0);
    m.insert("excellent", 4.0);
    m.insert("amazing", 4.0);
    m.insert("wonderful", 4.0);
    m.insert("fantastic", 4.0);
    m.insert("love", 3.0);
    m.insert("happy", 3.0);
    m.insert("joy", 3.0);
    m.insert("pleased", 2.0);
    m.insert("satisfied", 2.0);
    m.insert("grateful", 3.0);
    m.insert("thankful", 3.0);
    m.insert("appreciate", 2.0);
    m.insert("helpful", 2.0);
    m.insert("better", 2.0);
    m.insert("best", 3.0);
    m.insert("improved", 2.0);
    m.insert("progress", 2.0);
    m.insert("success", 3.0);
    m.insert("successful", 3.0);
    m.insert("hope", 2.0);
    m.insert("hopeful", 3.0);
    m.insert("optimistic", 3.0);
    m.insert("confident", 2.0);
    m.insert("comfortable", 2.0);
    m.insert("calm", 2.0);
    m.insert("peaceful", 3.0);
    m.insert("relaxed", 2.0);
    
    // Healthcare-specific positive
    m.insert("recovery", 5.0);
    m.insert("recovering", 4.0);
    m.insert("recovered", 5.0);
    m.insert("healing", 4.0);
    m.insert("healed", 5.0);
    m.insert("remission", 4.0);
    m.insert("stable", 3.0);
    m.insert("improvement", 3.0);
    m.insert("responding", 2.0);
    m.insert("effective", 3.0);
    m.insert("relief", 3.0);
    m.insert("manageable", 2.0);
    m.insert("controlled", 2.0);
    m.insert("clearance", 3.0);
    m.insert("negative", 2.0); // "test came back negative" is positive in healthcare
    m.insert("benign", 4.0);
    m.insert("healthy", 4.0);
    m.insert("well", 2.0);
    m.insert("strength", 2.0);
    m.insert("energy", 2.0);
    m
});

static NEGATIVE_LEXICON: Lazy<HashMap<&'static str, f32>> = Lazy::new(|| {
    let mut m = HashMap::new();
    // General negative
    m.insert("bad", -2.0);
    m.insert("terrible", -4.0);
    m.insert("horrible", -4.0);
    m.insert("awful", -4.0);
    m.insert("hate", -3.0);
    m.insert("sad", -3.0);
    m.insert("unhappy", -3.0);
    m.insert("angry", -3.0);
    m.insert("frustrated", -2.0);
    m.insert("annoyed", -2.0);
    m.insert("disappointed", -2.0);
    m.insert("upset", -2.0);
    m.insert("worried", -2.0);
    m.insert("anxious", -2.0);
    m.insert("stressed", -2.0);
    m.insert("depressed", -4.0);
    m.insert("hopeless", -4.0);
    m.insert("helpless", -3.0);
    m.insert("scared", -3.0);
    m.insert("afraid", -3.0);
    m.insert("fear", -3.0);
    m.insert("lonely", -3.0);
    m.insert("alone", -2.0);
    m.insert("hurt", -2.0);
    m.insert("pain", -2.0);
    m.insert("painful", -3.0);
    m.insert("suffering", -4.0);
    m.insert("struggle", -2.0);
    m.insert("struggling", -3.0);
    m.insert("failed", -3.0);
    m.insert("failure", -3.0);
    m.insert("worst", -4.0);
    m.insert("worse", -3.0);
    
    // Healthcare-specific negative
    m.insert("relapse", -5.0);
    m.insert("relapsed", -5.0);
    m.insert("deteriorating", -4.0);
    m.insert("deterioration", -4.0);
    m.insert("worsening", -4.0);
    m.insert("crisis", -4.0);
    m.insert("emergency", -3.0);
    m.insert("severe", -3.0);
    m.insert("critical", -4.0);
    m.insert("terminal", -5.0);
    m.insert("malignant", -5.0);
    m.insert("metastatic", -5.0);
    m.insert("aggressive", -3.0);
    m.insert("chronic", -2.0);
    m.insert("incurable", -4.0);
    m.insert("untreatable", -4.0);
    m.insert("complications", -3.0);
    m.insert("infection", -2.0);
    m.insert("symptoms", -1.0);
    m.insert("diagnosis", -1.0);
    m.insert("tumor", -3.0);
    m.insert("cancer", -3.0);
    m.insert("disease", -2.0);
    m.insert("illness", -2.0);
    m.insert("disorder", -2.0);
    m.insert("syndrome", -1.0);
    m.insert("overdose", -5.0);
    m
});

/// Emotion keywords mapping
static EMOTION_KEYWORDS: Lazy<HashMap<&'static str, (&'static str, f32)>> = Lazy::new(|| {
    let mut m = HashMap::new();
    // Joy
    m.insert("happy", ("joy", 0.8));
    m.insert("joy", ("joy", 0.9));
    m.insert("joyful", ("joy", 0.9));
    m.insert("delighted", ("joy", 0.8));
    m.insert("thrilled", ("joy", 0.9));
    m.insert("excited", ("joy", 0.7));
    m.insert("cheerful", ("joy", 0.7));
    m.insert("elated", ("joy", 0.9));
    
    // Sadness
    m.insert("sad", ("sadness", 0.8));
    m.insert("unhappy", ("sadness", 0.7));
    m.insert("depressed", ("sadness", 0.9));
    m.insert("miserable", ("sadness", 0.9));
    m.insert("grief", ("sadness", 0.9));
    m.insert("sorrow", ("sadness", 0.8));
    m.insert("heartbroken", ("sadness", 0.9));
    m.insert("devastated", ("sadness", 0.9));
    
    // Anger
    m.insert("angry", ("anger", 0.8));
    m.insert("furious", ("anger", 0.9));
    m.insert("enraged", ("anger", 0.9));
    m.insert("outraged", ("anger", 0.8));
    m.insert("irritated", ("anger", 0.5));
    m.insert("annoyed", ("anger", 0.4));
    m.insert("frustrated", ("anger", 0.6));
    
    // Fear
    m.insert("afraid", ("fear", 0.8));
    m.insert("scared", ("fear", 0.8));
    m.insert("terrified", ("fear", 0.9));
    m.insert("frightened", ("fear", 0.8));
    m.insert("anxious", ("fear", 0.6));
    m.insert("worried", ("fear", 0.5));
    m.insert("nervous", ("fear", 0.5));
    m.insert("panicked", ("fear", 0.9));
    
    // Surprise
    m.insert("surprised", ("surprise", 0.7));
    m.insert("shocked", ("surprise", 0.8));
    m.insert("amazed", ("surprise", 0.7));
    m.insert("astonished", ("surprise", 0.8));
    m.insert("stunned", ("surprise", 0.8));
    
    // Trust
    m.insert("trust", ("trust", 0.8));
    m.insert("confident", ("trust", 0.7));
    m.insert("secure", ("trust", 0.7));
    m.insert("reliable", ("trust", 0.6));
    m.insert("faith", ("trust", 0.8));
    
    // Anticipation
    m.insert("eager", ("anticipation", 0.7));
    m.insert("hopeful", ("anticipation", 0.7));
    m.insert("expecting", ("anticipation", 0.6));
    m.insert("looking forward", ("anticipation", 0.7));
    
    // Disgust
    m.insert("disgusted", ("disgust", 0.8));
    m.insert("repulsed", ("disgust", 0.9));
    m.insert("revolted", ("disgust", 0.9));
    m.insert("sick", ("disgust", 0.5));
    m
});

/// Negation words that flip sentiment
static NEGATION_WORDS: Lazy<Vec<&'static str>> = Lazy::new(|| {
    vec![
        "not", "no", "never", "neither", "nobody", "nothing", "nowhere",
        "don't", "doesn't", "didn't", "won't", "wouldn't", "can't", "cannot",
        "couldn't", "shouldn't", "isn't", "aren't", "wasn't", "weren't",
        "haven't", "hasn't", "hadn't", "without", "barely", "hardly",
    ]
});

/// Intensifier words that amplify sentiment
static INTENSIFIERS: Lazy<HashMap<&'static str, f32>> = Lazy::new(|| {
    let mut m = HashMap::new();
    m.insert("very", 1.5);
    m.insert("extremely", 2.0);
    m.insert("incredibly", 2.0);
    m.insert("absolutely", 2.0);
    m.insert("completely", 1.8);
    m.insert("totally", 1.8);
    m.insert("really", 1.3);
    m.insert("so", 1.3);
    m.insert("quite", 1.2);
    m.insert("rather", 1.1);
    m.insert("fairly", 1.0);
    m.insert("somewhat", 0.8);
    m.insert("slightly", 0.5);
    m.insert("barely", 0.3);
    m
});

pub struct LocalSentimentAnalyzer;

impl LocalSentimentAnalyzer {
    pub fn new() -> Self {
        Self
    }
    
    /// Analyze text sentiment using lexicon-based approach
    pub fn analyze(&self, text: &str) -> (SentimentResult, Option<EmotionBreakdown>) {
        let text_lower = text.to_lowercase();
        let words: Vec<&str> = text_lower
            .split(|c: char| !c.is_alphanumeric() && c != '\'')
            .filter(|w| !w.is_empty())
            .collect();
        
        if words.is_empty() {
            return (
                SentimentResult {
                    score: 0.0,
                    category: SentimentCategory::Neutral,
                    confidence: 0.0,
                    magnitude: 0.0,
                },
                None,
            );
        }
        
        let mut total_score = 0.0;
        let mut word_count = 0;
        let mut positive_count = 0;
        let mut negative_count = 0;
        let mut emotions_found: HashMap<String, (f32, u32)> = HashMap::new();
        
        let mut negation_active = false;
        let mut current_intensifier = 1.0_f32;
        
        for (i, word) in words.iter().enumerate() {
            // Check for negation
            if NEGATION_WORDS.iter().any(|n| n == word) {
                negation_active = true;
                continue;
            }
            
            // Check for intensifiers
            if let Some(&mult) = INTENSIFIERS.get(word) {
                current_intensifier = mult;
                continue;
            }
            
            // Check positive lexicon
            if let Some(&base_score) = POSITIVE_LEXICON.get(word) {
                let mut score = base_score * current_intensifier;
                if negation_active {
                    score = -score * 0.5; // Negation flips but reduces magnitude
                }
                total_score += score;
                word_count += 1;
                if score > 0.0 {
                    positive_count += 1;
                } else {
                    negative_count += 1;
                }
            }
            
            // Check negative lexicon
            if let Some(&base_score) = NEGATIVE_LEXICON.get(word) {
                let mut score = base_score * current_intensifier;
                if negation_active {
                    score = -score * 0.5;
                }
                total_score += score;
                word_count += 1;
                if score > 0.0 {
                    positive_count += 1;
                } else {
                    negative_count += 1;
                }
            }
            
            // Check emotions
            if let Some(&(emotion, intensity)) = EMOTION_KEYWORDS.get(word) {
                let adjusted_intensity = if negation_active {
                    intensity * 0.3
                } else {
                    intensity * current_intensifier.min(1.5)
                };
                let entry = emotions_found.entry(emotion.to_string()).or_insert((0.0, 0));
                entry.0 += adjusted_intensity;
                entry.1 += 1;
            }
            
            // Reset modifiers after a few words
            if i > 0 && (i - words.iter().take(i).rposition(|w| NEGATION_WORDS.contains(w) || INTENSIFIERS.contains_key(w)).unwrap_or(0)) > 3 {
                negation_active = false;
                current_intensifier = 1.0;
            }
        }
        
        // Calculate final sentiment
        let avg_score = if word_count > 0 {
            total_score / (word_count as f32)
        } else {
            0.0
        };
        
        // Normalize to -1 to 1 range (assuming max word score is ~5)
        let normalized_score = (avg_score / 5.0).clamp(-1.0, 1.0);
        
        // Calculate magnitude (how much emotion regardless of direction)
        let magnitude = (normalized_score.abs() * (word_count as f32).sqrt() / 3.0).clamp(0.0, 1.0);
        
        // Calculate confidence based on word matches and consistency
        let match_ratio = if !words.is_empty() {
            word_count as f32 / words.len() as f32
        } else {
            0.0
        };
        
        let consistency = if positive_count > 0 || negative_count > 0 {
            let total = (positive_count + negative_count) as f32;
            let dominant = positive_count.max(negative_count) as f32;
            dominant / total
        } else {
            0.5
        };
        
        let confidence = ((match_ratio * 0.6) + (consistency * 0.4)).clamp(0.1, 0.85); // Cap local analysis confidence
        
        // Determine category
        let category = match normalized_score {
            s if s >= 0.6 => SentimentCategory::VeryPositive,
            s if s >= 0.2 => SentimentCategory::Positive,
            s if s > -0.2 => SentimentCategory::Neutral,
            s if s > -0.6 => SentimentCategory::Negative,
            _ => SentimentCategory::VeryNegative,
        };
        
        // Check for mixed sentiment
        let category = if positive_count > 2 && negative_count > 2 && 
            (positive_count as f32 / negative_count as f32).clamp(0.3, 3.0) > 0.3 {
            SentimentCategory::Mixed
        } else {
            category
        };
        
        let sentiment = SentimentResult {
            score: normalized_score,
            category,
            confidence,
            magnitude,
        };
        
        // Build emotion breakdown
        let emotions = if !emotions_found.is_empty() {
            let mut emotion_scores: Vec<(String, f32)> = emotions_found
                .into_iter()
                .map(|(name, (total, count))| (name, total / count as f32))
                .collect();
            emotion_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
            
            let (primary_name, primary_score) = emotion_scores.remove(0);
            let secondary: Vec<Emotion> = emotion_scores
                .into_iter()
                .take(3)
                .map(|(name, score)| Emotion { name, score })
                .collect();
            
            let intensity = primary_score.clamp(0.0, 1.0);
            
            Some(EmotionBreakdown {
                primary: Emotion {
                    name: primary_name,
                    score: primary_score.clamp(0.0, 1.0),
                },
                secondary,
                intensity,
            })
        } else {
            None
        };
        
        (sentiment, emotions)
    }
}

impl Default for LocalSentimentAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_positive_sentiment() {
        let analyzer = LocalSentimentAnalyzer::new();
        let (result, _) = analyzer.analyze("I am very happy and grateful for this amazing experience!");
        assert!(result.score > 0.3);
        assert!(matches!(result.category, SentimentCategory::Positive | SentimentCategory::VeryPositive));
    }
    
    #[test]
    fn test_negative_sentiment() {
        let analyzer = LocalSentimentAnalyzer::new();
        let (result, _) = analyzer.analyze("I am feeling terrible and depressed today.");
        assert!(result.score < -0.3);
        assert!(matches!(result.category, SentimentCategory::Negative | SentimentCategory::VeryNegative));
    }
    
    #[test]
    fn test_neutral_sentiment() {
        let analyzer = LocalSentimentAnalyzer::new();
        let (result, _) = analyzer.analyze("The meeting is scheduled for tomorrow at 3pm.");
        assert!(result.score.abs() < 0.3);
        assert!(matches!(result.category, SentimentCategory::Neutral));
    }
    
    #[test]
    fn test_negation_handling() {
        let analyzer = LocalSentimentAnalyzer::new();
        let (result, _) = analyzer.analyze("I am not happy with this service.");
        assert!(result.score < 0.0);
    }
    
    #[test]
    fn test_healthcare_positive() {
        let analyzer = LocalSentimentAnalyzer::new();
        let (result, _) = analyzer.analyze("The patient is in remission and recovering well.");
        assert!(result.score > 0.5);
    }
    
    #[test]
    fn test_healthcare_negative() {
        let analyzer = LocalSentimentAnalyzer::new();
        let (result, _) = analyzer.analyze("The patient has relapsed with severe complications.");
        assert!(result.score < -0.5);
    }
    
    #[test]
    fn test_emotion_detection() {
        let analyzer = LocalSentimentAnalyzer::new();
        let (_, emotions) = analyzer.analyze("I am terrified and anxious about the results.");
        assert!(emotions.is_some());
        let emotions = emotions.unwrap();
        assert_eq!(emotions.primary.name, "fear");
    }
}
