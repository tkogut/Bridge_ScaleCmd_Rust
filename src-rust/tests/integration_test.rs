use actix_web::{test, web, App, HttpServer};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tempfile::TempDir;
use tokio::time::timeout;

use scaleit_bridge::device_manager::DeviceManager;
use scaleit_bridge::models::device::{AppConfig, ConnectionConfig, DeviceConfig};
use scaleit_bridge::models::weight::{
    DeviceListResponse, HealthResponse, ScaleCommandRequest, ScaleCommandResponse,
};

struct TestEnvironment {
    device_manager: Arc<DeviceManager>,
    _temp_dir: TempDir,
}

impl TestEnvironment {
    async fn setup() -> Self {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let config_path = temp_dir.path().join("integration_test_devices.json");

        // Create comprehensive test configuration
        let mut devices = HashMap::new();

        // Rinstrum C320 device
        let mut rinstrum_commands = HashMap::new();
        rinstrum_commands.insert("readGross".to_string(), "20050026".to_string());
        rinstrum_commands.insert("readNet".to_string(), "20050025".to_string());
        rinstrum_commands.insert("tare".to_string(), "21120008:0C".to_string());
        rinstrum_commands.insert("zero".to_string(), "21120008:0B".to_string());

        let rinstrum_device = DeviceConfig {
            name: "C320 Rinstrum".to_string(),
            manufacturer: "Rinstrum".to_string(),
            model: "C320".to_string(),
            protocol: "RINCMD".to_string(),
            connection: ConnectionConfig::Tcp {
                host: "127.0.0.1".to_string(),
                port: 4001,
                timeout_ms: Some(3000),
            },
            commands: rinstrum_commands,
            enabled: true,
        };

        // Dini Argeo device
        let mut dini_commands = HashMap::new();
        dini_commands.insert("readGross".to_string(), "READ".to_string());
        dini_commands.insert("readNet".to_string(), "REXT".to_string());
        dini_commands.insert("tare".to_string(), "TARE".to_string());
        dini_commands.insert("zero".to_string(), "ZERO".to_string());

        let dini_device = DeviceConfig {
            name: "DFW - Dini Argeo".to_string(),
            manufacturer: "Dini Argeo".to_string(),
            model: "DFW".to_string(),
            protocol: "DINI_ARGEO".to_string(),
            connection: ConnectionConfig::Serial {
                port: "/dev/ttyUSB0".to_string(),
                baud_rate: 9600,
                timeout_ms: Some(1000),
            },
            commands: dini_commands,
            enabled: true,
        };

        // Disabled device for testing
        let mut disabled_commands = HashMap::new();
        disabled_commands.insert("readGross".to_string(), "TEST".to_string());

        let disabled_device = DeviceConfig {
            name: "Disabled Scale".to_string(),
            manufacturer: "Test Corp".to_string(),
            model: "Disabled".to_string(),
            protocol: "RINCMD".to_string(),
            connection: ConnectionConfig::Tcp {
                host: "127.0.0.1".to_string(),
                port: 9999,
                timeout_ms: Some(1000),
            },
            commands: disabled_commands,
            enabled: false,
        };

        devices.insert("C320".to_string(), rinstrum_device);
        devices.insert("DWF".to_string(), dini_device);
        devices.insert("DISABLED".to_string(), disabled_device);

        let app_config = AppConfig { devices };

        // Write config to file
        let config_json = serde_json::to_string_pretty(&app_config).unwrap();
        std::fs::write(&config_path, config_json).expect("Failed to write test config");

        let device_manager = Arc::new(
            DeviceManager::from_path(&config_path).expect("Failed to create DeviceManager"),
        );

        Self {
            device_manager,
            _temp_dir: temp_dir,
        }
    }

