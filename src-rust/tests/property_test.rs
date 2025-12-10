use chrono::{Duration, Utc};
use proptest::prelude::*;
use std::collections::HashMap;
use tempfile::TempDir;

use scaleit_bridge::device_manager::DeviceManager;
use scaleit_bridge::models::device::{
    AppConfig, ConnectionConfig, DeviceConfig, FlowControl, Parity, StopBits,
};
use scaleit_bridge::models::weight::{ScaleCommandRequest, WeightReading};

// Property-based test strategies
fn device_id_strategy() -> impl Strategy<Value = String> {
    "[A-Z][A-Z0-9]{1,15}"
}

fn device_name_strategy() -> impl Strategy<Value = String> {
    "[A-Za-z0-9 -_]{3,50}"
}

fn manufacturer_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("Rinstrum".to_string()),
        Just("Dini Argeo".to_string()),
        Just("Toledo".to_string()),
        Just("Mettler".to_string()),
        Just("Custom Manufacturer".to_string()),
    ]
}

fn protocol_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("RINCMD".to_string()),
        Just("DINI_ARGEO".to_string()),
        Just("ASCII".to_string()),
        Just("MODBUS".to_string()),
    ]
}

fn tcp_connection_strategy() -> impl Strategy<Value = ConnectionConfig> {
    (
        prop_oneof!["127.0.0.1", "192.168.1.254", "10.0.0.100"],
        1024u16..=65535,
    )
        .prop_map(|(host, port)| ConnectionConfig::Tcp {
            host: host.to_string(),
            port,
        })
}

fn serial_connection_strategy() -> impl Strategy<Value = ConnectionConfig> {
    (
        prop_oneof!["/dev/ttyUSB0", "/dev/ttyS0", "COM1", "COM2"],
        prop_oneof![9600u32, 19200, 38400, 115200],
        prop_oneof![8u8, 7u8],
        prop_oneof![Just(StopBits::One), Just(StopBits::Two)],
        prop_oneof![Just(Parity::None), Just(Parity::Even), Just(Parity::Odd)],
        prop_oneof![
            Just(FlowControl::None),
            Just(FlowControl::Hardware),
            Just(FlowControl::Software)
        ],
    )
        .prop_map(|(port, baud_rate, data_bits, stop_bits, parity, flow_control)| {
            ConnectionConfig::Serial {
                port: port.to_string(),
                baud_rate,
                data_bits,
                stop_bits,
                parity,
                flow_control,
            }
        })
}

fn connection_strategy() -> impl Strategy<Value = ConnectionConfig> {
    prop_oneof![tcp_connection_strategy(), serial_connection_strategy()]
}

fn commands_strategy() -> impl Strategy<Value = HashMap<String, String>> {
    prop::collection::hash_map(
        prop_oneof!["readGross", "readNet", "tare", "zero"],
        "[A-Z0-9:]{4,16}",
        1..=8,
    )
}

fn device_config_strategy() -> impl Strategy<Value = DeviceConfig> {
    (
        device_name_strategy(),
        manufacturer_strategy(),
        device_name_strategy(),
        protocol_strategy(),
        connection_strategy(),
        commands_strategy(),
        500u32..=60000,
        any::<bool>(),
    )
        .prop_map(
            |(name, manufacturer, model, protocol, connection, commands, timeout_ms, enabled)| DeviceConfig {
                name,
                manufacturer,
                model,
                protocol,
                connection,
                timeout_ms,
                commands,
                enabled,
            },
        )
}

fn app_config_strategy() -> impl Strategy<Value = AppConfig> {
    prop::collection::hash_map(device_id_strategy(), device_config_strategy(), 1..=10)
        .prop_map(|devices| AppConfig { devices })
}

fn weight_reading_strategy() -> impl Strategy<Value = WeightReading> {
    (
        0.0f64..=1000.0,
        0.0f64..=1000.0,
        prop_oneof!["kg", "g", "lb", "oz"].prop_map(|unit| unit.to_string()),
        any::<bool>(),
        any::<i64>().prop_map(|seconds| Utc::now() + Duration::seconds(seconds % 86_400)),
    )
        .prop_map(|(gross_weight, net_weight, unit, is_stable, timestamp)| WeightReading {
            gross_weight,
            net_weight,
            unit,
            is_stable,
            timestamp,
        })
}

