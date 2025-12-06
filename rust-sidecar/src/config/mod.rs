//! Configuration management

use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    /// Server host
    #[serde(default = "default_host")]
    pub host: String,
    
    /// Server port
    #[serde(default = "default_port")]
    pub port: u16,
    
    /// Claude API key
    pub anthropic_api_key: Option<String>,
    
    /// Claude model to use
    #[serde(default = "default_model")]
    pub claude_model: String,
    
    /// Cache TTL in seconds
    #[serde(default = "default_cache_ttl")]
    pub cache_ttl_secs: u64,
    
    /// Maximum cache entries
    #[serde(default = "default_cache_max_entries")]
    pub cache_max_entries: u64,
    
    /// Rate limit: requests per second
    #[serde(default = "default_rate_limit")]
    pub rate_limit_per_second: u32,
    
    /// Enable local-only mode (no Claude API calls)
    #[serde(default)]
    pub local_only: bool,
}

fn default_host() -> String {
    "0.0.0.0".to_string()
}

fn default_port() -> u16 {
    3030
}

fn default_model() -> String {
    "claude-sonnet-4-20250514".to_string()
}

fn default_cache_ttl() -> u64 {
    3600 // 1 hour
}

fn default_cache_max_entries() -> u64 {
    10_000
}

fn default_rate_limit() -> u32 {
    100
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let config = Config {
            host: std::env::var("HOST").unwrap_or_else(|_| default_host()),
            port: std::env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or_else(default_port),
            anthropic_api_key: std::env::var("ANTHROPIC_API_KEY").ok(),
            claude_model: std::env::var("CLAUDE_MODEL").unwrap_or_else(|_| default_model()),
            cache_ttl_secs: std::env::var("CACHE_TTL_SECS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_cache_ttl),
            cache_max_entries: std::env::var("CACHE_MAX_ENTRIES")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_cache_max_entries),
            rate_limit_per_second: std::env::var("RATE_LIMIT_PER_SECOND")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(default_rate_limit),
            local_only: std::env::var("LOCAL_ONLY")
                .map(|v| v == "true" || v == "1")
                .unwrap_or(false),
        };
        
        if config.anthropic_api_key.is_none() && !config.local_only {
            tracing::warn!("No ANTHROPIC_API_KEY set - running in local-only mode");
        }
        
        Ok(config)
    }
    
    pub fn has_claude_api(&self) -> bool {
        self.anthropic_api_key.is_some() && !self.local_only
    }
}
