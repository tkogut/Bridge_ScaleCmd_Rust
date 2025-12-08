// Minimal tests for ScaleIT Bridge without complex dependencies
// These tests focus on core logic and data structures

use serde_json;
use std::collections::HashMap;
use tempfile::TempDir;

// Import the basic types we can test
use scaleit_bridge::error::BridgeError;
use scaleit_bridge::models::device::{AppConfig, Connection, DeviceConfig};
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
    // Note: status and tare_weight fields don't exist in WeightReading model
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

    let result = deserialized.result.unwrap();
    assert_eq!(result.gross_weight, 123.45);
    assert_eq!(result.net_weight, 120.0);
    assert_eq!(result.unit, "kg".to_string());
}

#[test]
fn test_device_config_tcp_serialization() {
    let mut commands = HashMap::new();
    commands.insert("readGross".to_string(), "W".to_string());
    commands.insert("readNet".to_string(), "N".to_string());
    commands.insert("tare".to_string(), "T".to_string());
    commands.insert("zero".to_string(), "Z".to_string());

    use scaleit_bridge::models::device::ConnectionConfig;
    let device_config = DeviceConfig {
        name: "C320 Rinstrum Scale".to_string(),
        manufacturer: "Rinstrum".to_string(),
        model: "C320".to_string(),
        protocol: "RINCMD".to_string(),
        connection: ConnectionConfig::Tcp {
            host: "192.168.1.100".to_string(),
            port: 4001,
        },
        timeout_ms: 5000,
        commands,
        enabled: true,
    };

    let json =
        serde_json::to_string_pretty(&device_config).expect("Failed to serialize DeviceConfig");
    let deserialized: DeviceConfig =
        serde_json::from_str(&json).expect("Failed to deserialize DeviceConfig");

    assert_eq!(device_config.name, deserialized.name);
    assert_eq!(device_config.manufacturer, deserialized.manufacturer);
    assert_eq!(device_config.model, deserialized.model);
    assert_eq!(device_config.protocol, deserialized.protocol);
    assert_eq!(device_config.enabled, deserialized.enabled);
    assert_eq!(device_config.commands.len(), deserialized.commands.len());

    // Check TCP connection details
    match (&device_config.connection, &deserialized.connection) {
        (ConnectionConfig::Tcp { host: h1, port: p1 }, ConnectionConfig::Tcp { host: h2, port: p2 }) => {
            assert_eq!(h1, h2);
            assert_eq!(p1, p2);
        }
        _ => panic!("Connection types don't match"),
    }
    assert_eq!(device_config.timeout_ms, deserialized.timeout_ms);
}

#[test]
fn test_device_config_serial_serialization() {
    let mut commands = HashMap::new();
    commands.insert("readGross".to_string(), "W".to_string());
    commands.insert("readNet".to_string(), "N".to_string());
    commands.insert("tare".to_string(), "T".to_string());
    commands.insert("zero".to_string(), "Z".to_string());

    use scaleit_bridge::models::device::{FlowControl, Parity, StopBits};
    let serial_connection = Connection::Serial {
        port: "COM3".to_string(),
        baud_rate: 9600,
        data_bits: 8,
        stop_bits: StopBits::One,
        parity: Parity::None,
        flow_control: FlowControl::None,
        timeout_ms: 1000,
    };

    use scaleit_bridge::models::device::ConnectionConfig;
    let device_config = DeviceConfig {
        name: "DFW Dini Argeo Scale".to_string(),
        manufacturer: "Dini Argeo".to_string(),
        model: "DFW".to_string(),
        protocol: "DINI_ARGEO".to_string(),
        connection: ConnectionConfig::Serial {
            port: "COM3".to_string(),
            baud_rate: 9600,
            data_bits: 8,
            stop_bits: StopBits::One,
            parity: Parity::None,
            flow_control: FlowControl::None,
        },
        timeout_ms: 1000,
        commands,
        enabled: true,
    };

    let json =
        serde_json::to_string_pretty(&device_config).expect("Failed to serialize DeviceConfig");
    let deserialized: DeviceConfig =
        serde_json::from_str(&json).expect("Failed to deserialize DeviceConfig");

    assert_eq!(device_config.name, deserialized.name);
    assert_eq!(device_config.manufacturer, deserialized.manufacturer);
    assert_eq!(device_config.model, deserialized.model);
    assert_eq!(device_config.protocol, deserialized.protocol);
    assert_eq!(device_config.enabled, deserialized.enabled);

    // Check Serial connection details
    match (&device_config.connection, &deserialized.connection) {
        (
            ConnectionConfig::Serial {
                port: p1,
                baud_rate: b1,
                data_bits: d1,
                ..
            },
            ConnectionConfig::Serial {
                port: p2,
                baud_rate: b2,
                data_bits: d2,
                ..
            },
        ) => {
            assert_eq!(p1, p2);
            assert_eq!(b1, b2);
            assert_eq!(d1, d2);
        }
        _ => panic!("Connection types don't match"),
    }
    assert_eq!(device_config.timeout_ms, deserialized.timeout_ms);
}