    fn create_test_app(
        &self,
    ) -> App<
        impl actix_web::dev::ServiceFactory<
            actix_web::dev::ServiceRequest,
            Response = actix_web::dev::ServiceResponse,
            Error = actix_web::Error,
            Config = (),
            InitError = (),
        >,
    > {
        use actix_web::{delete, get, post};

        #[get("/health")]
        async fn health_check() -> impl actix_web::Responder {
            actix_web::HttpResponse::Ok().json(HealthResponse {
                status: "OK".to_string(),
                service: "ScaleIT Bridge".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
            })
        }

        #[get("/devices")]
        async fn list_devices(state: web::Data<Arc<DeviceManager>>) -> impl actix_web::Responder {
            actix_web::HttpResponse::Ok().json(DeviceListResponse {
                success: true,
                devices: state.get_devices(),
            })
        }

        #[post("/scalecmd")]
        async fn handle_scalecmd(
            req_body: web::Json<ScaleCommandRequest>,
            state: web::Data<Arc<DeviceManager>>,
        ) -> impl actix_web::Responder {
            let request = req_body.into_inner();
            let device_id = request.device_id.clone();
            let command = request.command.clone();

            // Mock successful response for integration tests
            match state.device_manager.get_config(&device_id) {
                Ok(config) if config.enabled => {
                    let response = ScaleCommandResponse {
                        success: true,
                        device_id: device_id.clone(),
                        command: command.clone(),
                        result: Some(scaleit_bridge::models::weight::WeightReading {
                            gross_weight: Some(45.7),
                            net_weight: Some(42.3),
                            unit: Some("kg".to_string()),
                            is_stable: Some(true),
                            timestamp: Some(chrono::Utc::now()),
                            status: None,
                            tare_weight: Some(3.4),
                        }),
                        error: None,
                    };
                    actix_web::HttpResponse::Ok().json(response)
                }
                Ok(_) => {
                    let error_response = ScaleCommandResponse {
                        success: false,
                        device_id,
                        command,
                        result: None,
                        error: Some("Device is disabled".to_string()),
                    };
                    actix_web::HttpResponse::BadRequest().json(error_response)
                }
                Err(e) => {
                    let error_response = ScaleCommandResponse {
                        success: false,
                        device_id,
                        command,
                        result: None,
                        error: Some(e.to_string()),
                    };
                    actix_web::HttpResponse::NotFound().json(error_response)
                }
            }
        }

        #[get("/api/config")]
        async fn get_device_configs(
            state: web::Data<Arc<DeviceManager>>,
        ) -> impl actix_web::Responder {
            actix_web::HttpResponse::Ok().json(state.list_configs())
        }

        #[post("/api/config/save")]
        async fn save_device_config(
            payload: web::Json<scaleit_bridge::models::device::SaveConfigRequest>,
            state: web::Data<Arc<DeviceManager>>,
        ) -> impl actix_web::Responder {
            let device_id = payload.device_id.clone();

            match state.save_config(&device_id, payload.config.clone()).await {
                Ok(_) => actix_web::HttpResponse::Ok().json(json!({
                    "success": true,
                    "message": format!("Configuration for {} saved.", device_id)
                })),
                Err(e) => actix_web::HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": e.to_string()
                })),
            }
        }

        #[delete("/api/config/{device_id}")]
        async fn delete_device_config(
            device_id: web::Path<String>,
            state: web::Data<Arc<DeviceManager>>,
        ) -> impl actix_web::Responder {
            let id = device_id.into_inner();

            match state.delete_config(&id).await {
                Ok(_) => actix_web::HttpResponse::Ok().json(json!({
                    "success": true,
                    "message": format!("Device {} deleted.", id)
                })),
                Err(e) => actix_web::HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": e.to_string()
                })),
            }
        }

        App::new()
            .app_data(web::Data::new(self.device_manager.clone()))
            .service(health_check)
            .service(list_devices)
            .service(handle_scalecmd)
            .service(get_device_configs)
            .service(save_device_config)
            .service(delete_device_config)
    }
}

#[actix_web::test]
async fn test_full_application_health_check() {
    let test_env = TestEnvironment::setup().await;
    let app = test::init_service(test_env.create_test_app()).await;

    let req = test::TestRequest::get().uri("/health").to_request();
    let resp = test::call_service(&app, req).await;

    assert!(resp.status().is_success());

    let body: HealthResponse = test::read_body_json(resp).await;
    assert_eq!(body.status, "OK");
    assert_eq!(body.service, "ScaleIT Bridge");
    assert!(!body.version.is_empty());
}

#[actix_web::test]
async fn test_full_application_device_listing() {
    let test_env = TestEnvironment::setup().await;
    let app = test::init_service(test_env.create_test_app()).await;

    let req = test::TestRequest::get().uri("/devices").to_request();
    let resp = test::call_service(&app, req).await;

    assert!(resp.status().is_success());

    let body: DeviceListResponse = test::read_body_json(resp).await;
    assert!(body.success);
    assert_eq!(body.devices.len(), 2); // Only enabled devices

    let device_ids: Vec<String> = body.devices.iter().map(|(id, _, _)| id.clone()).collect();
    assert!(device_ids.contains(&"C320".to_string()));
    assert!(device_ids.contains(&"DWF".to_string()));
    assert!(!device_ids.contains(&"DISABLED".to_string()));
}

