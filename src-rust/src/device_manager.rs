use log::{error, info, warn};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, BufWriter};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::error::BridgeError;
use crate::models::device::DeviceConfig;
use crate::models::host::{AppConfig, HostConfig};
use crate::models::miernik::MiernikConfig;
use crate::models::weight::{ScaleCommandRequest, ScaleCommandResponse};
use scaleit_host::{Connection, Protocol};
use scaleit_miernik::{DeviceAdapter, RinstrumC320, DiniArgeoDFW};

#[derive(Debug)]
pub struct DeviceManager {
    config_path: PathBuf,
    hosts: RwLock<HashMap<String, HostConfig>>,
    mierniki: RwLock<HashMap<String, MiernikConfig>>,
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
        let hosts = config.hosts;
        let mierniki = config.mierniki;
        let devices = config.devices;
        let adapters = Self::build_adapters(&hosts, &mierniki, &devices)?;

        Ok(Self {
            config_path: path,
            hosts: RwLock::new(hosts),
            mierniki: RwLock::new(mierniki),
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

    // Host management methods
    pub fn list_hosts(&self) -> HashMap<String, HostConfig> {
        self.hosts.read().clone()
    }

    pub fn get_host(&self, host_id: &str) -> Result<HostConfig, BridgeError> {
        self.hosts
            .read()
            .get(host_id)
            .cloned()
            .ok_or_else(|| BridgeError::DeviceNotFound(format!("Host '{}' not found", host_id)))
    }

    pub async fn save_host(&self, host_id: &str, config: HostConfig) -> Result<(), BridgeError> {
        {
            let mut hosts = self.hosts.write();
            hosts.insert(host_id.to_string(), config);
        }
        self.write_config()?;
        Ok(())
    }

    pub async fn delete_host(&self, host_id: &str) -> Result<(), BridgeError> {
        {
            let mut hosts = self.hosts.write();
            if hosts.remove(host_id).is_none() {
                return Err(BridgeError::DeviceNotFound(format!("Host '{}' not found", host_id)));
            }
        }
        self.write_config()?;
        Ok(())
    }

    // Miernik management methods
    pub fn list_mierniki(&self) -> HashMap<String, MiernikConfig> {
        self.mierniki.read().clone()
    }

    pub fn get_miernik(&self, miernik_id: &str) -> Result<MiernikConfig, BridgeError> {
        self.mierniki
            .read()
            .get(miernik_id)
            .cloned()
            .ok_or_else(|| BridgeError::DeviceNotFound(format!("Miernik '{}' not found", miernik_id)))
    }

    pub async fn save_miernik(&self, miernik_id: &str, config: MiernikConfig) -> Result<(), BridgeError> {
        {
            let mut mierniki = self.mierniki.write();
            mierniki.insert(miernik_id.to_string(), config);
        }
        self.write_config()?;
        Ok(())
    }

    pub async fn delete_miernik(&self, miernik_id: &str) -> Result<(), BridgeError> {
        {
            let mut mierniki = self.mierniki.write();
            if mierniki.remove(miernik_id).is_none() {
                return Err(BridgeError::DeviceNotFound(format!("Miernik '{}' not found", miernik_id)));
            }
        }
        self.write_config()?;
        Ok(())
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
                .clone()
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
        }
        self.write_config()?;
        Ok(())
    }

    pub async fn delete_config(&self, device_id: &str) -> Result<(), BridgeError> {
        {
            let mut devices = self.devices.write();
            if devices.remove(device_id).is_none() {
                return Err(BridgeError::DeviceNotFound(device_id.to_string()));
            }
        }
        self.write_config()?;
        Ok(())
    }

    pub async fn reload_config(&self) -> Result<(), BridgeError> {
        let config_from_disk = Self::read_config(&self.config_path)?;
        {
            let mut hosts = self.hosts.write();
            *hosts = config_from_disk.hosts;
        }
        {
            let mut mierniki = self.mierniki.write();
            *mierniki = config_from_disk.mierniki;
        }
        {
            let mut devices = self.devices.write();
            *devices = config_from_disk.devices;
        }
        self.rebuild_adapters().await
    }

    async fn rebuild_adapters(&self) -> Result<(), BridgeError> {
        let hosts_snapshot = self.hosts.read().clone();
        let mierniki_snapshot = self.mierniki.read().clone();
        let devices_snapshot = self.devices.read().clone();
        let new_adapters = Self::build_adapters(&hosts_snapshot, &mierniki_snapshot, &devices_snapshot)?;

        // Disconnect old adapters before replacing
        {
            let old_adapters = self.adapters.read();
            for adapter in old_adapters.values() {
                if let Err(e) = adapter.disconnect().await {
                    warn!("Failed to disconnect adapter during reload: {:?}", e);
                }
            }
        }

        // Replace adapters
        {
            let mut adapters_guard = self.adapters.write();
            *adapters_guard = new_adapters;
        }

        self.connect_all_devices().await;
        Ok(())
    }

    fn build_adapters(
        hosts: &HashMap<String, HostConfig>,
        mierniki: &HashMap<String, MiernikConfig>,
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

            // Get host configuration
            let host_config = hosts.get(&device_config.host_id)
                .ok_or_else(|| BridgeError::ConfigurationError(format!(
                    "Host '{}' not found for device '{}'",
                    device_config.host_id, device_id
                )))?;

            // Get miernik configuration
            let miernik_config = mierniki.get(&device_config.miernik_id)
                .ok_or_else(|| BridgeError::ConfigurationError(format!(
                    "Miernik '{}' not found for device '{}'",
                    device_config.miernik_id, device_id
                )))?;

            let protocol = Protocol::from_str(&miernik_config.protocol);
            let connection = Self::convert_host_to_connection(host_config)?;
            let connection_arc = Arc::new(connection);

            // Convert MiernikConfig to scaleit_miernik::DeviceConfig
            let scaleit_miernik_config = scaleit_miernik::DeviceConfig {
                name: device_config.name.clone(),
                manufacturer: miernik_config.manufacturer.clone(),
                model: miernik_config.model.clone(),
                protocol: miernik_config.protocol.clone(),
                commands: miernik_config.commands.clone(),
                enabled: device_config.enabled,
            };

            let adapter: Arc<dyn DeviceAdapter + Send + Sync> = match protocol {
                Protocol::Rincmd => {
                    Arc::new(RinstrumC320::from_config(
                        device_id.clone(),
                        &scaleit_miernik_config,
                        connection_arc,
                    ).map_err(|e| BridgeError::ConfigurationError(format!("{}", e)))?)
                }
                Protocol::DiniAscii => {
                    Arc::new(DiniArgeoDFW::from_config(
                        device_id.clone(),
                        &scaleit_miernik_config,
                        connection_arc,
                    ).map_err(|e| BridgeError::ConfigurationError(format!("{}", e)))?)
                }
                Protocol::Custom(_) => {
                    error!(
                        "Unsupported protocol '{}' for device {}",
                        miernik_config.protocol, device_id
                    );
                    return Err(BridgeError::ConfigurationError(format!(
                        "Unsupported protocol: {}",
                        miernik_config.protocol
                    )));
                }
            };

            adapters.insert(device_id.clone(), adapter);
        }

        Ok(adapters)
    }

    /// Convert HostConfig to scaleit_host::Connection
    fn convert_host_to_connection(host_config: &HostConfig) -> Result<Connection, BridgeError> {
        match &host_config.connection {
            crate::models::device::ConnectionConfig::Tcp { host, port } => {
                Ok(Connection::tcp(host.clone(), *port, host_config.timeout_ms))
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
                    host_config.timeout_ms,
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
                hosts: HashMap::new(),
                mierniki: HashMap::new(),
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

    fn write_config(&self) -> Result<(), BridgeError> {
        let file = File::create(&self.config_path).map_err(|e| {
            BridgeError::ConfigurationError(format!(
                "Failed to write config file {}: {}",
                self.config_path.display(),
                e
            ))
        })?;
        let writer = BufWriter::new(file);
        let config = AppConfig {
            hosts: self.hosts.read().clone(),
            mierniki: self.mierniki.read().clone(),
            devices: self.devices.read().clone(),
        };
        serde_json::to_writer_pretty(writer, &config)?;
        Ok(())
    }
}
