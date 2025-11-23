use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use log::{info, error};

use crate::error::BridgeError;
use crate::models::device::{AppConfig, DeviceConfig, ConnectionType};
use crate::models::weight::{ScaleCommandRequest, ScaleCommandResponse, WeightReading};
use crate::adapters::adapter::DeviceAdapter;
use crate::adapters::rinstrum::RinstrumC320Adapter;

pub struct DeviceManager {
    config: AppConfig,
    adapters: RwLock<HashMap<String, Arc<dyn DeviceAdapter>>>,
}

impl DeviceManager {
    pub fn new(config: AppConfig) -> Result<Self, BridgeError> {
        let mut adapters: HashMap<String, Arc<dyn DeviceAdapter>> = HashMap::new();

        for (device_id, device_config) in config.devices.iter() {
            info!("Initializing adapter for device: {} ({})", device_id, device_config.name);
            let adapter: Arc<dyn DeviceAdapter> = match device_config.protocol.as_str() {
                "RINCMD" => {
                    Arc::new(RinstrumC320Adapter::new(
                        device_id.clone(),
                        device_config.connection.clone(),
                        device_config.commands.clone(),
                    )?)
                },
                // Tutaj można dodać obsługę innych protokołów
                _ => {
                    error!("Unsupported protocol '{}' for device {}", device_config.protocol, device_id);
                    return Err(BridgeError::ConfigurationError(format!("Unsupported protocol: {}", device_config.protocol)));
                }
            };
            adapters.insert(device_id.clone(), adapter);
        }

        Ok(Self {
            config,
            adapters: RwLock::new(adapters),
        })
    }

    pub async fn execute_command(&self, request: ScaleCommandRequest) -> Result<ScaleCommandResponse, BridgeError> {
        let adapters_guard = self.adapters.read();
        let adapter = adapters_guard.get(&request.device_id)
            .ok_or_else(|| BridgeError::DeviceNotFound(request.device_id.clone()))?;

        let result = adapter.execute_command(&request.command).await;

        match result {
            Ok(weight_reading) => Ok(ScaleCommandResponse {
                success: true,
                device_id: request.device_id,
                command: request.command,
                result: Some(weight_reading),
                error: None,
            }),
            Err(e) => {
                error!("Error executing command for device {}: {:?}", request.device_id, e);
                Err(e)
            }
        }
    }

    pub fn get_devices(&self) -> Vec<(String, String, String)> {
        self.config.devices.iter()
            .map(|(id, dev)| (id.clone(), dev.name.clone(), dev.model.clone()))
            .collect()
    }

    pub async fn connect_all_devices(&self) {
        let adapters_guard = self.adapters.read();
        for (device_id, adapter) in adapters_guard.iter() {
            info!("Attempting to connect to device: {}", device_id);
            if let Err(e) = adapter.connect().await {
                error!("Failed to connect to device {}: {:?}", device_id, e);
            }
        }
    }

    pub async fn disconnect_all_devices(&self) {
        let adapters_guard = self.adapters.read();
        for (device_id, adapter) in adapters_guard.iter() {
            info!("Attempting to disconnect from device: {}", device_id);
            if let Err(e) = adapter.disconnect().await {
                error!("Failed to disconnect from device {}: {:?}", device_id, e);
            }
        }
    }
}