use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use serde_json::json;
use std::collections::HashMap;
use std::time::Duration;
use tempfile::TempDir;
use tokio::runtime::Runtime;

use scaleit_bridge::device_manager::DeviceManager;
use scaleit_bridge::models::device::{AppConfig, ConnectionConfig, DeviceConfig};
use scaleit_bridge::models::weight::{ScaleCommandRequest, WeightReading};

// Benchmark configuration creation
fn create_benchmark_config(device_count: usize) -> (AppConfig, TempDir) {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let mut devices = HashMap::new();

    for i in 0..device_count {
        let device_id = format!("DEVICE_{:03}", i);
        let mut commands = HashMap::new();
        commands.insert("readGross".to_string(), "20050026".to_string());
        commands.insert("readNet".to_string(), "20050025".to_string());
        commands.insert("tare".to_string(), "21120008:0C".to_string());
        commands.insert("zero".to_string(), "21120008:0B".to_string());

        let device_config = DeviceConfig {
            name: format!("Benchmark Device {}", i),
            manufacturer: "Benchmark Corp".to_string(),
            model: "BM-2000".to_string(),
            protocol: "RINCMD".to_string(),
            connection: ConnectionConfig::Tcp {
                host: "127.0.0.1".to_string(),
                port: 8000 + i as u16,
                timeout_ms: Some(3000),
            },
            commands,
            enabled: i % 10 != 0, // Disable every 10th device for variety
        };

        devices.insert(device_id, device_config);
    }

    let app_config = AppConfig { devices };
    (app_config, temp_dir)
}

// Benchmark: Configuration serialization/deserialization
fn bench_config_serialization(c: &mut Criterion) {
    let mut group = c.benchmark_group("config_serialization");

    for device_count in [1, 5, 10, 25, 50, 100].iter() {
        let (app_config, _temp_dir) = create_benchmark_config(*device_count);

        group.throughput(Throughput::Elements(*device_count as u64));

        group.bench_with_input(
            BenchmarkId::new("serialize", device_count),
            &app_config,
            |b, config| {
                b.iter(|| black_box(serde_json::to_string_pretty(black_box(config)).unwrap()))
            },
        );

        let json_string = serde_json::to_string_pretty(&app_config).unwrap();
        group.bench_with_input(
            BenchmarkId::new("deserialize", device_count),
            &json_string,
            |b, json| {
                b.iter(|| black_box(serde_json::from_str::<AppConfig>(black_box(json)).unwrap()))
            },
        );

        // File I/O benchmarks
        let config_path = _temp_dir.path().join("benchmark_config.json");
        std::fs::write(&config_path, &json_string).unwrap();

        group.bench_with_input(
            BenchmarkId::new("file_read", device_count),
            &config_path,
            |b, path| b.iter(|| black_box(std::fs::read_to_string(black_box(path)).unwrap())),
        );

        group.bench_with_input(
            BenchmarkId::new("file_write", device_count),
            &(config_path.clone(), json_string.clone()),
            |b, (path, content)| {
                b.iter(|| black_box(std::fs::write(black_box(path), black_box(content)).unwrap()))
            },
        );
    }

    group.finish();
}

// Benchmark: DeviceManager creation and operations
fn bench_device_manager_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("device_manager");
    group.measurement_time(Duration::from_secs(10));

    for device_count in [1, 5, 10, 25].iter() {
        let (app_config, temp_dir) = create_benchmark_config(*device_count);
        let config_path = temp_dir.path().join("benchmark_config.json");
        let config_json = serde_json::to_string_pretty(&app_config).unwrap();
        std::fs::write(&config_path, config_json).unwrap();

        group.throughput(Throughput::Elements(*device_count as u64));

        // Benchmark DeviceManager creation
        group.bench_with_input(
            BenchmarkId::new("creation", device_count),
            &config_path,
            |b, path| b.iter(|| black_box(DeviceManager::from_path(black_box(path)).unwrap())),
        );

        // Benchmark device listing
        let device_manager = DeviceManager::from_path(&config_path).unwrap();
        group.bench_with_input(
            BenchmarkId::new("get_devices", device_count),
            &device_manager,
            |b, dm| b.iter(|| black_box(dm.get_devices())),
        );

        // Benchmark configuration listing
        group.bench_with_input(
            BenchmarkId::new("list_configs", device_count),
            &device_manager,
            |b, dm| b.iter(|| black_box(dm.list_configs())),
        );

        // Benchmark individual device config retrieval
        let device_ids: Vec<_> = app_config.devices.keys().cloned().collect();
        if !device_ids.is_empty() {
            let test_device_id = &device_ids[0];
            group.bench_with_input(
                BenchmarkId::new("get_config", device_count),
                &(device_manager, test_device_id),
                |b, (dm, device_id)| {
                    b.iter(|| black_box(dm.get_config(black_box(device_id)).unwrap()))
                },
            );
        }
    }

    group.finish();
}

