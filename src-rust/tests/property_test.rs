use chrono::{Duration, Utc};
use proptest::prelude::*;
use std::collections::HashMap;
use tempfile::TempDir;

use scaleit_bridge::device_manager::DeviceManager;
use scaleit_bridge::models::device::{
    ConnectionConfig, DeviceConfig, FlowControl, Parity, StopBits,
};
use scaleit_bridge::models::host::{AppConfig, HostConfig};
use scaleit_bridge::models::miernik::MiernikConfig;
use scaleit_bridge::models::weight::{ScaleCommandRequest, WeightReading};

// Property-based test strategies
fn id_strategy() -> impl Strategy<Value = String> {
    "[A-Z][A-Z0-9]{1,15}"
}

fn name_strategy() -> impl Strategy<Value = String> {
    (
        "[A-Za-z0-9]",
        prop::collection::vec(prop_oneof![
            "[A-Za-z0-9]",
            Just(" ".to_string()),
            Just("-".to_string()),
            Just("_".to_string())
        ], 2..=49)
    )
        .prop_map(|(first, rest)| format!("{}{}", first, rest.join("")))
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
    let port_strategy = prop::sample::select(vec![
        "/dev/ttyUSB0".to_string(),
        "/dev/ttyS0".to_string(),
        "COM1".to_string(),
        "COM2".to_string(),
    ]);
    let baud_rate_strategy = prop::sample::select(vec![9600u32, 19200, 38400, 115200]);
    let data_bits_strategy = prop::sample::select(vec![8u8, 7u8]);
    let stop_bits_strategy = prop::sample::select(vec![StopBits::One, StopBits::Two]);
    let parity_strategy = prop::sample::select(vec![Parity::None, Parity::Even, Parity::Odd]);
    let flow_control_strategy = prop::sample::select(vec![
        FlowControl::None,
        FlowControl::Hardware,
        FlowControl::Software,
    ]);

    (
        port_strategy,
        baud_rate_strategy,
        data_bits_strategy,
        stop_bits_strategy,
        parity_strategy,
        flow_control_strategy,
    )
        .prop_map(
            |(port, baud_rate, data_bits, stop_bits, parity, flow_control)| {
            ConnectionConfig::Serial {
                    port,
                baud_rate,
                data_bits,
                stop_bits,
                parity,
                flow_control,
            }
            },
        )
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

fn host_config_strategy() -> impl Strategy<Value = HostConfig> {
    (
        name_strategy(),
        connection_strategy(),
        500u32..=60000,
        any::<bool>(),
    )
        .prop_map(|(name, connection, timeout_ms, enabled)| HostConfig {
            name,
            connection,
            timeout_ms,
            enabled,
        })
}

fn miernik_config_strategy() -> impl Strategy<Value = MiernikConfig> {
    (
        name_strategy(),
        protocol_strategy(),
        manufacturer_strategy(),
        name_strategy(), // model
        commands_strategy(),
        any::<bool>(),
    )
        .prop_map(|(name, protocol, manufacturer, model, commands, enabled)| MiernikConfig {
            name,
            protocol,
            manufacturer,
            model,
            commands,
            enabled,
        })
}

// Generate a valid AppConfig by creating hosts and mierniki first, 
// then creating devices that reference them
fn app_config_strategy() -> impl Strategy<Value = AppConfig> {
    let hosts_map = prop::collection::hash_map(id_strategy(), host_config_strategy(), 1..=5);
    let mierniki_map = prop::collection::hash_map(id_strategy(), miernik_config_strategy(), 1..=5);
    
    (hosts_map, mierniki_map).prop_flat_map(|(hosts, mierniki)| {
        let host_ids: Vec<String> = hosts.keys().cloned().collect();
        let miernik_ids: Vec<String> = mierniki.keys().cloned().collect();
        
        let devices_strategy = prop::collection::hash_map(
            id_strategy(),
            (
                name_strategy(),
                manufacturer_strategy(),
                name_strategy(), // model
                any::<bool>(),
                prop::sample::select(host_ids),
                prop::sample::select(miernik_ids),
            ).prop_map(|(name, manufacturer, model, enabled, host_id, miernik_id)| {
                DeviceConfig {
                    name,
                    manufacturer,
                    model,
                    host_id,
                    miernik_id,
                    enabled,
                }
            }),
            1..=10
        );

        (Just(hosts), Just(mierniki), devices_strategy).prop_map(|(hosts, mierniki, devices)| {
            AppConfig { 
                hosts, 
                mierniki, 
                devices,
                mqtt: None
            }
        })
    })
}

fn weight_reading_strategy() -> impl Strategy<Value = WeightReading> {
    (
        0.0f64..=1000.0,
        prop_oneof!["kg", "g", "lb", "oz"].prop_map(|unit| unit.to_string()),
        any::<bool>(),
        any::<i64>().prop_map(|seconds| Utc::now() + Duration::seconds(seconds % 86_400)),
    )
        .prop_flat_map(|(gross_weight, unit, is_stable, timestamp)| {
            // Ensure net_weight <= gross_weight
            (Just(gross_weight), 0.0f64..=gross_weight, Just(unit), Just(is_stable), Just(timestamp))
        })
        .prop_map(
            |(gross_weight, net_weight, unit, is_stable, timestamp)| WeightReading {
            gross_weight,
            net_weight,
            unit,
            is_stable,
            timestamp,
            },
        )
}

fn scale_command_request_strategy() -> impl Strategy<Value = ScaleCommandRequest> {
    (
        id_strategy(),
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
    fn prop_app_config_serialization_roundtrip(app_config in app_config_strategy()) {
        let json = serde_json::to_string_pretty(&app_config).unwrap();
        let deserialized: AppConfig = serde_json::from_str(&json).unwrap();

        prop_assert_eq!(app_config.devices.len(), deserialized.devices.len());
        prop_assert_eq!(app_config.hosts.len(), deserialized.hosts.len());
        prop_assert_eq!(app_config.mierniki.len(), deserialized.mierniki.len());

        for (device_id, original_config) in &app_config.devices {
            let deserialized_config = &deserialized.devices[device_id];
            prop_assert_eq!(&original_config.name, &deserialized_config.name);
            prop_assert_eq!(original_config.enabled, deserialized_config.enabled);
            prop_assert_eq!(&original_config.host_id, &deserialized_config.host_id);
            prop_assert_eq!(&original_config.miernik_id, &deserialized_config.miernik_id);
        }
    }

    #[test]
    fn prop_weight_reading_serialization_roundtrip(reading in weight_reading_strategy()) {
        let json = serde_json::to_string(&reading).unwrap();
        let deserialized: WeightReading = serde_json::from_str(&json).unwrap();

        // Use approximate comparison for floating point values due to JSON precision
        prop_assert!((reading.gross_weight - deserialized.gross_weight).abs() < 1e-10);
        prop_assert!((reading.net_weight - deserialized.net_weight).abs() < 1e-10);
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
    fn prop_device_config_name_constraints(name in name_strategy()) {
        // Verify the strategy generates valid names
        prop_assert!(name.len() >= 3, "name length should be at least 3, got {}", name.len());
        prop_assert!(name.len() <= 50, "name length should be at most 50, got {}", name.len());
        prop_assert!(
            name.chars().all(|c| c.is_ascii_alphanumeric() || " -_".contains(c)),
            "name contains invalid characters: '{}'",
            name
        );
        prop_assert!(!name.trim().is_empty(), "name should not be only whitespace: '{}'", name);
    }

    #[test]
    fn prop_device_id_constraints(device_id in id_strategy()) {
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
