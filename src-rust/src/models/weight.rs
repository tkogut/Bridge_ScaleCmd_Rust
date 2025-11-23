use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightReading {
    pub gross_weight: f64,
    pub net_weight: f64,
    pub unit: String,
    pub is_stable: bool,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScaleCommandRequest {
    pub device_id: String,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScaleCommandResponse {
    pub success: bool,
    pub device_id: String,
    pub command: String,
    pub result: Option<WeightReading>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceListResponse {
    pub success: bool,
    pub devices: Vec<(String, String, String)>, // (device_id, name, model)
}