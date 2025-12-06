//! Metrics and statistics endpoint

use axum::{
    extract::State,
    Json,
};
use std::sync::Arc;
use serde::Serialize;

use crate::services::AppState;

/// GET /metrics - Service metrics and statistics
pub async fn get_metrics(
    State(state): State<Arc<AppState>>,
) -> Json<MetricsResponse> {
    let cache_stats = state.cache.stats();
    
    Json(MetricsResponse {
        service: ServiceInfo {
            name: "sentiment-sidecar",
            version: env!("CARGO_PKG_VERSION"),
            uptime_seconds: 0, // TODO: Track actual uptime
        },
        cache: CacheMetrics {
            analysis_entries: cache_stats.analysis_entries,
            anonymization_entries: cache_stats.anonymization_entries,
            rate_limit_entries: cache_stats.rate_limit_entries,
        },
        claude_api: ClaudeMetrics {
            available: state.claude_client.is_some(),
            model: state.config.claude_model.clone(),
        },
    })
}

#[derive(Serialize)]
pub struct MetricsResponse {
    pub service: ServiceInfo,
    pub cache: CacheMetrics,
    pub claude_api: ClaudeMetrics,
}

#[derive(Serialize)]
pub struct ServiceInfo {
    pub name: &'static str,
    pub version: &'static str,
    pub uptime_seconds: u64,
}

#[derive(Serialize)]
pub struct CacheMetrics {
    pub analysis_entries: u64,
    pub anonymization_entries: u64,
    pub rate_limit_entries: u64,
}

#[derive(Serialize)]
pub struct ClaudeMetrics {
    pub available: bool,
    pub model: String,
}
