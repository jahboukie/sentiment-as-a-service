//! Health check endpoint

use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub version: &'static str,
    pub service: &'static str,
}

/// GET /health - Basic health check
pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy",
        version: env!("CARGO_PKG_VERSION"),
        service: "sentiment-sidecar",
    })
}

/// GET /ready - Readiness probe (checks dependencies)
pub async fn readiness_check() -> Json<ReadinessResponse> {
    // In production, check Claude API connectivity, cache health, etc.
    Json(ReadinessResponse {
        ready: true,
        checks: vec![
            HealthCheck { name: "cache", status: "ok" },
            HealthCheck { name: "local_analyzer", status: "ok" },
        ],
    })
}

#[derive(Serialize)]
pub struct ReadinessResponse {
    pub ready: bool,
    pub checks: Vec<HealthCheck>,
}

#[derive(Serialize)]
pub struct HealthCheck {
    pub name: &'static str,
    pub status: &'static str,
}
