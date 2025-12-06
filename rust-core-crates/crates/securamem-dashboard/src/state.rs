//! Dashboard application state
//!
//! Shared state passed to all Tauri IPC commands.

use std::sync::Arc;
use std::time::Instant;
use securamem_storage::Database;

/// Shared state for the dashboard application
#[derive(Clone)]
pub struct DashboardState {
    /// Database connection
    pub db: Arc<Database>,
    /// Whether running in demo mode
    pub demo_mode: bool,
    /// Application start time for uptime calculation
    pub start_time: Instant,
    /// Database file path for size calculation
    pub db_path: String,
}

impl DashboardState {
    /// Create a new dashboard state
    pub fn new(db: Arc<Database>, demo_mode: bool, db_path: String) -> Self {
        Self { 
            db, 
            demo_mode,
            start_time: Instant::now(),
            db_path,
        }
    }
    
    /// Get uptime in seconds
    pub fn uptime_seconds(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }
    
    /// Get database file size in MB
    pub fn db_size_mb(&self) -> f64 {
        std::fs::metadata(&self.db_path)
            .map(|m| m.len() as f64 / (1024.0 * 1024.0))
            .unwrap_or(0.0)
    }
}
