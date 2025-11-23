use actix_web::{web, App, HttpServer, Responder, HttpResponse};
use env_logger::{Builder, Env};
use log::{info, error};
use std::sync::Arc;
use parking_lot::RwLock;
use lazy_static::lazy_static;
use config::Config;

use scaleit_bridge::models::device::{AppConfig, DeviceConfig};
use scaleit_bridge::models::weight::{HealthResponse, ScaleCommandRequest, ScaleCommandResponse, DeviceListResponse};
use scaleit_bridge::error::BridgeError;

// Placeholder for device manager
struct DeviceManager {
    config: AppConfig,
}

impl DeviceManager {
    fn new(config: AppConfig) -> Self {
        DeviceManager { config }
    }

    async fn execute_command(&self, request: ScaleCommandRequest) -> Result<ScaleCommandResponse, BridgeError> {
        info!("Executing command: {:?} for device: {}", request.command, request.device_id);
        // Placeholder for actual command execution logic
        Err(BridgeError::CommandError(format!("Command '{}' not implemented yet for device '{}'", request.command, request.device_id)))
    }

    fn get_devices(&self) -> Vec<(String, String, String)> {
        self.config.devices.iter()
            .map(|(id, dev)| (id.clone(), dev.name.clone(), dev.model.clone()))
            .collect()
    }
}

lazy_static! {
    static ref APP_CONFIG: RwLock<Option<AppConfig>> = RwLock::new(None);
    static ref DEVICE_MANAGER: RwLock<Option<Arc<DeviceManager>>> = RwLock::new(None);
}

async fn health_check() -> impl Responder {
    info!("Received health check request");
    HttpResponse::Ok().json(HealthResponse {
        status: "OK".to_string(),
        service: "ScaleIT Bridge".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

async fn list_devices() -> impl Responder {
    info!("Received list devices request");
    let dm_guard = DEVICE_MANAGER.read();
    if let Some(dm) = dm_guard.as_ref() {
        HttpResponse::Ok().json(DeviceListResponse {
            success: true,
            devices: dm.get_devices(),
        })
    } else {
        error!("Device manager not initialized.");
        HttpResponse::InternalServerError().json(DeviceListResponse {
            success: false,
            devices: vec![],
        })
    }
}

async fn handle_scalecmd(req_body: web::Json<ScaleCommandRequest>) -> impl Responder {
    info!("Received scalecmd request for device: {}", req_body.device_id);
    let dm_guard = DEVICE_MANAGER.read();
    if let Some(dm) = dm_guard.as_ref() {
        match dm.execute_command(req_body.into_inner()).await {
            Ok(response) => HttpResponse::Ok().json(response),
            Err(e) => {
                error!("Error executing command: {:?}", e);
                HttpResponse::InternalServerError().json(ScaleCommandResponse {
                    success: false,
                    device_id: req_body.device_id.clone(),
                    command: req_body.command.clone(),
                    result: None,
                    error: Some(e.to_string()),
                })
            }
        }
    } else {
        error!("Device manager not initialized.");
        HttpResponse::InternalServerError().json(ScaleCommandResponse {
            success: false,
            device_id: req_body.device_id.clone(),
            command: req_body.command.clone(),
            result: None,
            error: Some("Device manager not initialized".to_string()),
        })
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    Builder::from_env(Env::default().default_filter_or("info")).init();

    info!("Starting ScaleIT Bridge v{}", env!("CARGO_PKG_VERSION"));

    // Load configuration
    let settings = Config::builder()
        .add_source(config::File::with_name("config/devices.json"))
        .build()
        .map_err(|e| {
            error!("Failed to load configuration: {}", e);
            std::io::Error::new(std::io::ErrorKind::Other, format!("Config error: {}", e))
        })?;

    let app_config: AppConfig = settings.try_deserialize()
        .map_err(|e| {
            error!("Failed to deserialize configuration: {}", e);
            std::io::Error::new(std::io::ErrorKind::Other, format!("Deserialization error: {}", e))
        })?;

    info!("Configuration loaded successfully. Devices: {:?}", app_config.devices.keys());

    // Initialize global APP_CONFIG and DEVICE_MANAGER
    *APP_CONFIG.write() = Some(app_config.clone());
    *DEVICE_MANAGER.write() = Some(Arc::new(DeviceManager::new(app_config)));

    let host = "0.0.0.0";
    let port = 8080;

    info!("Server running on http://{}:{}", host, port);

    HttpServer::new(|| {
        App::new()
            .service(web::resource("/health").to(health_check))
            .service(web::resource("/devices").to(list_devices))
            .service(web::resource("/scalecmd").to(handle_scalecmd))
    })
    .bind(format!("{}:{}", host, port))?
    .run()
    .await
}