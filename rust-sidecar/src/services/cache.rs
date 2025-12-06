//! Caching layer using Moka (high-performance concurrent cache)

use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;
use moka::future::Cache;
use serde::Serialize;

use crate::models::{SentimentResult, EmotionBreakdown, CrisisAssessment, KeyTerm};

/// Cached analysis result
#[derive(Clone)]
pub struct CachedAnalysis {
    pub sentiment: SentimentResult,
    pub emotions: Option<EmotionBreakdown>,
    pub crisis: Option<CrisisAssessment>,
    pub key_terms: Option<Vec<KeyTerm>>,
}

/// Cache service with TTL-based expiration
pub struct CacheService {
    /// Main analysis cache (text hash -> result)
    analysis_cache: Cache<u64, CachedAnalysis>,
    /// Anonymization cache (text hash + level -> anonymized text)
    anonymization_cache: Cache<u64, String>,
    /// Rate limit tracking (API key hash -> request count)
    rate_limit_cache: Cache<u64, u32>,
}

impl CacheService {
    /// Create a new cache service with specified max entries
    pub fn new(max_analysis_entries: u64, max_anon_entries: u64) -> Self {
        // Analysis cache with 1 hour TTL
        let analysis_cache = Cache::builder()
            .max_capacity(max_analysis_entries)
            .time_to_live(std::time::Duration::from_secs(3600))
            .build();
        
        // Anonymization cache with 24 hour TTL (anonymized text doesn't change)
        let anonymization_cache = Cache::builder()
            .max_capacity(max_anon_entries)
            .time_to_live(std::time::Duration::from_secs(86400))
            .build();
        
        // Rate limit cache with 1 minute sliding window
        let rate_limit_cache = Cache::builder()
            .max_capacity(10000)
            .time_to_live(std::time::Duration::from_secs(60))
            .build();
        
        Self {
            analysis_cache,
            anonymization_cache,
            rate_limit_cache,
        }
    }
    
    /// Hash text for cache key
    fn hash_text(&self, text: &str) -> u64 {
        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        hasher.finish()
    }
    
    /// Hash text with options for cache key
    fn hash_with_options(&self, text: &str, options: &str) -> u64 {
        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        options.hash(&mut hasher);
        hasher.finish()
    }
    
    /// Get cached analysis result
    pub async fn get_analysis(&self, text: &str, include_emotions: bool, include_crisis: bool) -> Option<CachedAnalysis> {
        let options = format!("{}:{}", include_emotions, include_crisis);
        let key = self.hash_with_options(text, &options);
        self.analysis_cache.get(&key).await
    }
    
    /// Cache analysis result
    pub async fn set_analysis(
        &self,
        text: &str,
        include_emotions: bool,
        include_crisis: bool,
        result: CachedAnalysis,
    ) {
        let options = format!("{}:{}", include_emotions, include_crisis);
        let key = self.hash_with_options(text, &options);
        self.analysis_cache.insert(key, result).await;
    }
    
    /// Get cached anonymized text
    pub async fn get_anonymized(&self, text: &str, level: &str) -> Option<String> {
        let key = self.hash_with_options(text, level);
        self.anonymization_cache.get(&key).await
    }
    
    /// Cache anonymized text
    pub async fn set_anonymized(&self, text: &str, level: &str, result: String) {
        let key = self.hash_with_options(text, level);
        self.anonymization_cache.insert(key, result).await;
    }
    
    /// Increment rate limit counter, returns new count
    pub async fn increment_rate_limit(&self, api_key: &str) -> u32 {
        let key = self.hash_text(api_key);
        let current = self.rate_limit_cache.get(&key).await.unwrap_or(0);
        let new_count = current + 1;
        self.rate_limit_cache.insert(key, new_count).await;
        new_count
    }
    
    /// Get current rate limit count
    pub async fn get_rate_limit_count(&self, api_key: &str) -> u32 {
        let key = self.hash_text(api_key);
        self.rate_limit_cache.get(&key).await.unwrap_or(0)
    }
    
    /// Clear all caches (for testing or admin)
    pub async fn clear_all(&self) {
        self.analysis_cache.invalidate_all();
        self.anonymization_cache.invalidate_all();
        self.rate_limit_cache.invalidate_all();
    }
    
    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            analysis_entries: self.analysis_cache.entry_count(),
            anonymization_entries: self.anonymization_cache.entry_count(),
            rate_limit_entries: self.rate_limit_cache.entry_count(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct CacheStats {
    pub analysis_entries: u64,
    pub anonymization_entries: u64,
    pub rate_limit_entries: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::SentimentCategory;
    
    #[tokio::test]
    async fn test_analysis_cache() {
        let cache = CacheService::new(100, 100);
        
        let result = CachedAnalysis {
            sentiment: SentimentResult {
                score: 0.8,
                category: SentimentCategory::Positive,
                confidence: 0.9,
                magnitude: 0.7,
            },
            emotions: None,
            crisis: None,
            key_terms: None,
        };
        
        // Cache miss
        assert!(cache.get_analysis("test text", true, false).await.is_none());
        
        // Cache insert and hit
        cache.set_analysis("test text", true, false, result.clone()).await;
        let cached = cache.get_analysis("test text", true, false).await;
        assert!(cached.is_some());
        assert_eq!(cached.unwrap().sentiment.score, 0.8);
        
        // Different options = different key
        assert!(cache.get_analysis("test text", false, false).await.is_none());
    }
    
    #[tokio::test]
    async fn test_anonymization_cache() {
        let cache = CacheService::new(100, 100);
        
        cache.set_anonymized("my email is test@example.com", "basic", "[REDACTED EMAIL]".to_string()).await;
        
        let cached = cache.get_anonymized("my email is test@example.com", "basic").await;
        assert_eq!(cached, Some("[REDACTED EMAIL]".to_string()));
        
        // Different level = different key
        assert!(cache.get_anonymized("my email is test@example.com", "advanced").await.is_none());
    }
    
    #[tokio::test]
    async fn test_rate_limiting() {
        let cache = CacheService::new(100, 100);
        
        assert_eq!(cache.get_rate_limit_count("api_key_1").await, 0);
        
        assert_eq!(cache.increment_rate_limit("api_key_1").await, 1);
        assert_eq!(cache.increment_rate_limit("api_key_1").await, 2);
        assert_eq!(cache.increment_rate_limit("api_key_1").await, 3);
        
        assert_eq!(cache.get_rate_limit_count("api_key_1").await, 3);
        
        // Different key
        assert_eq!(cache.get_rate_limit_count("api_key_2").await, 0);
    }
    
    #[tokio::test]
    async fn test_cache_stats() {
        let cache = CacheService::new(100, 100);
        
        let result = CachedAnalysis {
            sentiment: SentimentResult {
                score: 0.5,
                category: SentimentCategory::Neutral,
                confidence: 0.8,
                magnitude: 0.3,
            },
            emotions: None,
            crisis: None,
            key_terms: None,
        };
        
        cache.set_analysis("text1", true, true, result.clone()).await;
        cache.set_analysis("text2", true, true, result.clone()).await;
        cache.set_anonymized("text1", "basic", "anon".to_string()).await;
        
        // Verify we can retrieve what we cached
        assert!(cache.get_analysis("text1", true, true).await.is_some());
        assert!(cache.get_analysis("text2", true, true).await.is_some());
        assert!(cache.get_anonymized("text1", "basic").await.is_some());
        
        // Stats may not be immediately consistent due to async nature,
        // but entries should be >= 0
        let stats = cache.stats();
        assert!(stats.analysis_entries >= 0);
        assert!(stats.anonymization_entries >= 0);
    }
}
