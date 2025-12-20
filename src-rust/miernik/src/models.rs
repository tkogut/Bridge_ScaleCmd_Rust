//! Device models and data structures

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Weight reading from scale
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightReading {
    pub gross_weight: f64,
    pub net_weight: f64,
    pub unit: String,
    pub is_stable: bool,
    pub timestamp: DateTime<Utc>,
}

/// Device configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConfig {
    pub name: String,
    pub manufacturer: String,
    pub model: String,
    pub protocol: String,
    pub commands: HashMap<String, String>,
    pub enabled: bool,
}

