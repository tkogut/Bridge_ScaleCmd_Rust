//! Device definitions and adapters

use crate::error::MiernikError;
use crate::models::WeightReading;
use async_trait::async_trait;
use scaleit_host::{CommandExecutor, Connection, Protocol};
use std::sync::Arc;

/// Device adapter trait
#[async_trait]
pub trait DeviceAdapter: Send + Sync + std::fmt::Debug {
    /// Connect to device
    async fn connect(&self) -> Result<(), MiernikError>;

    /// Disconnect from device
    async fn disconnect(&self) -> Result<(), MiernikError>;

    /// Check if connected
    fn is_connected(&self) -> bool;

    /// Execute command and return weight reading
    async fn execute_command(&self, command: &str) -> Result<WeightReading, MiernikError>;
}

/// Device implementation
#[derive(Debug)]
pub struct Device {
    device_id: String,
    connection: Arc<Connection>,
    protocol: Protocol,
    command_executor: CommandExecutor,
    command_map: std::collections::HashMap<String, String>,
}

impl Device {
    pub fn new(
        device_id: String,
        connection: Arc<Connection>,
        protocol: Protocol,
        command_map: std::collections::HashMap<String, String>,
    ) -> Self {
        let command_executor = CommandExecutor::new(connection.clone(), protocol.clone());
        Self {
            device_id,
            connection,
            protocol,
            command_executor,
            command_map,
        }
    }
}

#[async_trait]
impl DeviceAdapter for Device {
    async fn connect(&self) -> Result<(), MiernikError> {
        match &self.connection.connection_type {
            scaleit_host::ConnectionType::Tcp { .. } => {
                self.connection
                    .connect_tcp()
                    .await
                    .map_err(|e| MiernikError::HostError(format!("{}", e)))
            }
            scaleit_host::ConnectionType::Serial { .. } => {
                self.connection
                    .connect_serial()
                    .await
                    .map_err(|e| MiernikError::HostError(format!("{}", e)))
            }
        }
    }

    async fn disconnect(&self) -> Result<(), MiernikError> {
        self.connection
            .disconnect()
            .await
            .map_err(|e| MiernikError::HostError(format!("{}", e)))
    }

    fn is_connected(&self) -> bool {
        self.connection.is_connected()
    }

    async fn execute_command(&self, command: &str) -> Result<WeightReading, MiernikError> {
        let command_lower = command.to_lowercase();
        let device_command = self
            .command_map
            .get(&command_lower)
            .ok_or_else(|| {
                MiernikError::InvalidCommand(format!("Unknown command: {}", command))
            })?;

        let response = self
            .command_executor
            .execute(device_command)
            .await
            .map_err(|e| MiernikError::HostError(format!("{}", e)))?;

        // Parse response based on protocol
        match self.protocol {
            scaleit_host::Protocol::Rincmd => {
                crate::parsers::parse_rincmd_response(&response)
            }
            scaleit_host::Protocol::DiniAscii => {
                crate::parsers::parse_dini_ascii_response(&response)
            }
            scaleit_host::Protocol::Custom(_) => {
                // Try RINCMD first, then Dini
                crate::parsers::parse_rincmd_response(&response)
                    .or_else(|_| crate::parsers::parse_dini_ascii_response(&response))
            }
        }
    }
}

