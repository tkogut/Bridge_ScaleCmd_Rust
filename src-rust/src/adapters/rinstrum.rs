use async_trait::async_trait;
use tokio::net::TcpStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::time::{timeout, Duration};
use log::{info, warn, error, debug};
use std::sync::Arc;
use parking_lot::RwLock;
use chrono::Utc;

use crate::error::BridgeError;
use crate::models::device::{ConnectionConfig, CommandConfig, ConnectionType};
use crate::models::weight::WeightReading;
use super::adapter::DeviceAdapter;

pub struct RinstrumC320Adapter {
    device_id: String,
    connection_config: ConnectionConfig,
    command_config: CommandConfig,
    connection: Arc<RwLock<Option<TcpStream>>>,
}

impl RinstrumC320Adapter {
    pub fn new(device_id: String, connection_config: ConnectionConfig, command_config: CommandConfig) -> Result<Self, BridgeError> {
        if !matches!(connection_config.connection_type, ConnectionType::Tcp) {
            return Err(BridgeError::ConfigurationError(format!("RinstrumC320Adapter only supports TCP connections, but got {:?}", connection_config.connection_type)));
        }
        if connection_config.host.is_none() || connection_config.port.is_none() {
            return Err(BridgeError::ConfigurationError("TCP host and port must be specified for RinstrumC320Adapter".to_string()));
        }

        Ok(Self {
            device_id,
            connection_config,
            command_config,
            connection: Arc::new(RwLock::new(None)),
        })
    }

    async fn send_command_and_read_response(&self, command_str: &str) -> Result<String, BridgeError> {
        let mut conn_guard = self.connection.write();
        let conn = conn_guard.as_mut().ok_or_else(|| {
            error!("Attempted to send command without an active connection for device {}", self.device_id);
            BridgeError::ConnectionError("No active connection".to_string())
        })?;

        let full_command = format!("{}\r\n", command_str); // RINCMD typically uses CR+LF
        debug!("Sending command to {}: {}", self.device_id, full_command.trim());

        let write_future = conn.write_all(full_command.as_bytes());
        let timeout_duration = Duration::from_millis(self.connection_config.timeout_ms);

        timeout(timeout_duration, write_future)
            .await
            .map_err(|_| {
                warn!("Write timeout for device {}", self.device_id);
                BridgeError::Timeout(format!("Write timeout after {}ms", self.connection_config.timeout_ms))
            })?
            .map_err(|e| {
                error!("Failed to write to device {}: {}", self.device_id, e);
                BridgeError::IoError(e)
            })?;

        let mut buffer = vec![0; 1024];
        let read_future = conn.read(&mut buffer);

        let bytes_read = timeout(timeout_duration, read_future)
            .await
            .map_err(|_| {
                warn!("Read timeout for device {}", self.device_id);
                BridgeError::Timeout(format!("Read timeout after {}ms", self.connection_config.timeout_ms))
            })?
            .map_err(|e| {
                error!("Failed to read from device {}: {}", self.device_id, e);
                BridgeError::IoError(e)
            })?;

        let response = String::from_utf8_lossy(&buffer[..bytes_read]).trim().to_string();
        debug!("Received response from {}: {}", self.device_id, response);
        Ok(response)
    }

    fn parse_rincmd_response(&self, response: &str) -> Result<WeightReading, BridgeError> {
        // Example RINCMD response: "S 00000.000 kg" (Stable, 0.000 kg)
        // Or "U 00000.000 kg" (Unstable)
        // Or "E" (Error)
        // This is a simplified parser. Real RINCMD might be more complex.

        if response.is_empty() {
            return Err(BridgeError::ProtocolError("Empty response from device".to_string()));
        }

        let parts: Vec<&str> = response.split_whitespace().collect();
        if parts.len() < 3 {
            if response == "E" {
                return Err(BridgeError::ProtocolError("Device returned error 'E'".to_string()));
            }
            return Err(BridgeError::ProtocolError(format!("Unexpected response format: '{}'", response)));
        }

        let is_stable = parts[0] == "S";
        let weight_str = parts[1];
        let unit = parts[2].to_string();

        let weight = weight_str.parse::<f64>().map_err(|e| {
            BridgeError::ProtocolError(format!("Failed to parse weight '{}': {}", weight_str, e))
        })?;

        Ok(WeightReading {
            gross_weight: weight, // Assuming readGross/readNet will return the relevant weight
            net_weight: weight, // Placeholder, actual logic might differentiate
            unit,
            is_stable,
            timestamp: Utc::now(),
        })
    }
}

#[async_trait]
impl DeviceAdapter for RinstrumC320Adapter {
    async fn connect(&self) -> Result<(), BridgeError> {
        let mut conn_guard = self.connection.write();
        if conn_guard.is_some() {
            info!("Device {} already connected.", self.device_id);
            return Ok(());
        }

        let addr = format!("{}:{}",
            self.connection_config.host.as_ref().unwrap(),
            self.connection_config.port.unwrap()
        );
        info!("Attempting to connect to Rinstrum C320 at {}", addr);

        let connect_future = TcpStream::connect(&addr);
        let timeout_duration = Duration::from_millis(self.connection_config.timeout_ms);

        let stream = timeout(timeout_duration, connect_future)
            .await
            .map_err(|_| {
                error!("Connection timeout to {} for device {}", addr, self.device_id);
                BridgeError::Timeout(format!("Connection timeout after {}ms", self.connection_config.timeout_ms))
            })?
            .map_err(|e| {
                error!("Failed to connect to Rinstrum C320 at {}: {}", addr, e);
                BridgeError::ConnectionError(format!("Failed to connect: {}", e))
            })?;

        info!("Successfully connected to Rinstrum C320 at {} for device {}", addr, self.device_id);
        *conn_guard = Some(stream);
        Ok(())
    }

    async fn disconnect(&self) -> Result<(), BridgeError> {
        let mut conn_guard = self.connection.write();
        if let Some(stream) = conn_guard.take() {
            // TcpStream doesn't have an explicit close method, dropping it closes the connection.
            // However, we might want to ensure all data is flushed before dropping.
            // For simplicity, we just drop it here.
            info!("Disconnected from device {}", self.device_id);
        } else {
            warn!("Attempted to disconnect device {} which was not connected.", self.device_id);
        }
        Ok(())
    }

    fn is_connected(&self) -> bool {
        self.connection.read().is_some()
    }

    async fn execute_command(&self, command: &str) -> Result<WeightReading, BridgeError> {
        if !self.is_connected() {
            warn!("Device {} not connected, attempting to reconnect for command '{}'", self.device_id, command);
            self.connect().await?;
        }

        let command_str = match command {
            "readGross" => &self.command_config.read_gross,
            "readNet" => &self.command_config.read_net,
            "tare" => &self.command_config.tare,
            "zero" => &self.command_config.zero,
            _ => return Err(BridgeError::InvalidCommand(format!("Unknown command: {}", command))),
        };

        let response = self.send_command_and_read_response(command_str).await?;
        self.parse_rincmd_response(&response)
    }
}