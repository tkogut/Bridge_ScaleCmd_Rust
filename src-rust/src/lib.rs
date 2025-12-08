pub mod adapters;
pub mod device_manager;
pub mod error;
pub mod models;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::device::{AppConfig, Connection, DeviceConfig};
    use crate::models::weight::{ScaleCommandRequest, WeightReading};
    use std::collections::HashMap;

    #[test]
    fn test_error_types() {
        let error = error::BridgeError::DeviceNotFound("test_device".to_string());
        assert!(error.to_string().contains("Device not found: test_device"));

        let error = error::BridgeError::ConnectionError("connection failed".to_string());
        assert!(error
            .to_string()
            .contains("Connection error: connection failed"));
    }

    #[test]
    fn test_weight_reading_serialization() {
        let reading = WeightReading {
            gross_weight: 42.5,
            net_weight: 40.0,
            unit: "kg".to_string(),
            is_stable: true,
            timestamp: chrono::Utc::now(),
        };

        let json = serde_json::to_string(&reading).unwrap();
        let deserialized: WeightReading = serde_json::from_str(&json).unwrap();

        assert_eq!(reading.gross_weight, deserialized.gross_weight);
        assert_eq!(reading.net_weight, deserialized.net_weight);
        assert_eq!(reading.unit, deserialized.unit);
        assert_eq!(reading.is_stable, deserialized.is_stable);
    }

    #[test]
    fn test_scale_command_request() {
        let request = ScaleCommandRequest {
            device_id: "C320".to_string(),
            command: "readGross".to_string(),
        };

        assert_eq!(request.device_id, "C320");
        assert_eq!(request.command, "readGross");

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: ScaleCommandRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(request.device_id, deserialized.device_id);
        assert_eq!(request.command, deserialized.command);
    }

    #[test]
    fn test_device_config_creation() {
        use crate::models::device::ConnectionConfig;
        let mut commands = HashMap::new();
        commands.insert("readGross".to_string(), "20050026".to_string());
        commands.insert("readNet".to_string(), "20050025".to_string());

        let config = DeviceConfig {
            name: "Test Scale".to_string(),
            manufacturer: "Test Manufacturer".to_string(),
            model: "Test Model".to_string(),
            protocol: "RINCMD".to_string(),
            connection: ConnectionConfig::Tcp {
                host: "192.168.1.100".to_string(),
                port: 4001,
            },
            timeout_ms: 5000,
            commands,
            enabled: true,
        };

        assert_eq!(config.name, "Test Scale");
        assert_eq!(config.manufacturer, "Test Manufacturer");
        assert_eq!(config.model, "Test Model");
        assert_eq!(config.protocol, "RINCMD");
        assert!(config.enabled);
        assert_eq!(config.commands.len(), 2);
    }

    #[test]
    fn test_app_config_serialization() {
        use crate::models::device::ConnectionConfig;
        let mut devices = HashMap::new();
        let mut commands = HashMap::new();
        commands.insert("readGross".to_string(), "20050026".to_string());

        let device_config = DeviceConfig {
            name: "Test Device".to_string(),
            manufacturer: "Test Corp".to_string(),
            model: "Model1".to_string(),
            protocol: "RINCMD".to_string(),
            connection: ConnectionConfig::Tcp {
                host: "localhost".to_string(),
                port: 8080,
            },
            timeout_ms: 1000,
            commands,
            enabled: true,
        };

        devices.insert("test_device".to_string(), device_config);

        let app_config = AppConfig { devices };

        let json = serde_json::to_string_pretty(&app_config).unwrap();
        let deserialized: AppConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(app_config.devices.len(), deserialized.devices.len());
        assert!(deserialized.devices.contains_key("test_device"));

        let device = &deserialized.devices["test_device"];
        assert_eq!(device.name, "Test Device");
        assert_eq!(device.manufacturer, "Test Corp");
        assert_eq!(device.model, "Model1");
        assert_eq!(device.protocol, "RINCMD");
        assert!(device.enabled);
    }
}
