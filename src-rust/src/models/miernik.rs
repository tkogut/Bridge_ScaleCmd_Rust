//! Miernik (Indicator) configuration models

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Miernik configuration - represents a protocol/indicator type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiernikConfig {
    pub name: String,
    pub protocol: String,
    pub manufacturer: String,
    pub model: String,
    pub commands: HashMap<String, String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

#[derive(Debug, Deserialize)]
pub struct SaveMiernikRequest {
    pub miernik_id: String,
    pub config: MiernikConfig,
}

