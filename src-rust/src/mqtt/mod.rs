// MQTT Integration Module
// MQTT pub/sub integration for weight readings and commands

use async_trait::async_trait;
use chrono::Utc;
use log::{error, info, warn};
use rumqttc::{AsyncClient, MqttOptions, QoS};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

/// MQTT configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MqttConfig {
    pub enabled: bool,
    pub broker_url: String,
    pub client_id: String,
    pub topic_prefix: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub qos: u8, // Quality of Service: 0, 1, or 2
    pub retain: bool,
}

impl Default for MqttConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            broker_url: "mqtt://localhost:1883".to_string(),
            client_id: "scaleit-bridge".to_string(),
            topic_prefix: "scaleit".to_string(),
            username: None,
            password: None,
            qos: 1,
            retain: false,
        }
    }
}

impl MqttConfig {
    /// Create MqttConfig from environment variables
    pub fn from_env() -> Self {
        let enabled = std::env::var("MQTT_ENABLED")
            .map(|v| v.to_lowercase() == "true" || v == "1")
            .unwrap_or(false);

        let broker_url = std::env::var("MQTT_BROKER_URL")
            .unwrap_or_else(|_| "mqtt://localhost:1883".to_string());

        let client_id = std::env::var("MQTT_CLIENT_ID")
            .unwrap_or_else(|_| "scaleit-bridge".to_string());

        let topic_prefix = std::env::var("MQTT_TOPIC_PREFIX")
            .unwrap_or_else(|_| "scaleit".to_string());

        let username = std::env::var("MQTT_USERNAME").ok();
        let password = std::env::var("MQTT_PASSWORD").ok();

        let qos = std::env::var("MQTT_QOS")
            .ok()
            .and_then(|v| v.parse::<u8>().ok())
            .unwrap_or(1);

        let retain = std::env::var("MQTT_RETAIN")
            .map(|v| v.to_lowercase() == "true" || v == "1")
            .unwrap_or(false);

        Self {
            enabled,
            broker_url,
            client_id,
            topic_prefix,
            username,
            password,
            qos,
            retain,
        }
    }
}

/// MQTT publisher trait
#[async_trait]
pub trait MqttPublisher: Send + Sync {
    async fn publish_weight_reading(&self, device_id: &str, weight: f64, unit: &str, is_stable: bool) -> Result<(), MqttError>;
    async fn publish_device_status(&self, device_id: &str, status: &str) -> Result<(), MqttError>;
}

/// MQTT subscriber - handles command subscriptions and executes commands via callback
pub struct RealMqttSubscriber {
    client: Arc<Mutex<AsyncClient>>,
    config: MqttConfig,
}

impl RealMqttSubscriber {
    pub fn new(client: AsyncClient, config: MqttConfig) -> Self {
        Self {
            client: Arc::new(Mutex::new(client)),
            config,
        }
    }
}

/// MQTT error types
#[derive(Debug, thiserror::Error)]
pub enum MqttError {
    #[error("MQTT not implemented")]
    NotImplemented,
    #[error("MQTT not enabled")]
    NotEnabled,
    #[error("Connection error: {0}")]
    ConnectionError(String),
    #[error("Publish error: {0}")]
    PublishError(String),
    #[error("Subscribe error: {0}")]
    SubscribeError(String),
}

/// Parse MQTT broker URL to extract host and port
/// Supports formats: mqtt://host:port, mqtts://host:port, tcp://host:port
fn parse_broker_url(url: &str) -> Result<(String, u16), MqttError> {
    // Remove protocol prefix (mqtt://, mqtts://, tcp://)
    let url = url.trim_start_matches("mqtt://")
        .trim_start_matches("mqtts://")
        .trim_start_matches("tcp://")
        .trim_start_matches("ssl://");
    
    // Split host and port
    let parts: Vec<&str> = url.split(':').collect();
    match parts.len() {
        1 => Ok((parts[0].to_string(), 1883)), // Default port
        2 => {
            let host = parts[0].to_string();
            let port = parts[1].parse::<u16>()
                .map_err(|e| MqttError::ConnectionError(format!("Invalid port in broker URL: {}", e)))?;
            Ok((host, port))
        }
        _ => Err(MqttError::ConnectionError(format!("Invalid broker URL format: {}", url)))
    }
}

/// Real MQTT publisher implementation using rumqttc
pub struct RealMqttPublisher {
    client: Arc<Mutex<AsyncClient>>,
    config: MqttConfig,
}