#[actix_web::test]
async fn test_scale_command_workflow() {
    let test_env = TestEnvironment::setup().await;
    let app = test::init_service(test_env.create_test_app()).await;

    // Test all commands for C320 device
    let commands = ["readGross", "readNet", "tare", "zero"];

    for command in &commands {
        let request_body = ScaleCommandRequest {
            device_id: "C320".to_string(),
            command: command.to_string(),
        };

        let req = test::TestRequest::post()
            .uri("/scalecmd")
            .set_json(&request_body)
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success(), "Command {} failed", command);

        let body: ScaleCommandResponse = test::read_body_json(resp).await;
        assert!(body.success, "Command {} returned failure", command);
        assert_eq!(body.device_id, "C320");
        assert_eq!(body.command, *command);
        assert!(body.result.is_some());
        assert!(body.error.is_none());
    }
}

#[actix_web::test]
async fn test_scale_command_different_devices() {
    let test_env = TestEnvironment::setup().await;
    let app = test::init_service(test_env.create_test_app()).await;

    // Test C320 (RINCMD protocol)
    let c320_request = ScaleCommandRequest {
        device_id: "C320".to_string(),
        command: "readGross".to_string(),
    };

    let req = test::TestRequest::post()
        .uri("/scalecmd")
        .set_json(&c320_request)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: ScaleCommandResponse = test::read_body_json(resp).await;
    assert!(body.success);
    assert_eq!(body.device_id, "C320");

    // Test DWF (DINI_ARGEO protocol)
    let dwf_request = ScaleCommandRequest {
        device_id: "DWF".to_string(),
        command: "readGross".to_string(),
    };

    let req = test::TestRequest::post()
        .uri("/scalecmd")
        .set_json(&dwf_request)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: ScaleCommandResponse = test::read_body_json(resp).await;
    assert!(body.success);
    assert_eq!(body.device_id, "DWF");
}

#[actix_web::test]
async fn test_disabled_device_handling() {
    let test_env = TestEnvironment::setup().await;
    let app = test::init_service(test_env.create_test_app()).await;

    let request_body = ScaleCommandRequest {
        device_id: "DISABLED".to_string(),
        command: "readGross".to_string(),
    };

    let req = test::TestRequest::post()
        .uri("/scalecmd")
        .set_json(&request_body)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400); // Bad Request for disabled device

    let body: ScaleCommandResponse = test::read_body_json(resp).await;
    assert!(!body.success);
    assert!(body.error.is_some());
    assert!(body.error.unwrap().contains("disabled"));
}

#[actix_web::test]
async fn test_nonexistent_device_handling() {
    let test_env = TestEnvironment::setup().await;
    let app = test::init_service(test_env.create_test_app()).await;

    let request_body = ScaleCommandRequest {
        device_id: "NONEXISTENT".to_string(),
        command: "readGross".to_string(),
    };

    let req = test::TestRequest::post()
        .uri("/scalecmd")
        .set_json(&request_body)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404); // Not Found

    let body: ScaleCommandResponse = test::read_body_json(resp).await;
    assert!(!body.success);
    assert!(body.error.is_some());
    assert!(body.error.unwrap().contains("not found"));
}

#[actix_web::test]
async fn test_configuration_management() {
    let test_env = TestEnvironment::setup().await;
    let app = test::init_service(test_env.create_test_app()).await;

    // Get all configurations
    let req = test::TestRequest::get().uri("/api/config").to_request();
    let resp = test::call_service(&app, req).await;

    assert!(resp.status().is_success());

    let body: HashMap<String, DeviceConfig> = test::read_body_json(resp).await;
    assert_eq!(body.len(), 3); // All devices including disabled
    assert!(body.contains_key("C320"));
    assert!(body.contains_key("DWF"));
    assert!(body.contains_key("DISABLED"));

    // Verify device properties
    let c320_config = &body["C320"];
    assert_eq!(c320_config.name, "C320 Rinstrum");
    assert_eq!(c320_config.manufacturer, "Rinstrum");
    assert_eq!(c320_config.model, "C320");
    assert_eq!(c320_config.protocol, "RINCMD");
    assert!(c320_config.enabled);
}

#[actix_web::test]
async fn test_concurrent_scale_commands() {
    let test_env = TestEnvironment::setup().await;
    let app = test::init_service(test_env.create_test_app()).await;

    let mut handles = vec![];

    // Send concurrent requests to different devices
    for i in 0..20 {
        let device_id = if i % 2 == 0 { "C320" } else { "DWF" };
        let command = match i % 4 {
            0 => "readGross",
            1 => "readNet",
            2 => "tare",
            _ => "zero",
        };

        let app_ref = &app;
        let handle = tokio::spawn(async move {
            let request_body = ScaleCommandRequest {
                device_id: device_id.to_string(),
                command: command.to_string(),
            };

            let req = test::TestRequest::post()
                .uri("/scalecmd")
                .set_json(&request_body)
                .to_request();

            test::call_service(app_ref, req).await
        });
        handles.push(handle);
    }

    // Wait for all requests to complete
    for handle in handles {
        let resp = handle.await.unwrap();
        assert!(resp.status().is_success());
    }
}

