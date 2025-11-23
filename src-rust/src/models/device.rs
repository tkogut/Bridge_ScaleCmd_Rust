use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConnectionType {
    Tcp,
    Serial,
    Usb,
    Bluetooth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub connection_type: ConnectionType,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub path: Option<String>, // For serial ports like /dev/ttyUSB0 or COM1
    pub baud_rate: Option<u32>, // For serial ports
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandConfig {
    pub read_gross: String,
    pub read_net: String,
    pub tare: String,
    pub zero: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConfig {
    pub name: String,
    pub manufacturer: String,
    pub model: String,
    pub protocol: String,
    pub connection: ConnectionConfig,
    pub commands: CommandConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub devices: HashMap<String, DeviceConfig>,
}