impl RealMqttPublisher {
    pub fn new(client: AsyncClient, config: MqttConfig) -> Self {
        Self {
            client: Arc::new(Mutex::new(client)),
            config,
        }
    }
}

#[async_trait]
impl MqttPublisher for RealMqttPublisher {
    async fn publish_weight_reading(&self, device_id: &str, weight: f64, unit: &str, is_stable: bool) -> Result<(), MqttError> {
        let topic = format!("{}/weight/{}", self.config.topic_prefix, device_id);
        
        let message = WeightReadingMessage {
            device_id: device_id.to_string(),
            weight,
            unit: unit.to_string(),
            timestamp: chrono::Utc::now().timestamp() as u64,
            is_stable,
        };
        
        let payload = serde_json::to_string(&message)
            .map_err(|e| MqttError::PublishError(format!("Failed to serialize weight reading: {}", e)))?;
        
        let qos = match self.config.qos {
            0 => QoS::AtMostOnce,
            1 => QoS::AtLeastOnce,
            2 => QoS::ExactlyOnce,
            _ => QoS::AtLeastOnce, // Default to QoS 1
        };
        
        let client = self.client.lock().await;
        client.publish(&topic, qos, self.config.retain, payload.as_bytes())
            .await
            .map_err(|e| MqttError::PublishError(format!("Failed to publish weight reading: {}", e)))?;
        
        Ok(())
    }

    async fn publish_device_status(&self, device_id: &str, status: &str) -> Result<(), MqttError> {
        let topic = format!("{}/status/{}", self.config.topic_prefix, device_id);
        
        let message = DeviceStatusMessage {
            device_id: device_id.to_string(),
            status: status.to_string(),
            timestamp: chrono::Utc::now().timestamp() as u64,
        };
        
        let payload = serde_json::to_string(&message)
            .map_err(|e| MqttError::PublishError(format!("Failed to serialize device status: {}", e)))?;
        
        let qos = match self.config.qos {
            0 => QoS::AtMostOnce,
            1 => QoS::AtLeastOnce,
            2 => QoS::ExactlyOnce,
            _ => QoS::AtLeastOnce,
        };
        
        let client = self.client.lock().await;
        client.publish(&topic, qos, self.config.retain, payload.as_bytes())
            .await
            .map_err(|e| MqttError::PublishError(format!("Failed to publish device status: {}", e)))?;
        
        Ok(())
    }
}

/// Weight reading message for MQTT
#[derive(Debug, Serialize, Deserialize)]
pub struct WeightReadingMessage {
    pub device_id: String,
    pub weight: f64,
    pub unit: String,
    pub timestamp: u64,
    pub is_stable: bool,
}

/// Device status message for MQTT
#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceStatusMessage {
    pub device_id: String,
    pub status: String,
    pub timestamp: u64,
}

/// Device command message for MQTT
#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceCommandMessage {
    pub device_id: String,
    pub command: String,
    pub parameters: Option<serde_json::Value>,
}

/// Initialize MQTT publisher
pub fn init_mqtt_publisher(config: MqttConfig) -> Result<Arc<dyn MqttPublisher>, MqttError> {
    if !config.enabled {
        return Err(MqttError::NotEnabled);
    }
    
    // Parse broker URL to extract host and port
    let (host, port) = parse_broker_url(&config.broker_url)?;
    
    // Create MQTT options
    let mut mqttoptions = MqttOptions::new(&config.client_id, &host, port);
    mqttoptions.set_keep_alive(Duration::from_secs(60));
    
    // Set credentials if provided
    if let (Some(username), Some(password)) = (&config.username, &config.password) {
        mqttoptions.set_credentials(username, password);
    }
    
    // Create async client (capacity 10 is buffer size for pending messages)
    let (client, mut eventloop) = AsyncClient::new(mqttoptions, 10);
    
    // Start event loop in background task (required for AsyncClient to work)
    // The event loop needs to run to process incoming messages and maintain connection
    tokio::spawn(async move {
        let mut reconnect_delay = Duration::from_secs(1);
        let max_reconnect_delay = Duration::from_secs(60);
        
        loop {
            match eventloop.poll().await {
                Ok(rumqttc::Event::Incoming(rumqttc::Packet::ConnAck(_))) => {
                    // Connection acknowledged - reset reconnect delay
                    reconnect_delay = Duration::from_secs(1);
                }
                Ok(rumqttc::Event::Outgoing(rumqttc::Outgoing::Disconnect)) => {
                    warn!("MQTT publisher disconnecting");
                }
                Ok(_) => {
                    // Event processed successfully
                }
                Err(e) => {
                    error!("MQTT publisher event loop error: {}", e);
                    // Exponential backoff for reconnection
                    tokio::time::sleep(reconnect_delay).await;
                    reconnect_delay = std::cmp::min(reconnect_delay * 2, max_reconnect_delay);
                }
            }
        }
    });
    
    Ok(Arc::new(RealMqttPublisher::new(client, config)))
}

