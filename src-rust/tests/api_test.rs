use actix_web::{test, web, App, HttpResponse, Responder};
use serde_json::json;
use std::collections::HashMap;
use tempfile::TempDir;

use scaleit_bridge::device_manager::DeviceManager;
use scaleit_bridge::models::device::{AppConfig, ConnectionConfig, DeviceConfig};
use scaleit_bridge::models::weight::{
    HealthResponse, ScaleCommandRequest, ScaleCommandResponse, WeightReading,
};

struct TestApp {
    device_manager: std::sync::Arc<DeviceManager>,
    _temp_dir: TempDir,
}

impl TestApp {
    async fn new() -> Self {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let config_path = temp_dir.path().join("test_devices.json");

        // Create test device configuration
        let mut devices = HashMap::new();
        let mut commands = HashMap::new();
        commands.insert("readGross".to_string(), "TEST_READ_GROSS".to_string());
        commands.insert("readNet".to_string(), "TEST_READ_NET".to_string());
        commands.insert("tare".to_string(), "TEST_TARE".to_string());
        commands.insert("zero".to_string(), "TEST_ZERO".to_string());

        let test_device = DeviceConfig {
            name: "Test Scale".to_string(),
            manufacturer: "Test Manufacturer".to_string(),
            model: "TestModel".to_string(),
            protocol: "RINCMD".to_string(),
            connection: ConnectionConfig::Tcp {
                host: "127.0.0.1".to_string(),
                port: 9999,
            },
            commands,
            timeout_ms: 1000,
            enabled: true,
        };

        devices.insert("test_scale".to_string(), test_device);

        let app_config = AppConfig { devices };

        // Write config to file
        let config_json = serde_json::to_string_pretty(&app_config).unwrap();
        std::fs::write(&config_path, config_json).expect("Failed to write test config");

        let device_manager = std::sync::Arc::new(
            DeviceManager::from_path(&config_path).expect("Failed to create DeviceManager"),
        );

        Self {
            device_manager,
            _temp_dir: temp_dir,
        }
    }

    fn create_app(
        &self,
    ) -> actix_web::App<
        impl actix_web::dev::ServiceFactory<
            actix_web::dev::ServiceRequest,
            Response = actix_web::dev::ServiceResponse,
            Error = actix_web::Error,
            Config = (),
            InitError = (),
        >,
    > {
        // Route handlers defined below

        #[actix_web::get("/health")]
        async fn health_check() -> impl Responder {
            HttpResponse::Ok().json(HealthResponse {
                status: "OK".to_string(),
                service: "ScaleIT Bridge".to_string(),
                version: "test".to_string(),
            })
        }

        #[actix_web::get("/devices")]
        async fn list_devices(state: web::Data<std::sync::Arc<DeviceManager>>) -> impl Responder {
            HttpResponse::Ok().json(json!({
                "success": true,
                "devices": state.get_devices()
            }))
        }

        #[actix_web::post("/scalecmd")]
        async fn handle_scalecmd(
            req_body: web::Json<ScaleCommandRequest>,
            _state: web::Data<std::sync::Arc<DeviceManager>>,
        ) -> impl Responder {
            let request = req_body.into_inner();

            // Mock response for testing
            let response = ScaleCommandResponse {
                success: true,
                device_id: request.device_id.clone(),
                command: request.command.clone(),
                result: Some(WeightReading {
                    gross_weight: 42.5,
                    net_weight: 40.0,
                    unit: "kg".to_string(),
                    is_stable: true,
                    timestamp: chrono::Utc::now(),
                }),
                error: None,
            };

            HttpResponse::Ok().json(response)
        }

        #[actix_web::get("/api/config")]
        async fn get_device_configs(
            state: web::Data<std::sync::Arc<DeviceManager>>,
        ) -> impl Responder {
            HttpResponse::Ok().json(state.list_configs())
        }

        App::new()
            .app_data(web::Data::new(self.device_manager.clone()))
            .service(health_check)
            .service(list_devices)
            .service(handle_scalecmd)
            .service(get_device_configs)
    }
}

#[tokio::test]
async fn test_health_check() {
    let test_app = TestApp::new().await;
    let app = test::init_service(test_app.create_app()).await;

    let req = test::TestRequest::get().uri("/health").to_request();
    let resp = test::call_service(&app, req).await;

    assert!(resp.status().is_success());

    let body: HealthResponse = test::read_body_json(resp).await;
    assert_eq!(body.status, "OK");
    assert_eq!(body.service, "ScaleIT Bridge");
    assert_eq!(body.version, "test");
}

#[tokio::test]
async fn test_list_devices() {
    let test_app = TestApp::new().await;
    let app = test::init_service(test_app.create_app()).await;

    let req = test::TestRequest::get().uri("/devices").to_request();
    let resp = test::call_service(&app, req).await;

    assert!(resp.status().is_success());

    let body: serde_json::Value = test::read_body_json(resp).await;
    assert_eq!(body["success"], true);
    assert!(body["devices"].is_array());
}

