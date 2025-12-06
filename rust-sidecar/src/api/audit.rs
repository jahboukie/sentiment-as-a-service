//! Audit API - RG-Check Evidence Access for Auditors
//!
//! Provides endpoints for RG-Check accreditation auditors to:
//! - Verify chain integrity
//! - Export evidence bundles
//! - Access operator public key for signature verification

use axum::{
    extract::{State, Query},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::models::ApiResponse;
use crate::services::AppState;

/// Query parameters for evidence export
#[derive(Debug, Deserialize)]
pub struct ExportQuery {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

/// GET /v1/audit/stats - Get audit statistics
pub async fn audit_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<AuditStatsResponse>>, (StatusCode, Json<ApiResponse<()>>)> {
    let orchestrator = state.audit_orchestrator.as_ref()
        .ok_or_else(|| (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ApiResponse::error("Evidence system not initialized")),
        ))?;
    
    let stats = orchestrator.get_stats().await
        .map_err(|e| (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::error(&format!("Failed to get stats: {}", e))),
        ))?;
    
    Ok(Json(ApiResponse::success(AuditStatsResponse {
        total_entries: stats.total_entries,
        chain_valid: stats.chain_valid,
        last_hash: stats.last_hash,
        operator_key_id: stats.key_id,
        evidence_system: "SecuraMem".to_string(),
        hash_algorithm: "SHA-256".to_string(),
        signature_algorithm: "Ed25519".to_string(),
    })))
}

#[derive(Debug, Serialize)]
pub struct AuditStatsResponse {
    pub total_entries: i64,
    pub chain_valid: bool,
    pub last_hash: String,
    pub operator_key_id: String,
    pub evidence_system: String,
    pub hash_algorithm: String,
    pub signature_algorithm: String,
}

/// GET /v1/audit/verify - Verify chain integrity
pub async fn verify_chain(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<ChainVerifyResponse>>, (StatusCode, Json<ApiResponse<()>>)> {
    let orchestrator = state.audit_orchestrator.as_ref()
        .ok_or_else(|| (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ApiResponse::error("Evidence system not initialized")),
        ))?;
    
    let verification = orchestrator.verify_integrity().await
        .map_err(|e| (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::error(&format!("Verification failed: {}", e))),
        ))?;
    
    let status = if verification.is_valid {
        "CHAIN_INTACT"
    } else {
        "CHAIN_BROKEN"
    };
    
    Ok(Json(ApiResponse::success(ChainVerifyResponse {
        status: status.to_string(),
        total_entries: verification.total_entries,
        is_valid: verification.is_valid,
        broken_links: verification.broken_links,
        last_hash: verification.last_hash,
        verified_at: chrono::Utc::now().to_rfc3339(),
    })))
}

#[derive(Debug, Serialize)]
pub struct ChainVerifyResponse {
    pub status: String,
    pub total_entries: i64,
    pub is_valid: bool,
    pub broken_links: Vec<i64>,
    pub last_hash: String,
    pub verified_at: String,
}

/// GET /v1/audit/export - Export evidence for RG-Check auditors
pub async fn export_evidence(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ExportQuery>,
) -> Result<String, (StatusCode, Json<ApiResponse<()>>)> {
    let orchestrator = state.audit_orchestrator.as_ref()
        .ok_or_else(|| (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ApiResponse::error("Evidence system not initialized")),
        ))?;
    
    let export = orchestrator.export_for_rgcheck(
        query.start_date.as_deref(),
        query.end_date.as_deref(),
    ).await.map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ApiResponse::error(&format!("Export failed: {}", e))),
    ))?;
    
    // Return as JSON Lines (NDJSON)
    Ok(export)
}

/// GET /v1/audit/public-key - Get operator public key for signature verification
pub async fn get_public_key(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<PublicKeyResponse>>, (StatusCode, Json<ApiResponse<()>>)> {
    let orchestrator = state.audit_orchestrator.as_ref()
        .ok_or_else(|| (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ApiResponse::error("Evidence system not initialized")),
        ))?;
    
    let public_key_pem = orchestrator.get_public_key_pem()
        .map_err(|e| (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::error(&format!("Failed to export public key: {}", e))),
        ))?;
    
    let stats = orchestrator.get_stats().await
        .map_err(|e| (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::error(&format!("Failed to get key info: {}", e))),
        ))?;
    
    Ok(Json(ApiResponse::success(PublicKeyResponse {
        key_id: stats.key_id,
        algorithm: "Ed25519".to_string(),
        public_key_pem,
        usage: "RG-Check policy decision signatures".to_string(),
        instructions: "Use this public key to verify signatures on audit log entries. \
            Each entry's 'signature' field is a base64-encoded Ed25519 signature of \
            the 'audit_data' JSON string.".to_string(),
    })))
}

#[derive(Debug, Serialize)]
pub struct PublicKeyResponse {
    pub key_id: String,
    pub algorithm: String,
    pub public_key_pem: String,
    pub usage: String,
    pub instructions: String,
}