/// Start MQTT subscriber event loop
/// This function spawns a background task that subscribes to command topics
/// and executes commands via DeviceManager
pub async fn start_mqtt_subscriber_event_loop(
    config: MqttConfig,
    device_manager: Arc<crate::device_manager::DeviceManager>,
    mqtt_publisher: Option<Arc<dyn MqttPublisher>>,
) -> Result<tokio::task::JoinHandle<()>, MqttError> {
    if !config.enabled {
        return Err(MqttError::NotEnabled);
    }
    
    // Parse broker URL
    let (host, port) = parse_broker_url(&config.broker_url)?;
    
    // Create MQTT options with unique client ID for subscriber
    let client_id = format!("{}-subscriber", config.client_id);
    let mut mqttoptions = MqttOptions::new(&client_id, &host, port);
    mqttoptions.set_keep_alive(Duration::from_secs(60));
    
    // Set credentials if provided
    if let (Some(username), Some(password)) = (&config.username, &config.password) {
        mqttoptions.set_credentials(username, password);
    }
    
    // Create async client
    let (client, mut eventloop) = AsyncClient::new(mqttoptions, 10);
    
    // Subscribe to command topics
    let command_topic = format!("{}/command/+", config.topic_prefix);
    let qos = match config.qos {
        0 => QoS::AtMostOnce,
        1 => QoS::AtLeastOnce,
        2 => QoS::ExactlyOnce,
        _ => QoS::AtLeastOnce,
    };
    
    client.subscribe(&command_topic, qos).await
        .map_err(|e| MqttError::SubscribeError(format!("Failed to subscribe to {}: {}", command_topic, e)))?;
    
    let topic_prefix = config.topic_prefix.clone();
    
    // Spawn event loop task
    let handle = tokio::spawn(async move {
        let mut reconnect_delay = Duration::from_secs(1);
        let max_reconnect_delay = Duration::from_secs(60);
        
        loop {
            match eventloop.poll().await {
                Ok(rumqttc::Event::Incoming(rumqttc::Packet::ConnAck(_))) => {
                    // Connection acknowledged - reset reconnect delay
                    reconnect_delay = Duration::from_secs(1);
                    info!("MQTT subscriber connected successfully");
                }
                Ok(rumqttc::Event::Incoming(rumqttc::Packet::Publish(publish))) => {
                    let topic = publish.topic;
                    let payload = publish.payload;
                    
                    // Parse command message from JSON
                    match serde_json::from_slice::<DeviceCommandMessage>(&payload) {
                        Ok(cmd_msg) => {
                            // Create ScaleCommandRequest
                            let request = crate::models::weight::ScaleCommandRequest {
                                device_id: cmd_msg.device_id.clone(),
                                command: cmd_msg.command.clone(),
                            };
                            
                            // Execute command via DeviceManager
                            match device_manager.execute_command(request.clone()).await {
                                Ok(response) => {
                                    // Optionally publish response to response topic
                                    if let Some(ref mqtt_pub) = mqtt_publisher {
                                        if let Some(ref reading) = response.result {
                                            let _ = mqtt_pub.publish_weight_reading(
                                                &cmd_msg.device_id,
                                                reading.gross_weight,
                                                &reading.unit,
                                                reading.is_stable
                                            ).await;
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("MQTT command execution failed for device {}: {}", cmd_msg.device_id, e);
                                }
                            }
                        }
                        Err(e) => {
                            warn!("Failed to parse MQTT command message from topic {}: {}", topic, e);
                        }
                    }
                }
                Ok(rumqttc::Event::Outgoing(rumqttc::Outgoing::Disconnect)) => {
                    warn!("MQTT subscriber disconnecting");
                }
                Ok(_) => {
                    // Other events - ignore
                }
                Err(e) => {
                    error!("MQTT subscriber event loop error: {}", e);
                    // Exponential backoff for reconnection
                    tokio::time::sleep(reconnect_delay).await;
                    reconnect_delay = std::cmp::min(reconnect_delay * 2, max_reconnect_delay);
                }
            }
        }
    });
    
    Ok(handle)
}