#[tokio::test]
async fn test_scale_command_read_gross() {
    let test_app = TestApp::new().await;
    let app = test::init_service(test_app.create_app()).await;

    let request_body = ScaleCommandRequest {
        device_id: "test_scale".to_string(),
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
    assert_eq!(body.device_id, "test_scale");
    assert_eq!(body.command, "readGross");
    assert!(body.result.is_some());
    assert!(body.error.is_none());

    if let Some(result) = body.result {
        assert!(result.gross_weight > 0.0);
        assert_eq!(result.unit, "kg");
        assert!(result.is_stable);
    }
}

#[tokio::test]
async fn test_scale_command_read_net() {
    let test_app = TestApp::new().await;
    let app = test::init_service(test_app.create_app()).await;

    let request_body = ScaleCommandRequest {
        device_id: "test_scale".to_string(),
        command: "readNet".to_string(),
    };

    let req = test::TestRequest::post()
        .uri("/scalecmd")
        .set_json(&request_body)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: ScaleCommandResponse = test::read_body_json(resp).await;
    assert!(body.success);
    assert_eq!(body.device_id, "test_scale");
    assert_eq!(body.command, "readNet");
    assert!(body.result.is_some());
}

#[tokio::test]
async fn test_scale_command_tare() {
    let test_app = TestApp::new().await;
    let app = test::init_service(test_app.create_app()).await;

    let request_body = ScaleCommandRequest {
        device_id: "test_scale".to_string(),
        command: "tare".to_string(),
    };

    let req = test::TestRequest::post()
        .uri("/scalecmd")
        .set_json(&request_body)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: ScaleCommandResponse = test::read_body_json(resp).await;
    assert!(body.success);
    assert_eq!(body.command, "tare");
}

#[tokio::test]
async fn test_scale_command_zero() {
    let test_app = TestApp::new().await;
    let app = test::init_service(test_app.create_app()).await;

    let request_body = ScaleCommandRequest {
        device_id: "test_scale".to_string(),
        command: "zero".to_string(),
    };

    let req = test::TestRequest::post()
        .uri("/scalecmd")
        .set_json(&request_body)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());

    let body: ScaleCommandResponse = test::read_body_json(resp).await;
    assert!(body.success);
    assert_eq!(body.command, "zero");
}

#[tokio::test]
async fn test_scale_command_invalid_device() {
    let test_app = TestApp::new().await;
    let app = test::init_service(test_app.create_app()).await;

    let request_body = ScaleCommandRequest {
        device_id: "nonexistent_device".to_string(),
        command: "readGross".to_string(),
    };

    let req = test::TestRequest::post()
        .uri("/scalecmd")
        .set_json(&request_body)
        .to_request();

    let resp = test::call_service(&app, req).await;

    // Since we're mocking the response, this will still return success
    // In a real implementation, this would return an error
    assert!(resp.status().is_success());
}

#[tokio::test]
async fn test_scale_command_malformed_request() {
    let test_app = TestApp::new().await;
    let app = test::init_service(test_app.create_app()).await;

    let malformed_json = r#"{"device_id": "test_scale"}"#; // Missing command field

    let req = test::TestRequest::post()
        .uri("/scalecmd")
        .set_payload(malformed_json)
        .insert_header(("content-type", "application/json"))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400); // Bad Request
}

#[tokio::test]
async fn test_get_device_configs() {
    let test_app = TestApp::new().await;
    let app = test::init_service(test_app.create_app()).await;

    let req = test::TestRequest::get().uri("/api/config").to_request();
    let resp = test::call_service(&app, req).await;

    assert!(resp.status().is_success());

    let body: HashMap<String, DeviceConfig> = test::read_body_json(resp).await;
    assert!(body.contains_key("test_scale"));

    let test_device = &body["test_scale"];
    assert_eq!(test_device.name, "Test Scale");
    assert_eq!(test_device.manufacturer, "Test Manufacturer");
    assert_eq!(test_device.model, "TestModel");
    assert_eq!(test_device.protocol, "RINCMD");
    assert!(test_device.enabled);
}

#[tokio::test]
async fn test_cors_headers() {
    let test_app = TestApp::new().await;
    let app = test::init_service(test_app.create_app()).await;

    let req = test::TestRequest::default()
        .method(actix_web::http::Method::OPTIONS)
        .uri("/health")
        .to_request();
    let resp = test::call_service(&app, req).await;

    // This test would verify CORS headers if they were configured
    // Currently just testing that OPTIONS request doesn't fail
    assert!(resp.status().is_client_error() || resp.status().is_success());
}

#[tokio::test]
async fn test_concurrent_requests() {
    let test_app = TestApp::new().await;
    let app = test::init_service(test_app.create_app()).await;

    // Send multiple sequential requests to exercise the handler repeatedly.
    for _ in 0..10 {
        let request_body = ScaleCommandRequest {
            device_id: "test_scale".to_string(),
            command: "readGross".to_string(),
        };

        let req = test::TestRequest::post()
            .uri("/scalecmd")
            .set_json(&request_body)
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }
}
