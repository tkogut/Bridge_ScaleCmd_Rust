//! Concrete device implementations

use crate::device::{Device, DeviceAdapter};
use crate::error::MiernikError;
use crate::models::{DeviceConfig, WeightReading};
use scaleit_host::{Connection, Protocol};
use std::collections::HashMap;
use std::sync::Arc;

/// Rinstrum C320 device
#[derive(Debug)]
pub struct RinstrumC320 {
    device: Device,
}

impl RinstrumC320 {
    pub fn new(
        device_id: String,
        connection: Arc<Connection>,
        commands: HashMap<String, String>,
    ) -> Self {
        let protocol = Protocol::Rincmd;
        let device = Device::new(device_id, connection, protocol, commands);
        Self { device }
    }

    pub fn from_config(
        device_id: String,
        config: &DeviceConfig,
        connection: Arc<Connection>,
    ) -> Result<Self, MiernikError> {
        let commands = config.commands.clone();
        Ok(Self::new(device_id, connection, commands))
    }
}

#[async_trait::async_trait]
impl DeviceAdapter for RinstrumC320 {
    async fn connect(&self) -> Result<(), MiernikError> {
        self.device.connect().await
    }

    async fn disconnect(&self) -> Result<(), MiernikError> {
        self.device.disconnect().await
    }

    fn is_connected(&self) -> bool {
        self.device.is_connected()
    }

    async fn execute_command(&self, command: &str) -> Result<WeightReading, MiernikError> {
        self.device.execute_command(command).await
    }
}

/// Dini Argeo DFW device
#[derive(Debug)]
pub struct DiniArgeoDFW {
    device: Device,
}

impl DiniArgeoDFW {
    pub fn new(
        device_id: String,
        connection: Arc<Connection>,
        commands: HashMap<String, String>,
    ) -> Self {
        let protocol = Protocol::DiniAscii;
        let device = Device::new(device_id, connection, protocol, commands);
        Self { device }
    }

    pub fn from_config(
        device_id: String,
        config: &DeviceConfig,
        connection: Arc<Connection>,
    ) -> Result<Self, MiernikError> {
        let commands = config.commands.clone();
        Ok(Self::new(device_id, connection, commands))
    }
}

#[async_trait::async_trait]
impl DeviceAdapter for DiniArgeoDFW {
    async fn connect(&self) -> Result<(), MiernikError> {
        self.device.connect().await
    }

    async fn disconnect(&self) -> Result<(), MiernikError> {
        self.device.disconnect().await
    }

    fn is_connected(&self) -> bool {
        self.device.is_connected()
    }

    async fn execute_command(&self, command: &str) -> Result<WeightReading, MiernikError> {
        self.device.execute_command(command).await
    }
}

