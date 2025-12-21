use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Parity {
    None,
    Even,
    Odd,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StopBits {
    One,
    Two,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FlowControl {
    None,
    Software,
    Hardware,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionType {
    Tcp,
    Serial,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "connection_type")]
pub enum ConnectionConfig {
    Tcp {
        #[serde(default = "default_tcp_host")]
        host: String,
        #[serde(default = "default_tcp_port")]
        port: u16,
    },
    Serial {
        #[serde(default = "default_serial_port")]
        port: String,
        #[serde(default = "default_baud_rate")]
        baud_rate: u32,
        #[serde(default = "default_data_bits")]
        data_bits: u8,
        #[serde(default = "default_stop_bits")]
        stop_bits: StopBits,
        #[serde(default = "default_parity")]
        parity: Parity,
        #[serde(default = "default_flow_control")]
        flow_control: FlowControl,
    },
}

fn default_tcp_host() -> String {
    "192.168.1.254".to_string()
}

fn default_tcp_port() -> u16 {
    4001
}

fn default_serial_port() -> String {
    "COM1".to_string()
}

fn default_baud_rate() -> u32 {
    9600
}

fn default_data_bits() -> u8 {
    8
}

fn default_stop_bits() -> StopBits {
    StopBits::One
}

fn default_parity() -> Parity {
    Parity::None
}

fn default_flow_control() -> FlowControl {
    FlowControl::None
}

pub fn default_timeout_ms() -> u32 {
    1000
}

// Enum Connection dla adapterów (z timeout_ms)
#[derive(Debug, Clone)]
pub enum Connection {
    Tcp {
        host: String,
        port: u16,
        timeout_ms: u32,
    },
    Serial {
        port: String,
        baud_rate: u32,
        data_bits: u8,
        stop_bits: StopBits,
        parity: Parity,
        flow_control: FlowControl,
        timeout_ms: u32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConfig {
    pub name: String,
    pub manufacturer: String,
    pub model: String,
    // Reference to host and miernik instead of direct connection/protocol
    pub host_id: String,
    pub miernik_id: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

// DeviceConfig no longer has connection/protocol - they come from host_id and miernik_id
// The get_connection method is no longer needed

fn default_enabled() -> bool {
    true
}

// AppConfig moved to host.rs to avoid circular dependencies

#[derive(Debug, Deserialize)]
pub struct SaveConfigRequest {
    pub device_id: String,
    pub config: DeviceConfig,
}
