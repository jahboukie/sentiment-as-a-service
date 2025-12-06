//! SecuraMem Dashboard - Tauri-based Executive Compliance UI
//!
//! This crate provides the embedded dashboard for SecuraMem, launched via
//! `smrust dashboard`. It uses Tauri 2.0 for the native window with a
//! React/TypeScript frontend.
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                    TAURI APPLICATION                        │
//! ├─────────────────────────────────────────────────────────────┤
//! │  ┌─────────────────────────────────────────────────────┐   │
//! │  │              WEB FRONTEND (WebView)                  │   │
//! │  │  • React 18 + TypeScript                            │   │
//! │  │  • Tailwind CSS                                     │   │
//! │  │  • Recharts (visualization)                         │   │
//! │  └─────────────────────────────────────────────────────┘   │
//! │                          │                                  │
//! │                    Tauri IPC Bridge                         │
//! │                          │                                  │
//! │  ┌─────────────────────────────────────────────────────┐   │
//! │  │              RUST BACKEND (This Crate)               │   │
//! │  │  • IPC Commands (get_audit_stats, get_compliance)   │   │
//! │  │  • Database queries via securamem-storage           │   │
//! │  │  • PDF generation via typst                         │   │
//! │  └─────────────────────────────────────────────────────┘   │
//! └─────────────────────────────────────────────────────────────┘
//! ```

pub mod commands;
pub mod demo_data;
pub mod golden_demo;
pub mod pdf_report;
pub mod state;

use std::path::PathBuf;
use std::sync::Arc;
use tracing::info;

use securamem_storage::Database;
use state::DashboardState;

/// Configuration for the dashboard
#[derive(Debug, Clone)]
pub struct DashboardConfig {
    /// Port for the internal IPC server (not exposed externally)
    pub port: u16,
    /// Whether to run in demo mode with synthetic data
    pub demo_mode: bool,
    /// Path to the database
    pub db_path: PathBuf,
}

impl Default for DashboardConfig {
    fn default() -> Self {
        Self {
            port: 9430,
            demo_mode: false,
            db_path: PathBuf::from(".securamemrust/memory.db"),
        }
    }
}

/// Start the dashboard application
///
/// This is the main entry point called by `smrust dashboard`.
/// It initializes Tauri with the dashboard window and IPC handlers.
///
/// ## Demo Mode vs Production Mode
///
/// - **Production mode** (default): Uses the real database at `db_path`.
///   Fresh installs start with an empty database, ready for real data.
///
/// - **Demo mode** (`--demo` flag): Creates a temporary demo database with
///   curated synthetic data for sales demos and presentations. The demo
///   database is isolated from production data.
pub async fn start_dashboard(config: DashboardConfig) -> anyhow::Result<()> {
    info!("Starting SecuraMem Dashboard...");
    info!("  Database: {:?}", config.db_path);
    info!("  Demo mode: {}", config.demo_mode);

    // Determine which database to use
    let (db, effective_db_path) = if config.demo_mode {
        info!("Loading demo database...");
        
        // Demo mode: Create temporary demo database
        let demo_db_path = get_demo_db_path()?;
        
        // Create/refresh golden demo database
        if !demo_db_path.exists() || should_refresh_demo_db(&demo_db_path) {
            info!("Creating golden demo database at {:?}", demo_db_path);
            golden_demo::create_golden_demo_database(&demo_db_path).await?;
        }
        
        // Open demo database WITHOUT running migrations (schema is already set up)
        let db = Database::open_without_migrations(&demo_db_path).await?;
        (db, demo_db_path)
    } else {
        // Production mode: Use real database with migrations
        let db = Database::init(&config.db_path).await?;
        (db, config.db_path.clone())
    };

    let db_path_str = effective_db_path.to_string_lossy().to_string();
    let state = DashboardState::new(Arc::new(db), config.demo_mode, db_path_str);

    // Build and run Tauri application
    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::get_audit_stats,
            commands::get_audit_entries,
            commands::get_compliance_status,
            commands::get_threat_events,
            commands::get_system_health,
            commands::export_pdf_report,
            commands::submit_attestation,
            commands::get_demo_entries,
            commands::simulate_attack,
        ])
        .setup(|_app| {
            info!("Dashboard window initialized");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Failed to run Tauri application");

    Ok(())
}

/// Get the path to the demo database (in temp directory)
fn get_demo_db_path() -> anyhow::Result<PathBuf> {
    let temp_dir = std::env::temp_dir();
    let demo_dir = temp_dir.join("securamem_demo");
    std::fs::create_dir_all(&demo_dir)?;
    Ok(demo_dir.join("golden_demo.db"))
}

/// Check if demo database should be refreshed (older than 1 hour)
fn should_refresh_demo_db(path: &PathBuf) -> bool {
    if let Ok(metadata) = std::fs::metadata(path) {
        if let Ok(modified) = metadata.modified() {
            if let Ok(elapsed) = modified.elapsed() {
                // Refresh if older than 1 hour
                return elapsed.as_secs() > 3600;
            }
        }
    }
    true
}

/// Check if the dashboard feature is available
///
/// Returns false if compiled without Tauri support (headless mode).
pub fn is_dashboard_available() -> bool {
    true
}
