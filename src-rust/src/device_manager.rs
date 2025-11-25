use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, BufWriter};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use log::{error, info, warn};
use parking_lot::RwLock;

use crate::adapters::adapter::DeviceAdapter;
use crate::adapters::rinstrum::RinstrumC320Adapter;
use crate::error::BridgeError;
use crate::models::device::{AppConfig, DeviceConfig};
use crate::models::weight::{ScaleCommandRequest, ScaleCommandResponse};

pub struct DeviceManager {
    config_path: PathBuf,
    devices: RwLock<HashMap<String, DeviceConfig>>,
    adapters: RwLock<HashMap<String, Arc<dyn DeviceAdapter>>>,
}

impl DeviceManager {
    pub fn from_path<P: Into<PathBuf>>(path: P) -> Result<Self, BridgeError> {
        let path = path.into();
        let app_config = Self::read_config(&path)?;
        Self::from_config(path, app_config)
    }

    pub fn from_config<P: Into<PathBuf>>(path: P, config: AppConfig) -> Result<Self, BridgeError> {
        let path = path.into();
        let devices = config.devices;
        let adapters = Self::build_adapters(&devices)?;

        Ok(Self {
            config_path: path,
            devices: RwLock::new(devices),
            adapters: RwLock::new(adapters),
        })
    }

    pub fn get_devices(&self) -> Vec<(String, String, String)> {
        self.devices
            .read()
            .iter()
            .map(|(id, dev)| (id.clone(), dev.name.clone(), dev.model.clone()))
            .collect()
    }

    pub fn list_configs(&self) -> HashMap<String, DeviceConfig> {
        self.devices.read().clone()
    }

    pub fn get_config(&self, device_id: &str) -> Result<DeviceConfig, BridgeError> {
        self.devices
            .read()
            .get(device_id)
            .cloned()
            .ok_or_else(|| BridgeError::DeviceNotFound(device_id.to_string()))
    }

    pub async fn execute_command(
        &self,
        request: ScaleCommandRequest,
    ) -> Result<ScaleCommandResponse, BridgeError> {
        let adapter = {
            let adapters_guard = self.adapters.read();
            adapters_guard
                .get(&request.device_id)
                .cloned()
                .ok_or_else(|| BridgeError::DeviceNotFound(request.device_id.clone()))?
        };

        match adapter.execute_command(&request.command).await {
            Ok(weight_reading) => Ok(ScaleCommandResponse {
                success: true,
                device_id: request.device_id,
                command: request.command,
                result: Some(weight_reading),
                error: None,
            }),
            Err(e) => {
                error!(
                    "Error executing command for device {}: {:?}",
                    request.device_id, e
                );
                Err(e)
            }
        }
    }

    pub async fn connect_all_devices(&self) {
        let adapters = self.adapters.read().clone();
        for (device_id, adapter) in adapters {
            info!("Attempting to connect to device: {}", device_id);
            if let Err(e) = adapter.connect().await {
                error!("Failed to connect to device {}: {:?}", device_id, e);
            }
        }
    }

    pub async fn disconnect_all_devices(&self) {
        let adapters = self.adapters.read().clone();
        for (device_id, adapter) in adapters {
            info!("Attempting to disconnect from device: {}", device_id);
            if let Err(e) = adapter.disconnect().await {
                error!("Failed to disconnect from device {}: {:?}", device_id, e);
            }
        }
    }

    pub async fn save_config(
        &self,
        device_id: &str,
        config: DeviceConfig,
    ) -> Result<(), BridgeError> {
        {
            let mut devices = self.devices.write();
            devices.insert(device_id.to_string(), config);
            self.write_config(&devices)?;
        }
        Ok(())
    }

    pub async fn delete_config(&self, device_id: &str) -> Result<(), BridgeError> {
        {
            let mut devices = self.devices.write();
            if devices.remove(device_id).is_none() {
                return Err(BridgeError::DeviceNotFound(device_id.to_string()));
            }
            self.write_config(&devices)?;
        }
        Ok(())
    }

    pub async fn reload_config(&self) -> Result<(), BridgeError> {
        let devices_from_disk = Self::read_config(&self.config_path)?.devices;
        {
            let mut devices = self.devices.write();
            *devices = devices_from_disk;
        }
        self.rebuild_adapters().await
    }

    async fn rebuild_adapters(&self) -> Result<(), BridgeError> {
        let devices_snapshot = self.devices.read().clone();
        let new_adapters = Self::build_adapters(&devices_snapshot)?;

        let old_adapters = {
            let mut adapters_guard = self.adapters.write();
            let old = adapters_guard.values().cloned().collect::<Vec<_>>();
            *adapters_guard = new_adapters;
            old
        };

        for adapter in old_adapters {
            if let Err(e) = adapter.disconnect().await {
                warn!("Failed to disconnect adapter during reload: {:?}", e);
            }
        }

        self.connect_all_devices().await;
        Ok(())
    }

    fn build_adapters(
        devices: &HashMap<String, DeviceConfig>,
    ) -> Result<HashMap<String, Arc<dyn DeviceAdapter>>, BridgeError> {
        let mut adapters: HashMap<String, Arc<dyn DeviceAdapter>> = HashMap::new();

        for (device_id, device_config) in devices.iter() {
            info!(
                "Initializing adapter for device: {} ({})",
                device_id, device_config.name
            );

            let adapter: Arc<dyn DeviceAdapter> = match device_config.protocol.as_str() {
                "RINCMD" => Arc::new(RinstrumC320Adapter::new(
                    device_id.clone(),
                    device_config.connection.clone(),
                    device_config.commands.clone(),
                )?),
                _ => {
                    error!(
                        "Unsupported protocol '{}' for device {}",
                        device_config.protocol, device_id
                    );
                    return Err(BridgeError::ConfigurationError(format!(
                        "Unsupported protocol: {}",
                        device_config.protocol
                    )));
                }
            };

            adapters.insert(device_id.clone(), adapter);
        }

        Ok(adapters)
    }

    fn read_config(path: &Path) -> Result<AppConfig, BridgeError> {
        let file = File::open(path).map_err(|e| {
            BridgeError::ConfigurationError(format!(
                "Failed to open config file {}: {}",
                path.display(),
                e
            ))
        })?;
        let reader = BufReader::new(file);
        let config = serde_json::from_reader(reader)?;
        Ok(config)
    }

    fn write_config(&self, devices: &HashMap<String, DeviceConfig>) -> Result<(), BridgeError> {
        let file = File::create(&self.config_path).map_err(|e| {
            BridgeError::ConfigurationError(format!(
                "Failed to write config file {}: {}",
                self.config_path.display(),
                e
            ))
        })?;
        let writer = BufWriter::new(file);
        let config = AppConfig {
            devices: devices.clone(),
        };
        serde_json::to_writer_pretty(writer, &config)?;
        Ok(())
    }
}