#[actix_web::test]
async fn test_error_handling_malformed_requests() {
    let test_env = TestEnvironment::setup().await;
    let app = test::init_service(test_env.create_test_app()).await;

    // Test malformed JSON
    let malformed_json = r#"{"device_id": "C320""#; // Missing closing brace and command

    let req = test::TestRequest::post()
        .uri("/scalecmd")
        .set_payload(malformed_json)
        .insert_header(("content-type", "application/json"))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400); // Bad Request

    // Test missing required fields
    let incomplete_json = r#"{"device_id": "C320"}"#; // Missing command

    let req = test::TestRequest::post()
        .uri("/scalecmd")
        .set_payload(incomplete_json)
        .insert_header(("content-type", "application/json"))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400); // Bad Request
}

#[actix_web::test]
async fn test_weight_reading_data_integrity() {
    let test_env = TestEnvironment::setup().await;
    let app = test::init_service(test_env.create_test_app()).await;

    let request_body = ScaleCommandRequest {
        device_id: "C320".to_string(),
        command: "readGross".to_string(),
    };

    let req = test::TestRequest::post()
        .uri("/scalecmd")
        .set_json(&request_body)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: ScaleCommandResponse = test::read_body_json(resp).await;
    assert!(body.success);

    if let Some(result) = body.result {
        // Verify weight reading structure
        assert!(result.gross_weight.is_some());
        assert!(result.net_weight.is_some());
        assert!(result.unit.is_some());
        assert!(result.is_stable.is_some());
        assert!(result.timestamp.is_some());

        // Verify data types and ranges
        let gross_weight = result.gross_weight.unwrap();
        assert!(gross_weight > 0.0);
        assert!(gross_weight < 1000.0); // Reasonable range

        let unit = result.unit.unwrap();
        assert_eq!(unit, "kg");

        let is_stable = result.is_stable.unwrap();
        assert!(is_stable); // Mock data should be stable
    } else {
        panic!("Expected weight reading result");
    }
}

#[actix_web::test]
async fn test_stress_testing() {
    let test_env = TestEnvironment::setup().await;
    let app = test::init_service(test_env.create_test_app()).await;

    let start_time = std::time::Instant::now();
    let mut handles = vec![];

    // Send 100 concurrent requests
    for i in 0..100 {
        let device_id = if i % 2 == 0 { "C320" } else { "DWF" };
        let app_ref = &app;

        let handle = tokio::spawn(async move {
            let request_body = ScaleCommandRequest {
                device_id: device_id.to_string(),
                command: "readGross".to_string(),
            };

            let req = test::TestRequest::post()
                .uri("/scalecmd")
                .set_json(&request_body)
                .to_request();

            let result = timeout(Duration::from_secs(5), test::call_service(app_ref, req)).await;
            result.expect("Request timed out")
        });
        handles.push(handle);
    }

    let mut success_count = 0;
    for handle in handles {
        let resp = handle.await.unwrap();
        if resp.status().is_success() {
            success_count += 1;
        }
    }

    let duration = start_time.elapsed();

    // Verify performance characteristics
    assert_eq!(success_count, 100, "All requests should succeed");
    assert!(
        duration < Duration::from_secs(10),
        "Requests should complete within 10 seconds"
    );

    // Calculate average response time
    let avg_response_time = duration / 100;
    assert!(
        avg_response_time < Duration::from_millis(100),
        "Average response time should be under 100ms"
    );
}

#[actix_web::test]
async fn test_device_manager_lifecycle() {
    let test_env = TestEnvironment::setup().await;

    // Test device manager initialization
    let devices = test_env.device_manager.get_devices();
    assert_eq!(devices.len(), 2); // Only enabled devices

    // Test configuration access
    let configs = test_env.device_manager.list_configs();
    assert_eq!(configs.len(), 3); // All devices including disabled

    // Test connection lifecycle (these will fail gracefully with mock endpoints)
    let connect_result = timeout(
        Duration::from_secs(2),
        test_env.device_manager.connect_all_devices(),
    )
    .await;
    assert!(connect_result.is_ok());

    let disconnect_result = timeout(
        Duration::from_secs(2),
        test_env.device_manager.disconnect_all_devices(),
    )
    .await;
    assert!(disconnect_result.is_ok());
}