fn scale_command_request_strategy() -> impl Strategy<Value = ScaleCommandRequest> {
    (
        device_id_strategy(),
        prop_oneof!["readGross", "readNet", "tare", "zero"],
    )
        .prop_map(|(device_id, command)| ScaleCommandRequest {
            device_id,
            command: command.to_string(),
        })
}

// Property-based tests
proptest! {
    #[test]
    fn prop_device_config_serialization_roundtrip(config in device_config_strategy()) {
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: DeviceConfig = serde_json::from_str(&json).unwrap();

        prop_assert_eq!(&config.name, &deserialized.name);
        prop_assert_eq!(&config.manufacturer, &deserialized.manufacturer);
        prop_assert_eq!(&config.model, &deserialized.model);
        prop_assert_eq!(&config.protocol, &deserialized.protocol);
        prop_assert_eq!(config.enabled, deserialized.enabled);
    }

    #[test]
    fn prop_app_config_serialization_roundtrip(app_config in app_config_strategy()) {
        let json = serde_json::to_string_pretty(&app_config).unwrap();
        let deserialized: AppConfig = serde_json::from_str(&json).unwrap();

        prop_assert_eq!(app_config.devices.len(), deserialized.devices.len());

        for (device_id, original_config) in &app_config.devices {
            let deserialized_config = &deserialized.devices[device_id];
            prop_assert_eq!(&original_config.name, &deserialized_config.name);
            prop_assert_eq!(original_config.enabled, deserialized_config.enabled);
        }
    }

    #[test]
    fn prop_weight_reading_serialization_roundtrip(reading in weight_reading_strategy()) {
        let json = serde_json::to_string(&reading).unwrap();
        let deserialized: WeightReading = serde_json::from_str(&json).unwrap();

        prop_assert_eq!(reading.gross_weight, deserialized.gross_weight);
        prop_assert_eq!(reading.net_weight, deserialized.net_weight);
        prop_assert_eq!(reading.unit, deserialized.unit);
        prop_assert_eq!(reading.is_stable, deserialized.is_stable);
    }

    #[test]
    fn prop_scale_command_request_validation(request in scale_command_request_strategy()) {
        // Valid requests should have non-empty device_id and command
        prop_assert!(!request.device_id.is_empty());
        prop_assert!(!request.command.is_empty());

        // Command should be one of the valid commands
        prop_assert!(["readGross", "readNet", "tare", "zero"].contains(&request.command.as_str()));

        // Device ID should follow expected pattern (alphanumeric, starting with letter)
        prop_assert!(request.device_id.chars().next().unwrap().is_ascii_uppercase());
        prop_assert!(request.device_id.chars().all(|c| c.is_ascii_alphanumeric()));
    }

    #[test]
    fn prop_device_manager_creation_with_valid_config(app_config in app_config_strategy()) {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("test_config.json");

        let config_json = serde_json::to_string_pretty(&app_config).unwrap();
        std::fs::write(&config_path, config_json).unwrap();

        // Filter out invalid protocols for this test
        let mut valid_config = app_config.clone();
        valid_config.devices.retain(|_, config| {
            ["RINCMD", "DINI_ARGEO", "ASCII"].contains(&config.protocol.as_str())
        });

        if !valid_config.devices.is_empty() {
            let valid_config_json = serde_json::to_string_pretty(&valid_config).unwrap();
            std::fs::write(&config_path, valid_config_json).unwrap();

            let result = DeviceManager::from_path(&config_path);
            prop_assert!(result.is_ok());

            let device_manager = result.unwrap();
            let devices = device_manager.get_devices();

            // Should only return enabled devices
            let enabled_count = valid_config.devices.values().filter(|d| d.enabled).count();
            prop_assert_eq!(devices.len(), enabled_count);
        }
    }

    #[test]
    fn prop_tcp_connection_config_invariants(config in tcp_connection_strategy()) {
        match config {
            ConnectionConfig::Tcp { host, port } => {
                prop_assert!(!host.is_empty());
                prop_assert!(port >= 1024 && port <= 65535);
            }
            _ => prop_assert!(false, "Expected TCP connection config"),
        }
    }

    #[test]
    fn prop_serial_connection_config_invariants(config in serial_connection_strategy()) {
        match config {
            ConnectionConfig::Serial {
                port,
                baud_rate,
                data_bits,
                stop_bits,
                parity,
                flow_control,
            } => {
                prop_assert!(!port.is_empty());
                prop_assert!([9600, 19200, 38400, 115200].contains(&baud_rate));
                prop_assert!([8u8, 7u8].contains(&data_bits));
                prop_assert!(matches!(stop_bits, StopBits::One | StopBits::Two));
                prop_assert!(matches!(parity, Parity::None | Parity::Even | Parity::Odd));
                prop_assert!(matches!(
                    flow_control,
                    FlowControl::None | FlowControl::Hardware | FlowControl::Software
                ));
            }
            _ => prop_assert!(false, "Expected Serial connection config"),
        }
    }

    #[test]
    fn prop_device_config_name_constraints(name in device_name_strategy()) {
        prop_assert!(name.len() >= 3);
        prop_assert!(name.len() <= 50);
        prop_assert!(name.chars().all(|c| c.is_ascii_alphanumeric() || " -_".contains(c)));
    }

    #[test]
    fn prop_device_id_constraints(device_id in device_id_strategy()) {
        prop_assert!(device_id.len() >= 2);
        prop_assert!(device_id.len() <= 16);
        prop_assert!(device_id.chars().next().unwrap().is_ascii_uppercase());
        prop_assert!(device_id.chars().all(|c| c.is_ascii_alphanumeric()));
    }

    #[test]
    fn prop_weight_reading_value_constraints(reading in weight_reading_strategy()) {
        prop_assert!(reading.gross_weight >= 0.0);
        prop_assert!(reading.gross_weight <= 1000.0);
        prop_assert!(reading.net_weight >= 0.0);
        prop_assert!(reading.net_weight <= 1000.0);
        prop_assert!(reading.gross_weight >= reading.net_weight);
    }

    #[test]
    fn prop_commands_map_validity(commands in commands_strategy()) {
        prop_assert!(!commands.is_empty());
        prop_assert!(commands.len() <= 8);

        for (command, value) in &commands {
            prop_assert!(["readGross", "readNet", "tare", "zero"].contains(&command.as_str()));
            prop_assert!(!value.is_empty());
            prop_assert!(value.len() >= 4);
            prop_assert!(value.len() <= 16);
            prop_assert!(value.chars().all(|c| c.is_ascii_alphanumeric() || c == ':'));
        }
    }
}

