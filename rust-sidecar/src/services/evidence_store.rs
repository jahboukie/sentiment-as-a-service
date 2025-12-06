//! Evidence Store - Immutable Hash-Chain Audit Log
//! 
//! Ported from SecuraMem Storage for RG-Check compliance.
//! SQLite WAL-mode database with cryptographic hash chaining.

use anyhow::Result;
use sqlx::sqlite::{SqlitePool, SqliteConnectOptions, SqliteJournalMode, SqliteSynchronous};
use sqlx::Row;
use std::path::Path;
use std::str::FromStr;
use futures::StreamExt;
use serde::{Deserialize, Serialize};

use super::crypto::compute_hash_chain_link;

/// Evidence database for RG-Check audit trail
pub struct EvidenceStore {
    pool: SqlitePool,
}

impl EvidenceStore {
    /// Initialize the evidence store with migrations
    pub async fn init(db_path: &Path) -> Result<Self> {
        // Ensure directory exists
        if let Some(parent) = db_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        
        // Configure SQLite for compliance
        // WAL mode: high concurrency, crash-safe
        // Synchronous Normal: good durability without perf hit
        let options = SqliteConnectOptions::from_str(db_path.to_str().unwrap())?
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal);
        
        let pool = SqlitePool::connect_with(options).await?;
        
        // Run migrations
        Self::run_migrations(&pool).await?;
        
        tracing::info!("Evidence store initialized at {:?}", db_path);
        
