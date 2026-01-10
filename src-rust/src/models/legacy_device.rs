//! Legacy device configuration models for migration

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::models::device::ConnectionConfig;

/// Legacy DeviceConfig with connection and protocol (old format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacyDeviceConfig {
    pub name: String,
    pub manufacturer: String,
    pub model: String,
    pub protocol: String,
    pub connection: ConnectionConfig,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u32,
    pub commands: HashMap<String, String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_timeout_ms() -> u32 {
    1000
}

fn default_enabled() -> bool {
    true
}

/// Legacy AppConfig (old format - only devices)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacyAppConfig {
    pub devices: HashMap<String, LegacyDeviceConfig>,
}

