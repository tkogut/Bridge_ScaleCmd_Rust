use crate::adapters::adapter::DeviceAdapter;
use crate::adapters::dini_argeo::DiniArgeoAsciiAdapter;
use crate::adapters::rinstrum::RinstrumC320Adapter;
use crate::error::BridgeError;
use crate::models::device::Connection;
use crate::models::weight::WeightReading;
use std::collections::HashMap;
use std::sync::Arc;

/// Enum wrapper for device adapters to solve dyn compatibility issues
/// This allows us to store different adapter types without using trait objects
#[derive(Clone)]
pub enum DeviceAdapterEnum {
    DiniArgeo(Arc<DiniArgeoAsciiAdapter>),
    Rinstrum(Arc<RinstrumC320Adapter>),
}

impl DeviceAdapterEnum {
    /// Creates a new DiniArgeo adapter
    pub fn new_dini_argeo(
        device_id: String,
        connection: Connection,
        commands: HashMap<String, String>,
    ) -> Result<Self, BridgeError> {
        Ok(Self::DiniArgeo(Arc::new(DiniArgeoAsciiAdapter::new(
            device_id, connection, commands,
        )?)))
    }

    /// Creates a new Rinstrum adapter
    pub fn new_rinstrum(
        device_id: String,
        connection: Connection,
        commands: HashMap<String, String>,
    ) -> Result<Self, BridgeError> {
        Ok(Self::Rinstrum(Arc::new(RinstrumC320Adapter::new(
            device_id, connection, commands,
        )?)))
    }

    /// Creates an adapter from configuration
    pub fn from_config(
        adapter_type: &str,
        device_id: String,
        connection: Connection,
        commands: HashMap<String, String>,
    ) -> Result<Self, BridgeError> {
        match adapter_type.to_lowercase().as_str() {
            "dini_argeo" | "diniargeo" | "ascii" | "dfw" | "dinia" => {
                Self::new_dini_argeo(device_id, connection, commands)
            }
            "rinstrum" | "rinstrum_c320" | "rincmd" => {
                Self::new_rinstrum(device_id, connection, commands)
            }
            _ => Err(BridgeError::ConfigurationError(format!(
                "Unknown adapter type: {}",
                adapter_type
            ))),
        }
    }

    /// Connects to the device
    pub async fn connect(&self) -> Result<(), BridgeError> {
        match self {
            Self::DiniArgeo(adapter) => adapter.connect().await,
            Self::Rinstrum(adapter) => adapter.connect().await,
        }
    }

    /// Disconnects from the device
    pub async fn disconnect(&self) -> Result<(), BridgeError> {
        match self {
            Self::DiniArgeo(adapter) => adapter.disconnect().await,
            Self::Rinstrum(adapter) => adapter.disconnect().await,
        }
    }

    /// Checks if the device is connected
    pub fn is_connected(&self) -> bool {
        match self {
            Self::DiniArgeo(adapter) => adapter.is_connected(),
            Self::Rinstrum(adapter) => adapter.is_connected(),
        }
    }

    /// Executes a command on the device
    pub async fn execute_command(&self, command: &str) -> Result<WeightReading, BridgeError> {
        match self {
            Self::DiniArgeo(adapter) => adapter.execute_command(command).await,
            Self::Rinstrum(adapter) => adapter.execute_command(command).await,
        }
    }

    /// Gets the adapter type as a string
    pub fn adapter_type(&self) -> &'static str {
        match self {
            Self::DiniArgeo(_) => "dini_argeo",
            Self::Rinstrum(_) => "rinstrum",
        }
    }

    /// Gets the device name/identifier
    pub fn device_name(&self) -> String {
        match self {
            Self::DiniArgeo(_) => "Dini Argeo ASCII".to_string(),
            Self::Rinstrum(_) => "Rinstrum C320".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_adapter_creation() {
        let serial_connection = Connection::Serial {
            port: "COM1".to_string(),
            baud_rate: 9600,
            timeout_ms: 1000,
        };
        let tcp_connection = Connection::Tcp {
            host: "192.168.1.100".to_string(),
            port: 4001,
            timeout_ms: 5000,
        };
        let commands = HashMap::new();

        let dini = DeviceAdapterEnum::new_dini_argeo(
            "test_device".to_string(),
            serial_connection,
            commands.clone(),
        )
        .unwrap();
        assert_eq!(dini.adapter_type(), "dini_argeo");
        assert_eq!(dini.device_name(), "Dini Argeo ASCII");

        let rinstrum =
            DeviceAdapterEnum::new_rinstrum("test_device".to_string(), tcp_connection, commands)
                .unwrap();
        assert_eq!(rinstrum.adapter_type(), "rinstrum");
        assert_eq!(rinstrum.device_name(), "Rinstrum C320");
    }

    #[test]
    fn test_from_config() {
        let serial_connection = Connection::Serial {
            port: "COM1".to_string(),
            baud_rate: 9600,
            timeout_ms: 1000,
        };
        let tcp_connection = Connection::Tcp {
            host: "192.168.1.100".to_string(),
            port: 4001,
            timeout_ms: 5000,
        };
        let commands = HashMap::new();

        let dini = DeviceAdapterEnum::from_config(
            "dini_argeo",
            "test_device".to_string(),
            serial_connection.clone(),
            commands.clone(),
        )
        .unwrap();
        assert_eq!(dini.adapter_type(), "dini_argeo");

        let rinstrum = DeviceAdapterEnum::from_config(
            "rinstrum",
            "test_device".to_string(),
            tcp_connection,
            commands.clone(),
        )
        .unwrap();
        assert_eq!(rinstrum.adapter_type(), "rinstrum");

        let unknown = DeviceAdapterEnum::from_config(
            "unknown",
            "test_device".to_string(),
            serial_connection,
            commands,
        );
        assert!(unknown.is_err());
    }

    #[test]
    fn test_clone() {
        let serial_connection = Connection::Serial {
            port: "COM1".to_string(),
            baud_rate: 9600,
            timeout_ms: 1000,
        };
        let commands = HashMap::new();

        let adapter = DeviceAdapterEnum::new_dini_argeo(
            "test_device".to_string(),
            serial_connection,
            commands,
        )
        .unwrap();
        let cloned = adapter.clone();
        assert_eq!(adapter.adapter_type(), cloned.adapter_type());
    }
}