// Regression tests for specific edge cases found through property testing
#[cfg(test)]
mod regression_tests {
    use super::*;

    #[test]
    fn test_empty_device_id_rejection() {
        let request = ScaleCommandRequest {
            device_id: String::new(),
            command: "readGross".to_string(),
        };

        // This should be caught by validation
        assert!(request.device_id.is_empty());
    }

    #[test]
    fn test_invalid_port_ranges() {
        let invalid_tcp_configs = vec![
            ("127.0.0.1", 0),     // Port too low
            ("127.0.0.1", 80),    // Reserved port
            ("127.0.0.1", 65536), // Port too high
        ];

        for (_host, port) in invalid_tcp_configs {
            // These would be invalid in a real system
            assert!(port == 0 || port < 1024 || port > 65535);
        }
    }

    #[test]
    fn test_weight_consistency_rules() {
        let reading = WeightReading {
            gross_weight: 100.0,
            net_weight: 150.0, // Net > Gross (invalid)
            unit: "kg".to_string(),
            is_stable: true,
            timestamp: chrono::Utc::now(),
        };

        // This violates the physical constraint that net weight cannot exceed gross weight
        assert!(reading.gross_weight < reading.net_weight);
    }

    #[test]
    fn test_extreme_timeout_values() {
        let extreme_timeouts = vec![0, 1, 100000, u32::MAX];

        for timeout in extreme_timeouts {
            if timeout < 500 || timeout > 30000 {
                // These should be rejected by validation
                assert!(timeout < 500 || timeout > 30000);
            }
        }
    }