#[test]
fn test_app_config_serialization() {
    let mut devices = HashMap::new();

    // Create a TCP device
    let mut tcp_commands = HashMap::new();
    tcp_commands.insert("readGross".to_string(), "20050026".to_string());
    tcp_commands.insert("readNet".to_string(), "20050025".to_string());

    use scaleit_bridge::models::device::ConnectionConfig;
    let tcp_device = DeviceConfig {
        name: "C320 Rinstrum".to_string(),
        manufacturer: "Rinstrum".to_string(),
        model: "C320".to_string(),
        protocol: "RINCMD".to_string(),
        connection: ConnectionConfig::Tcp {
            host: "192.168.1.254".to_string(),
            port: 4001,
        },
        timeout_ms: 3000,
        commands: tcp_commands,
        enabled: true,
    };

    // Create a Serial device
    let mut serial_commands = HashMap::new();
    serial_commands.insert("readGross".to_string(), "READ".to_string());
    serial_commands.insert("tare".to_string(), "TARE".to_string());

    use scaleit_bridge::models::device::ConnectionConfig;
    let serial_device = DeviceConfig {
        name: "DFW Dini Argeo".to_string(),
        manufacturer: "Dini Argeo".to_string(),
        model: "DFW".to_string(),
        protocol: "DINI_ARGEO".to_string(),
        connection: ConnectionConfig::Serial {
            port: "/dev/ttyUSB0".to_string(),
            baud_rate: 9600,
            data_bits: 8,
            stop_bits: StopBits::One,
            parity: Parity::None,
            flow_control: FlowControl::None,
        },
        timeout_ms: 1000,
        commands: serial_commands,
        enabled: false, // Disabled for testing
    };

    devices.insert("C320".to_string(), tcp_device);
    devices.insert("DWF".to_string(), serial_device);

    let app_config = AppConfig { devices };

    let json = serde_json::to_string_pretty(&app_config).expect("Failed to serialize AppConfig");
    let deserialized: AppConfig =
        serde_json::from_str(&json).expect("Failed to deserialize AppConfig");

    assert_eq!(app_config.devices.len(), deserialized.devices.len());
    assert!(deserialized.devices.contains_key("C320"));
    assert!(deserialized.devices.contains_key("DWF"));

    let c320_device = &deserialized.devices["C320"];
    assert_eq!(c320_device.name, "C320 Rinstrum");
    assert_eq!(c320_device.manufacturer, "Rinstrum");
    assert!(c320_device.enabled);

    let dwf_device = &deserialized.devices["DWF"];
    assert_eq!(dwf_device.name, "DFW Dini Argeo");
    assert_eq!(dwf_device.manufacturer, "Dini Argeo");
    assert!(!dwf_device.enabled);
}

#[test]
fn test_app_config_file_operations() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let config_path = temp_dir.path().join("test_config.json");

    // Create test configuration
    let mut devices = HashMap::new();
    let mut commands = HashMap::new();
    commands.insert("readGross".to_string(), "TEST_CMD".to_string());

    use scaleit_bridge::models::device::ConnectionConfig;
    let test_device = DeviceConfig {
        name: "Test Device".to_string(),
        manufacturer: "Test Corp".to_string(),
        model: "Test-1".to_string(),
        protocol: "TEST_PROTOCOL".to_string(),
        connection: ConnectionConfig::Tcp {
            host: "127.0.0.1".to_string(),
            port: 8080,
        },
        timeout_ms: 5000,
        commands,
        enabled: true,
    };

    devices.insert("TEST_DEVICE".to_string(), test_device);
    let app_config = AppConfig { devices };

    // Write to file
    let json = serde_json::to_string_pretty(&app_config).expect("Failed to serialize config");
    std::fs::write(&config_path, json).expect("Failed to write config file");

    // Read from file
    let file_content = std::fs::read_to_string(&config_path).expect("Failed to read config file");
    let loaded_config: AppConfig =
        serde_json::from_str(&file_content).expect("Failed to parse config file");

    assert_eq!(app_config.devices.len(), loaded_config.devices.len());
    assert!(loaded_config.devices.contains_key("TEST_DEVICE"));

    let loaded_device = &loaded_config.devices["TEST_DEVICE"];
    assert_eq!(loaded_device.name, "Test Device");
    assert_eq!(loaded_device.manufacturer, "Test Corp");
    assert_eq!(loaded_device.model, "Test-1");
    assert_eq!(loaded_device.protocol, "TEST_PROTOCOL");
    assert!(loaded_device.enabled);
}

