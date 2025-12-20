use log::{error, info, warn};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, BufWriter};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::error::BridgeError;
use crate::models::device::{AppConfig, DeviceConfig};
use crate::models::weight::{ScaleCommandRequest, ScaleCommandResponse};
use scaleit_host::{Connection, Protocol};
use scaleit_miernik::{DeviceAdapter, RinstrumC320, DiniArgeoDFW};

#[derive(Debug)]
pub struct DeviceManager {
    config_path: PathBuf,
    devices: RwLock<HashMap<String, DeviceConfig>>,
    adapters: RwLock<HashMap<String, Arc<dyn DeviceAdapter + Send + Sync>>>,
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
            .filter(|(_, dev)| dev.enabled)
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
        {
            let devices_guard = self.devices.read();
            if let Some(config) = devices_guard.get(&request.device_id) {
                if !config.enabled {
                    return Err(BridgeError::InvalidCommand(format!(
                        "Device {} is disabled",
                        request.device_id
                    )));
                }
            } else {
                return Err(BridgeError::DeviceNotFound(request.device_id.clone()));
            }
        }

        let adapter = {
            let adapters_guard = self.adapters.read();
            adapters_guard
                .get(&request.device_id)
                .ok_or_else(|| BridgeError::DeviceNotFound(request.device_id.clone()))?
        };

        match adapter.execute_command(&request.command).await {
            Ok(weight_reading) => {
                // Convert scaleit_miernik::WeightReading to crate::models::weight::WeightReading
                let reading = crate::models::weight::WeightReading {
                    gross_weight: weight_reading.gross_weight,
                    net_weight: weight_reading.net_weight,
                    unit: weight_reading.unit,
                    is_stable: weight_reading.is_stable,
                    timestamp: weight_reading.timestamp,
                };
                Ok(ScaleCommandResponse {
                    success: true,
                    device_id: request.device_id,
                    command: request.command,
                    result: Some(reading),
                    error: None,
                })
            }
            Err(e) => {
                error!(
                    "Error executing command for device {}: {:?}",
                    request.device_id, e
                );
                // Convert MiernikError to BridgeError
                Err(BridgeError::ProtocolError(format!("{}", e)))
            }
        }
    }

    pub async fn connect_all_devices(&self) {
        let adapters = self.adapters.read();
        for (device_id, adapter) in adapters.iter() {
            info!("Attempting to connect to device: {}", device_id);
            if let Err(e) = adapter.connect().await {
                error!("Failed to connect to device {}: {:?}", device_id, e);
            }
        }
    }

    pub async fn disconnect_all_devices(&self) {
        let adapters = self.adapters.read();
        for (device_id, adapter) in adapters.iter() {
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
            let old = adapters_guard.clone();
            *adapters_guard = new_adapters;
            old
        };

        for adapter in old_adapters.values() {
            if let Err(e) = adapter.disconnect().await {
                warn!("Failed to disconnect adapter during reload: {:?}", e);
            }
        }

        self.connect_all_devices().await;
        Ok(())
    }

    fn build_adapters(
        devices: &HashMap<String, DeviceConfig>,
    ) -> Result<HashMap<String, Arc<dyn DeviceAdapter + Send + Sync>>, BridgeError> {
        let mut adapters: HashMap<String, Arc<dyn DeviceAdapter + Send + Sync>> = HashMap::new();

        for (device_id, device_config) in devices.iter() {
            info!(
                "Initializing adapter for device: {} ({})",
                device_id, device_config.name
            );

            if !device_config.enabled {
                info!("Skipping disabled device {}", device_id);
                continue;
            }

            let protocol = Protocol::from_str(&device_config.protocol);
            let connection = Self::convert_connection(device_config)?;
            let connection_arc = Arc::new(connection);

            let adapter: Arc<dyn DeviceAdapter + Send + Sync> = match protocol {
                Protocol::Rincmd => {
                    Arc::new(RinstrumC320::from_config(
                        device_id.clone(),
                        device_config,
                        connection_arc,
                    )?)
                }
                Protocol::DiniAscii => {
                    Arc::new(DiniArgeoDFW::from_config(
                        device_id.clone(),
                        device_config,
                        connection_arc,
                    )?)
                }
                Protocol::Custom(_) => {
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

    /// Convert old Connection enum to new scaleit_host::Connection
    fn convert_connection(config: &DeviceConfig) -> Result<Connection, BridgeError> {
        match &config.connection {
            crate::models::device::ConnectionConfig::Tcp { host, port } => {
                Ok(Connection::tcp(host.clone(), *port, config.timeout_ms))
            }
            crate::models::device::ConnectionConfig::Serial {
                port,
                baud_rate,
                data_bits,
                stop_bits,
                parity,
                flow_control,
            } => {
                use serialport::{FlowControl as SerialFlowControl, Parity as SerialParity, StopBits as SerialStopBits};
                
                let stop_bits_serial = match stop_bits {
                    crate::models::device::StopBits::One => SerialStopBits::One,
                    crate::models::device::StopBits::Two => SerialStopBits::Two,
                };

                let parity_serial = match parity {
                    crate::models::device::Parity::None => SerialParity::None,
                    crate::models::device::Parity::Even => SerialParity::Even,
                    crate::models::device::Parity::Odd => SerialParity::Odd,
                };

                let flow_control_serial = match flow_control {
                    crate::models::device::FlowControl::None => SerialFlowControl::None,
                    crate::models::device::FlowControl::Software => SerialFlowControl::Software,
                    crate::models::device::FlowControl::Hardware => SerialFlowControl::Hardware,
                };

                Ok(Connection::serial(
                    port.clone(),
                    *baud_rate,
                    *data_bits,
                    stop_bits_serial,
                    parity_serial,
                    flow_control_serial,
                    config.timeout_ms,
                ))
            }
        }
    }

    fn read_config(path: &Path) -> Result<AppConfig, BridgeError> {
        // If file doesn't exist, create default empty config
        if !path.exists() {
            info!("Config file not found at {}, creating default configuration", path.display());
            
            // Create parent directory if it doesn't exist
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    BridgeError::ConfigurationError(format!(
                        "Failed to create config directory {}: {}",
                        parent.display(),
                        e
                    ))
                })?;
            }
            
            // Create default empty config
            let default_config = AppConfig {
                devices: HashMap::new(),
            };
            
            // Write default config to file
            let file = File::create(path).map_err(|e| {
                BridgeError::ConfigurationError(format!(
                    "Failed to create config file {}: {}",
                    path.display(),
                    e
                ))
            })?;
            let writer = BufWriter::new(file);
            serde_json::to_writer_pretty(writer, &default_config).map_err(|e| {
                BridgeError::ConfigurationError(format!(
                    "Failed to write default config to {}: {}",
                    path.display(),
                    e
                ))
            })?;
            
            info!("Default configuration file created at {}", path.display());
            return Ok(default_config);
        }
        
        // File exists, read it
        let file = File::open(path).map_err(|e| {
            BridgeError::ConfigurationError(format!(
                "Failed to open config file {}: {}",
                path.display(),
                e
            ))
        })?;
        let reader = BufReader::new(file);
        let config = serde_json::from_reader(reader).map_err(|e| {
            BridgeError::ConfigurationError(format!(
                "Failed to parse config file {}: {}",
                path.display(),
                e
            ))
        })?;
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
