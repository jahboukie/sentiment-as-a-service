//! Sentiment Sidecar - Emotional Guardrails for AI Agents
//! 
//! A high-performance Rust service that provides sentiment analysis,
//! crisis detection, and text anonymization for LLM-powered applications.

pub mod api;
pub mod config;
pub mod models;
pub mod services;

pub use config::Config;
pub use models::*;
pub use services::*;