// Benchmark: Weight reading serialization
fn bench_weight_reading_serialization(c: &mut Criterion) {
    let mut group = c.benchmark_group("weight_reading");

    let weight_reading = WeightReading {
        gross_weight: Some(42.75),
        net_weight: Some(40.25),
        unit: Some("kg".to_string()),
        is_stable: Some(true),
        timestamp: Some(chrono::Utc::now()),
        status: Some("OK".to_string()),
        tare_weight: Some(2.5),
    };

    group.bench_function("serialize", |b| {
        b.iter(|| black_box(serde_json::to_string(black_box(&weight_reading)).unwrap()))
    });

    let json_string = serde_json::to_string(&weight_reading).unwrap();
    group.bench_function("deserialize", |b| {
        b.iter(|| {
            black_box(serde_json::from_str::<WeightReading>(black_box(&json_string)).unwrap())
        })
    });

    // Benchmark different weight reading variations
    let readings = vec![
        // Minimal reading
        WeightReading {
            gross_weight: Some(10.0),
            net_weight: None,
            unit: Some("kg".to_string()),
            is_stable: Some(false),
            timestamp: None,
            status: None,
            tare_weight: None,
        },
        // Full reading
        WeightReading {
            gross_weight: Some(123.456),
            net_weight: Some(120.123),
            unit: Some("kg".to_string()),
            is_stable: Some(true),
            timestamp: Some(chrono::Utc::now()),
            status: Some("STABLE_OK".to_string()),
            tare_weight: Some(3.333),
        },
        // Large values
        WeightReading {
            gross_weight: Some(99999.999),
            net_weight: Some(99999.999),
            unit: Some("g".to_string()),
            is_stable: Some(true),
            timestamp: Some(chrono::Utc::now()),
            status: Some("HIGH_PRECISION_STABLE".to_string()),
            tare_weight: Some(0.0),
        },
    ];

    for (i, reading) in readings.iter().enumerate() {
        group.bench_with_input(
            BenchmarkId::new("serialize_variant", i),
            reading,
            |b, reading| b.iter(|| black_box(serde_json::to_string(black_box(reading)).unwrap())),
        );
    }

    group.finish();
}

// Benchmark: Scale command request processing
fn bench_scale_command_processing(c: &mut Criterion) {
    let mut group = c.benchmark_group("scale_commands");

    let commands = vec![
        ScaleCommandRequest {
            device_id: "DEVICE_001".to_string(),
            command: "readGross".to_string(),
        },
        ScaleCommandRequest {
            device_id: "DEVICE_002".to_string(),
            command: "readNet".to_string(),
        },
        ScaleCommandRequest {
            device_id: "DEVICE_003".to_string(),
            command: "tare".to_string(),
        },
        ScaleCommandRequest {
            device_id: "DEVICE_004".to_string(),
            command: "zero".to_string(),
        },
    ];

    for (i, command) in commands.iter().enumerate() {
        group.bench_with_input(
            BenchmarkId::new("serialize_request", i),
            command,
            |b, cmd| b.iter(|| black_box(serde_json::to_string(black_box(cmd)).unwrap())),
        );

        let json_string = serde_json::to_string(command).unwrap();
        group.bench_with_input(
            BenchmarkId::new("deserialize_request", i),
            &json_string,
            |b, json| {
                b.iter(|| {
                    black_box(serde_json::from_str::<ScaleCommandRequest>(black_box(json)).unwrap())
                })
            },
        );
    }

    group.finish();
}