        Ok(Self { pool })
    }
    
    /// Run database migrations
    async fn run_migrations(pool: &SqlitePool) -> Result<()> {
        // Create audit log table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_id TEXT NOT NULL UNIQUE,
                timestamp TEXT NOT NULL,
                actor_id TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                audit_data TEXT NOT NULL,
                prev_hash TEXT,
                entry_hash TEXT NOT NULL,
                signature TEXT NOT NULL,
                signature_key_id TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        "#).execute(pool).await?;
        
        // Create index for fast lookups
        sqlx::query(r#"
            CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)
        "#).execute(pool).await?;
        
        sqlx::query(r#"
            CREATE INDEX IF NOT EXISTS idx_audit_operation ON audit_log(operation_type)
        "#).execute(pool).await?;
        
        // Check if genesis block exists
        let genesis_exists: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM audit_log WHERE operation_type = 'genesis'"
        ).fetch_one(pool).await?;
        
        if genesis_exists.0 == 0 {
            // Create genesis block
            let genesis_data = serde_json::json!({
                "message": "RG-Check Compliance Engine Genesis Block",
                "version": env!("CARGO_PKG_VERSION"),
                "created": chrono::Utc::now().to_rfc3339()
            });
            
            let data_str = genesis_data.to_string();
            let genesis_hash = compute_hash_chain_link(None, data_str.as_bytes());
            
            sqlx::query(r#"
                INSERT INTO audit_log (
                    receipt_id, timestamp, actor_id, operation_type,
                    audit_data, prev_hash, entry_hash, signature, signature_key_id
                ) VALUES (?, ?, ?, ?, ?, NULL, ?, 'GENESIS', 'GENESIS')
            "#)
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(chrono::Utc::now().to_rfc3339())
            .bind("SYSTEM")
            .bind("genesis")
            .bind(&data_str)
            .bind(&genesis_hash)
            .execute(pool)
            .await?;
            
            tracing::info!("Created genesis block: {:.16}...", genesis_hash);
        }
        
        Ok(())
    }
    
    /// Append a new entry to the hash chain
    /// 
    /// This is the critical function for RG-Check compliance:
    /// 1. Retrieves the last entry's hash
    /// 2. Computes SHA256(prev_hash || canonical_data)
    /// 3. Inserts the new immutable record
    pub async fn append(
        &self,
        receipt_id: &str,
        actor_id: &str,
        operation: &str,
        data: serde_json::Value,
        signature: &str,
        key_id: &str,
    ) -> Result<String> {
        // 1. Get the last hash (the "link")
        let last_row = sqlx::query("SELECT entry_hash FROM audit_log ORDER BY id DESC LIMIT 1")
            .fetch_optional(&self.pool)
            .await?;
        
        let prev_hash = match last_row {
            Some(row) => Some(row.get::<String, _>("entry_hash")),
            None => return Err(anyhow::anyhow!("Genesis block missing!")),
        };
        
        // 2. Compute the new hash (the "anchor")
        let canonical_data = data.to_string();
        let entry_hash = compute_hash_chain_link(
            prev_hash.as_deref(),
            canonical_data.as_bytes()
        );
        
        let timestamp = chrono::Utc::now().to_rfc3339();
        
        // 3. Insert the immutable record
        sqlx::query(r#"
            INSERT INTO audit_log (
                receipt_id, timestamp, actor_id, operation_type,
                audit_data, prev_hash, entry_hash, signature, signature_key_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#)
        .bind(receipt_id)
        .bind(&timestamp)
        .bind(actor_id)
        .bind(operation)
        .bind(&canonical_data)
        .bind(&prev_hash)
        .bind(&entry_hash)
        .bind(signature)
        .bind(key_id)
        .execute(&self.pool)
        .await?;
        
        tracing::debug!(
            "Logged evidence: {} | {} | hash: {:.16}...",
            receipt_id, operation, entry_hash
        );
        
        Ok(entry_hash)
    }
    
    /// Verify the entire hash chain integrity
    /// 
    /// Re-calculates every hash from genesis to prove:
    /// - No entries were deleted
    /// - No entries were modified
    /// - Chain linkage is intact
    pub async fn verify_chain(&self) -> Result<ChainVerification> {
        let mut rows = sqlx::query("SELECT * FROM audit_log ORDER BY id ASC")
            .fetch(&self.pool);
        
        let mut expected_prev_hash: Option<String> = None;
        let mut entry_count = 0;
        let mut broken_links = vec![];
        let mut last_hash = String::new();
        
        while let Some(row_result) = rows.next().await {
            let row = row_result?;
            
            let id: i64 = row.get("id");
            let operation: String = row.get("operation_type");
            let stored_prev: Option<String> = row.get("prev_hash");
            let stored_hash: String = row.get("entry_hash");
            let data_str: String = row.get("audit_data");
            
            entry_count += 1;
            
            // 1. Check chain linkage
            if stored_prev != expected_prev_hash {
                tracing::error!(
                    "BROKEN CHAIN at ID {}: Expected prev={:?}, Got prev={:?}",
                    id, expected_prev_hash, stored_prev
                );
                broken_links.push(id);
            }
            
            // 2. Re-calculate hash (proof of integrity)
            if operation != "genesis" {
                let recalc_hash = compute_hash_chain_link(
                    expected_prev_hash.as_deref(),
                    data_str.as_bytes()
                );
                
                if recalc_hash != stored_hash {
                    tracing::error!(
                        "TAMPER DETECTED at ID {}: Expected hash={}, Got hash={}",
                        id, recalc_hash, stored_hash
                    );
                    broken_links.push(id);
                }
            }
            
            // Set up for next iteration
            last_hash = stored_hash.clone();
            expected_prev_hash = Some(stored_hash);
        }
        
        let is_valid = broken_links.is_empty();
        
        if is_valid {
            tracing::info!("✓ Chain verified: {} entries intact", entry_count);
        } else {
            tracing::error!("✗ Chain broken at {} locations", broken_links.len());
        }
        
        Ok(ChainVerification {
            total_entries: entry_count,
            is_valid,
            broken_links,
            last_hash,
        })
    }
    
    /// Get the count of audit entries (excluding genesis)
    pub async fn count_entries(&self) -> Result<i64> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM audit_log WHERE operation_type != 'genesis'"
        ).fetch_one(&self.pool).await?;
        
        Ok(row.0)
    }
    
    /// Get recent audit entries for monitoring
    pub async fn get_recent_entries(&self, limit: i64) -> Result<Vec<AuditEntry>> {
        let rows = sqlx::query(r#"
            SELECT receipt_id, timestamp, actor_id, operation_type, entry_hash
            FROM audit_log
            WHERE operation_type != 'genesis'
            ORDER BY id DESC
            LIMIT ?
        "#)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        
        let entries = rows.iter().map(|row| AuditEntry {
            receipt_id: row.get("receipt_id"),
            timestamp: row.get("timestamp"),
            actor_id: row.get("actor_id"),
            operation_type: row.get("operation_type"),
            entry_hash: row.get("entry_hash"),
        }).collect();
        
        Ok(entries)
    }
    
    /// Export audit log for RG-Check auditors (JSON Lines format)
    pub async fn export_for_audit(&self, start_date: Option<&str>, end_date: Option<&str>) -> Result<String> {
        let query = match (start_date, end_date) {
            (Some(start), Some(end)) => {
                format!(
                    "SELECT * FROM audit_log WHERE timestamp >= '{}' AND timestamp <= '{}' ORDER BY id ASC",
                    start, end
                )
            }
            _ => "SELECT * FROM audit_log ORDER BY id ASC".to_string(),
        };
        
        let rows = sqlx::query(&query)
            .fetch_all(&self.pool)
            .await?;
        
        let mut output = String::new();
        for row in rows {
            let entry = serde_json::json!({
                "id": row.get::<i64, _>("id"),
                "receipt_id": row.get::<String, _>("receipt_id"),
                "timestamp": row.get::<String, _>("timestamp"),
                "actor_id": row.get::<String, _>("actor_id"),
                "operation_type": row.get::<String, _>("operation_type"),
                "audit_data": row.get::<String, _>("audit_data"),
                "prev_hash": row.get::<Option<String>, _>("prev_hash"),
                "entry_hash": row.get::<String, _>("entry_hash"),
                "signature": row.get::<String, _>("signature"),
                "signature_key_id": row.get::<String, _>("signature_key_id"),
            });
            output.push_str(&entry.to_string());
            output.push('\n');
        }
        
        Ok(output)
    }
}

/// Result of chain verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainVerification {
    pub total_entries: i64,
    pub is_valid: bool,
    pub broken_links: Vec<i64>,
    pub last_hash: String,
}

/// Audit entry summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub receipt_id: String,
    pub timestamp: String,
    pub actor_id: String,
    pub operation_type: String,
    pub entry_hash: String,
}