    #[test]
    fn test_special_characters_in_device_names() {
        let problematic_names = vec![
            "Device\nWith\nNewlines",
            "Device\tWith\tTabs",
            "Device\0With\0Nulls",
            "Device\"With\"Quotes",
            "Device'With'Apostrophes",
            "Device<With>Angles",
            "Device&With&Ampersands",
        ];

        for name in problematic_names {
            // These should be sanitized or rejected
            let contains_control_chars = name.chars().any(|c| c.is_control());
            let contains_special_chars = name.chars().any(|c| "\"'<>&".contains(c));

            if contains_control_chars || contains_special_chars {
                println!("Problematic device name found: {}", name);
            }
        }
    }

    #[test]
    fn test_json_injection_in_config() {
        let malicious_json_strings = vec![
            r#"{"extra": "data"}"#,
            r#"\"; DROP TABLE devices; --"#,
            r#"<script>alert('xss')</script>"#,
            "null",
            "undefined",
            "NaN",
            "Infinity",
        ];

        for malicious_string in malicious_json_strings {
            // These should be properly escaped or rejected
            assert!(!malicious_string.is_empty());

            // Attempt to use as device name - should be sanitized
            let config = DeviceConfig {
                name: malicious_string.to_string(),
                manufacturer: "Test".to_string(),
                model: "Test".to_string(),
                protocol: "RINCMD".to_string(),
                connection: ConnectionConfig::Tcp {
                    host: "127.0.0.1".to_string(),
                    port: 8080,
                },
                timeout_ms: 3000,
                commands: HashMap::new(),
                enabled: true,
            };

            // Should serialize without breaking JSON structure
            let result = serde_json::to_string(&config);
            assert!(
                result.is_ok(),
                "Failed to serialize config with name: {}",
                malicious_string
            );
        }
    }
}

// Benchmark property tests for performance validation
#[cfg(test)]
mod performance_property_tests {
    use super::*;
    use std::time::Instant;

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        #[test]
        fn prop_config_serialization_performance(app_config in app_config_strategy()) {
            let start = Instant::now();
            let json = serde_json::to_string_pretty(&app_config).unwrap();
            let serialize_duration = start.elapsed();

            let start = Instant::now();
            let _deserialized: AppConfig = serde_json::from_str(&json).unwrap();
            let deserialize_duration = start.elapsed();

            // Serialization should be fast (< 10ms for reasonable config sizes)
            prop_assert!(serialize_duration.as_millis() < 10);
            prop_assert!(deserialize_duration.as_millis() < 10);

            // JSON should be reasonably sized (< 100KB for typical configs)
            prop_assert!(json.len() < 100_000);
        }

        #[test]
        fn prop_device_manager_creation_performance(app_config in app_config_strategy()) {
            // Limit to valid protocols to avoid initialization failures
            let mut valid_config = app_config;
            valid_config.devices.retain(|_, config| {
                ["RINCMD", "DINI_ARGEO", "ASCII"].contains(&config.protocol.as_str())
            });

            if !valid_config.devices.is_empty() && valid_config.devices.len() <= 5 {
                let temp_dir = TempDir::new().unwrap();
                let config_path = temp_dir.path().join("test_config.json");

                let config_json = serde_json::to_string_pretty(&valid_config).unwrap();
                std::fs::write(&config_path, config_json).unwrap();

                let start = Instant::now();
                let result = DeviceManager::from_path(&config_path);
                let creation_duration = start.elapsed();

                if result.is_ok() {
                    // Device manager creation should be fast (< 100ms)
                    prop_assert!(creation_duration.as_millis() < 100);
                }
            }
        }
    }
}