// Benchmark: Concurrent operations simulation
fn bench_concurrent_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("concurrent_ops");
    group.measurement_time(Duration::from_secs(15));

    let (app_config, temp_dir) = create_benchmark_config(10);
    let config_path = temp_dir.path().join("concurrent_config.json");
    let config_json = serde_json::to_string_pretty(&app_config).unwrap();
    std::fs::write(&config_path, config_json).unwrap();

    let device_manager = std::sync::Arc::new(DeviceManager::from_path(&config_path).unwrap());

    // Simulate concurrent device listing operations
    group.bench_function("concurrent_get_devices", |b| {
        let rt = Runtime::new().unwrap();
        b.iter(|| {
            rt.block_on(async {
                let futures = (0..10).map(|_| {
                    let dm = device_manager.clone();
                    tokio::spawn(async move { black_box(dm.get_devices()) })
                });

                let results = futures_util::future::join_all(futures).await;
                black_box(results)
            })
        })
    });

    // Simulate concurrent config operations
    group.bench_function("concurrent_list_configs", |b| {
        let rt = Runtime::new().unwrap();
        b.iter(|| {
            rt.block_on(async {
                let futures = (0..10).map(|_| {
                    let dm = device_manager.clone();
                    tokio::spawn(async move { black_box(dm.list_configs()) })
                });

                let results = futures_util::future::join_all(futures).await;
                black_box(results)
            })
        })
    });

    group.finish();
}

// Benchmark: Memory usage patterns
fn bench_memory_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_ops");

    // Benchmark large configuration handling
    for size_multiplier in [1, 2, 5, 10].iter() {
        let device_count = 50 * size_multiplier;
        let (app_config, _temp_dir) = create_benchmark_config(device_count);

        group.throughput(Throughput::Bytes((device_count * 1000) as u64)); // Rough estimate

        group.bench_with_input(
            BenchmarkId::new("large_config_clone", size_multiplier),
            &app_config,
            |b, config| b.iter(|| black_box(config.clone())),
        );

        group.bench_with_input(
            BenchmarkId::new("large_config_drop", size_multiplier),
            &app_config,
            |b, config| {
                b.iter(|| {
                    let cloned = config.clone();
                    black_box(drop(cloned))
                })
            },
        );
    }

    group.finish();
}

// Benchmark: Error handling performance
fn bench_error_handling(c: &mut Criterion) {
    let mut group = c.benchmark_group("error_handling");

    use scaleit_bridge::error::BridgeError;

    let errors = vec![
        BridgeError::DeviceNotFound("NONEXISTENT".to_string()),
        BridgeError::ConnectionError("Connection timeout".to_string()),
        BridgeError::CommandError("Invalid command format".to_string()),
        BridgeError::ConfigurationError("Missing required field".to_string()),
        BridgeError::Timeout("Operation timed out after 5000ms".to_string()),
        BridgeError::ProtocolError("Unsupported protocol version".to_string()),
        BridgeError::InvalidCommand("Command not supported by device".to_string()),
    ];

    for (i, error) in errors.iter().enumerate() {
        group.bench_with_input(BenchmarkId::new("error_to_string", i), error, |b, err| {
            b.iter(|| black_box(err.to_string()))
        });

        group.bench_with_input(BenchmarkId::new("error_clone", i), error, |b, err| {
            b.iter(|| black_box(err.clone()))
        });
    }

    // Benchmark error propagation
    group.bench_function("error_propagation", |b| {
        b.iter(|| {
            let result: Result<(), BridgeError> =
                Err(BridgeError::DeviceNotFound("TEST".to_string()));
            let propagated = result.map_err(|e| BridgeError::InternalServerError(e.to_string()));
            black_box(propagated)
        })
    });

    group.finish();
}

// Benchmark: String operations (common in config handling)
fn bench_string_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("string_ops");

    let device_ids = (0..1000)
        .map(|i| format!("DEVICE_{:06}", i))
        .collect::<Vec<_>>();
    let device_names = (0..1000)
        .map(|i| format!("Industrial Scale Unit {}", i))
        .collect::<Vec<_>>();

    group.bench_function("device_id_format", |b| {
        b.iter(|| {
            for i in 0..100 {
                black_box(format!("DEVICE_{:06}", black_box(i)));
            }
        })
    });

    group.bench_function("device_name_clone", |b| {
        b.iter(|| {
            for name in device_names.iter().take(100) {
                black_box(name.clone());
            }
        })
    });

    group.bench_function("device_id_contains", |b| {
        b.iter(|| {
            for id in device_ids.iter().take(100) {
                black_box(id.contains("DEVICE"));
            }
        })
    });

    group.bench_function("string_concatenation", |b| {
        b.iter(|| {
            for i in 0..100 {
                let result = format!("{}_{}_{}", "prefix", black_box(i), "suffix");
                black_box(result);
            }
        })
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_config_serialization,
    bench_device_manager_operations,
    bench_weight_reading_serialization,
    bench_scale_command_processing,
    bench_concurrent_operations,
    bench_memory_operations,
    bench_error_handling,
    bench_string_operations
);

criterion_main!(benches);
