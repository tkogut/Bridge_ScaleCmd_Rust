use serde::{Deserialize, Serialize};

/// Request model for sending custom MQTT messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMqttRequest {
    pub topic: String,
    pub payload: serde_json::Value,
    #[serde(default)]
    pub qos: i32,
    #[serde(default)]
    pub retain: bool,
}