// Minimal tests for ScaleIT Bridge without complex dependencies
// These tests focus on core logic and data structures

use serde_json;
use std::collections::HashMap;

// Import the basic types we can test
use scaleit_bridge::error::BridgeError;
use scaleit_bridge::models::device::{ConnectionConfig, DeviceConfig};
use scaleit_bridge::models::host::{AppConfig, HostConfig};
use scaleit_bridge::models::miernik::MiernikConfig;
use scaleit_bridge::models::weight::{ScaleCommandRequest, ScaleCommandResponse, WeightReading};

#[test]
fn test_error_types_basic() {
    let error1 = BridgeError::DeviceNotFound("TEST_DEVICE".to_string());
    assert!(error1.to_string().contains("Device not found: TEST_DEVICE"));

    let error2 = BridgeError::ConnectionError("Connection failed".to_string());
    assert!(error2
        .to_string()
        .contains("Connection error: Connection failed"));

    let error3 = BridgeError::ConfigurationError("Invalid config".to_string());
    assert!(error3
        .to_string()
        .contains("Configuration error: Invalid config"));
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

    let json = serde_json::to_string(&reading).expect("Failed to serialize WeightReading");
    let deserialized: WeightReading =
        serde_json::from_str(&json).expect("Failed to deserialize WeightReading");

    assert_eq!(reading.gross_weight, deserialized.gross_weight);
    assert_eq!(reading.net_weight, deserialized.net_weight);
    assert_eq!(reading.unit, deserialized.unit);
    assert_eq!(reading.is_stable, deserialized.is_stable);
}

#[test]
fn test_scale_command_request_serialization() {
    let request = ScaleCommandRequest {
        device_id: "C320".to_string(),
        command: "readGross".to_string(),
    };

    let json = serde_json::to_string(&request).expect("Failed to serialize ScaleCommandRequest");
    let deserialized: ScaleCommandRequest =
        serde_json::from_str(&json).expect("Failed to deserialize ScaleCommandRequest");

    assert_eq!(request.device_id, deserialized.device_id);
    assert_eq!(request.command, deserialized.command);
}

#[test]
fn test_scale_command_response_serialization() {
    let weight_reading = WeightReading {
        gross_weight: 123.45,
        net_weight: 120.0,
        unit: "kg".to_string(),
        is_stable: true,
        timestamp: chrono::Utc::now(),
    };

    let response = ScaleCommandResponse {
        success: true,
        device_id: "C320".to_string(),
        command: "readGross".to_string(),
        result: Some(weight_reading),
        error: None,
    };

    let json = serde_json::to_string(&response).expect("Failed to serialize ScaleCommandResponse");
    let deserialized: ScaleCommandResponse =
        serde_json::from_str(&json).expect("Failed to deserialize ScaleCommandResponse");

    assert_eq!(response.success, deserialized.success);
    assert_eq!(response.device_id, deserialized.device_id);
    assert_eq!(response.command, deserialized.command);
    assert!(deserialized.result.is_some());
    assert!(deserialized.error.is_none());
}

#[test]
fn test_app_config_serialization() {
    // Create Hosts
    let mut hosts = HashMap::new();
    hosts.insert(
        "host1".to_string(),
        HostConfig {
            name: "Host 1".to_string(),
            connection: ConnectionConfig::Tcp {
                host: "192.168.1.100".to_string(),
                port: 4001,
            },
            timeout_ms: 3000,
            enabled: true,
        },
    );

    // Create Mierniki
    let mut mierniki = HashMap::new();
    let mut commands = HashMap::new();
    commands.insert("readGross".to_string(), "CMD".to_string());
    
    mierniki.insert(
        "miernik1".to_string(),
        MiernikConfig {
            name: "Miernik 1".to_string(),
            protocol: "RINCMD".to_string(),
            manufacturer: "Rinstrum".to_string(),
            model: "C320".to_string(),
            commands,
            enabled: true,
        },
    );

    // Create Devices
    let mut devices = HashMap::new();
    devices.insert(
        "device1".to_string(),
        DeviceConfig {
            name: "Device 1".to_string(),
            manufacturer: "Rinstrum".to_string(),
            model: "C320".to_string(),
            host_id: "host1".to_string(),
            miernik_id: "miernik1".to_string(),
            enabled: true,
        },
    );

    let app_config = AppConfig {
        hosts,
        mierniki,
        devices,
        mqtt: None,
    };

    let json = serde_json::to_string_pretty(&app_config).expect("Failed to serialize AppConfig");
    let deserialized: AppConfig =
        serde_json::from_str(&json).expect("Failed to deserialize AppConfig");

    assert_eq!(app_config.devices.len(), deserialized.devices.len());
    assert_eq!(app_config.hosts.len(), deserialized.hosts.len());
    assert_eq!(app_config.mierniki.len(), deserialized.mierniki.len());
    
    let dev = deserialized.devices.get("device1").unwrap();
    assert_eq!(dev.host_id, "host1");
    assert_eq!(dev.miernik_id, "miernik1");
}

#[test]
fn test_uuid_generation() {
    let id1 = uuid::Uuid::new_v4();
    let id2 = uuid::Uuid::new_v4();

    assert_ne!(id1, id2);
    assert_eq!(id1.to_string().len(), 36);
}
