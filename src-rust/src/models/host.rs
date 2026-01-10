//! Host configuration models

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::models::device::{ConnectionConfig, default_timeout_ms, DeviceConfig};
use crate::models::miernik::MiernikConfig;

/// Host configuration - represents a connection (TCP or Serial)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostConfig {
    pub name: String,
    pub connection: ConnectionConfig,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u32,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

/// Application configuration with hosts, mierniki, and devices
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub hosts: HashMap<String, HostConfig>,
    #[serde(default)]
    pub mierniki: HashMap<String, MiernikConfig>,
    #[serde(default)]
    pub devices: HashMap<String, DeviceConfig>,
}

#[derive(Debug, Deserialize)]
pub struct SaveHostRequest {
    pub host_id: String,
    pub config: HostConfig,
}

// DeviceConfig is in device.rs

