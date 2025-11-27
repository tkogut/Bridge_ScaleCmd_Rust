use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "connection_type")]
pub enum Connection {
    Tcp {
        host: String,
        port: u16,
        timeout_ms: u32,
    },
    Serial {
        port: String,
        baud_rate: u32,
        timeout_ms: u32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConfig {
    pub name: String,
    pub manufacturer: String,
    pub model: String,
    pub protocol: String,
    pub connection: Connection,
    pub commands: HashMap<String, String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub devices: HashMap<String, DeviceConfig>,
}

#[derive(Debug, Deserialize)]
pub struct SaveConfigRequest {
    pub device_id: String,
    pub config: DeviceConfig,
}
