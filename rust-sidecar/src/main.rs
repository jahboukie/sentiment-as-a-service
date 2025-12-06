//! RG-Check Compliance Engine (RCE)
//! 
//! High-performance Responsible Gambling risk detection sidecar for Ontario iGaming operators.
//! 
//! Integrates SecuraMem cryptographic infrastructure for:
//! - Ed25519 signed policy decisions (court-admissible)
//! - Immutable SHA-256 hash chain (tamper-evident)
//! - RG-Check accreditation evidence export

use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
    compression::CompressionLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod api;
mod config;
mod models;
mod services;

use config::Config;
use services::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rg_check_engine=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;
    
    tracing::info!("╔══════════════════════════════════════════════════════════════╗");
    tracing::info!("║  RG-Check Compliance Engine v{}                         ║", env!("CARGO_PKG_VERSION"));
    tracing::info!("║  Powered by SecuraMem Cryptographic Infrastructure           ║");
    tracing::info!("╚══════════════════════════════════════════════════════════════╝");
    
    if config.has_claude_api() {
        tracing::info!("Claude AI: enabled (model: {})", config.claude_model);
    } else {
        tracing::info!("Running in LOCAL_ONLY mode - sub-millisecond response times");
    }

    // Build application state
    let mut state = AppState::new(config.clone())?;
    
    // Initialize SecuraMem evidence system
    tracing::info!("Initializing SecuraMem evidence system...");
    if let Err(e) = state.init_evidence_system().await {
        tracing::warn!("Evidence system disabled: {}", e);
        tracing::warn!("Policy decisions will NOT be cryptographically signed");
    } else {
        tracing::info!("✓ Evidence system active - all policy decisions will be signed");
    }
    
    let state = Arc::new(state);

    // Build router
    let app = Router::new()
        // Health endpoints
        .route("/health", get(api::health::health_check))
        .route("/ready", get(api::health::readiness_check))
        
        // === RG-Check Compliance API v1 ===
        
        // Risk Assessment (fuses emotional + behavioral signals)
        .route("/v1/risk/score", post(api::risk_score::risk_score))
        
        // Policy Intervention (triggers RG actions)
        .route("/v1/policy/intervene", post(api::policy_intervene::policy_intervene))
        
        // Data Redaction (anonymizes PII/PHI for audits)
        .route("/v1/data/redact", post(api::anonymize::anonymize))
        
        // Emotional Signal Extraction
        .route("/v1/data/extract", post(api::emotions::analyze_emotions))
        
        // === Evidence & Audit API ===
        .route("/v1/audit/stats", get(api::audit::audit_stats))
        .route("/v1/audit/verify", get(api::audit::verify_chain))
        .route("/v1/audit/export", get(api::audit::export_evidence))
        .route("/v1/audit/public-key", get(api::audit::get_public_key))
        
        // === Legacy API (deprecated, use above) ===
        .route("/v1/analyze", post(api::sentiment::analyze))
        .route("/v1/anonymize", post(api::anonymize::anonymize))
        .route("/v1/crisis/detect", post(api::crisis::detect_crisis))
        .route("/v1/emotions", post(api::emotions::analyze_emotions))
        
        // Metrics endpoint
        .route("/metrics", get(api::metrics::get_metrics))
        
        // Add middleware
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    // Start server
    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    
    tracing::info!("🚀 RG-Check Compliance Engine ready at http://{}", addr);
    tracing::info!("   Evidence store: .rg-check/evidence.db");
    tracing::info!("   Operator key:   .rg-check/operator.key");
    
    axum::serve(listener, app).await?;

    Ok(())
}