#[test]
fn test_weight_reading_edge_cases() {
    // Test minimal valid reading
    let minimal_reading = WeightReading {
        gross_weight: 0.0,
        net_weight: 0.0,
        unit: "g".to_string(),
        is_stable: false,
        timestamp: chrono::Utc::now(),
    };

    let json =
        serde_json::to_string(&minimal_reading).expect("Failed to serialize minimal reading");
    let deserialized: WeightReading =
        serde_json::from_str(&json).expect("Failed to deserialize minimal reading");

    assert_eq!(minimal_reading.gross_weight, deserialized.gross_weight);
    assert_eq!(minimal_reading.net_weight, deserialized.net_weight);
    assert_eq!(minimal_reading.unit, deserialized.unit);
    assert_eq!(minimal_reading.is_stable, deserialized.is_stable);

    // Test with negative weights (error conditions)
    let error_reading = WeightReading {
        gross_weight: -1.0,
        net_weight: -5.0,
        unit: "kg".to_string(),
        is_stable: false,
        timestamp: chrono::Utc::now(),
    };

    let json = serde_json::to_string(&error_reading).expect("Failed to serialize error reading");
    let deserialized: WeightReading =
        serde_json::from_str(&json).expect("Failed to deserialize error reading");

    assert_eq!(error_reading.gross_weight, deserialized.gross_weight);
    assert_eq!(error_reading.net_weight, deserialized.net_weight);
    assert_eq!(error_reading.unit, deserialized.unit);
    assert_eq!(error_reading.is_stable, deserialized.is_stable);
}

#[test]
fn test_device_commands_validation() {
    let valid_commands = vec!["readGross", "readNet", "tare", "zero"];

    for command in valid_commands {
        let request = ScaleCommandRequest {
            device_id: "TEST_DEVICE".to_string(),
            command: command.to_string(),
        };

        assert!(!request.device_id.is_empty());
        assert!(!request.command.is_empty());
        assert_eq!(request.command, command);
    }
}

#[test]
fn test_uuid_generation() {
    let id1 = uuid::Uuid::new_v4();
    let id2 = uuid::Uuid::new_v4();

    assert_ne!(id1, id2);
    assert_eq!(id1.to_string().len(), 36); // Standard UUID string length
    assert_eq!(id2.to_string().len(), 36);
}

#[test]
fn test_regex_patterns() {
    let device_id_pattern =
        regex::Regex::new(r"^[A-Z][A-Z0-9_]{1,15}$").expect("Invalid regex pattern");

    assert!(device_id_pattern.is_match("C320"));
    assert!(device_id_pattern.is_match("DWF"));
    assert!(device_id_pattern.is_match("TEST_DEVICE_1"));

    assert!(!device_id_pattern.is_match(""));
    assert!(!device_id_pattern.is_match("c320")); // lowercase
    assert!(!device_id_pattern.is_match("123")); // starts with number
    assert!(!device_id_pattern.is_match("VERY_LONG_DEVICE_NAME_THAT_EXCEEDS_LIMIT"));
    // too long
}

#[test]
fn test_error_display_formatting() {
    let errors = vec![
        BridgeError::DeviceNotFound("C320".to_string()),
        BridgeError::ConnectionError("TCP timeout".to_string()),
        BridgeError::CommandError("Invalid command".to_string()),
        BridgeError::ConfigurationError("Missing field".to_string()),
        BridgeError::Timeout("Operation timed out".to_string()),
        BridgeError::ProtocolError("Unknown protocol".to_string()),
        BridgeError::InvalidCommand("Command not supported".to_string()),
        BridgeError::InternalServerError("Server error".to_string()),
        BridgeError::Unknown("Unknown error".to_string()),
    ];

    for error in errors {
        let error_string = error.to_string();
        assert!(!error_string.is_empty());
        assert!(error_string.len() > 5); // Should have meaningful content

        // Check that the error type is reflected in the message
        match error {
            BridgeError::DeviceNotFound(_) => assert!(error_string.contains("Device not found")),
            BridgeError::ConnectionError(_) => assert!(error_string.contains("Connection error")),
            BridgeError::CommandError(_) => {
                assert!(error_string.contains("Command execution error"))
            }
            BridgeError::ConfigurationError(_) => {
                assert!(error_string.contains("Configuration error"))
            }
            BridgeError::Timeout(_) => assert!(error_string.contains("Timeout error")),
            BridgeError::ProtocolError(_) => assert!(error_string.contains("Protocol error")),
            BridgeError::InvalidCommand(_) => assert!(error_string.contains("Invalid command")),
            BridgeError::InternalServerError(_) => {
                assert!(error_string.contains("Internal server error"))
            }
            BridgeError::Unknown(_) => assert!(error_string.contains("Unknown error")),
            BridgeError::IoError(_) => assert!(error_string.contains("IO error")),
            BridgeError::SerializationError(_) => {
                assert!(error_string.contains("Serialization error"))
            }
        }
    }
}
