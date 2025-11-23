use actix_web::{web, App, HttpServer, Responder, HttpResponse};
use env_logger::{Builder, Env};
use log::{info, error};
use std::sync::Arc;
use parking_lot::RwLock;
use lazy_static::lazy_static;
use config::Config;

use scaleit_bridge::models::device::{AppConfig};
use scaleit_bridge::models::weight::{HealthResponse, ScaleCommandRequest, ScaleCommandResponse, DeviceListResponse};
use scaleit_bridge::error::BridgeError;
use scaleit_bridge::device_manager::DeviceManager; // Importujemy nowy DeviceManager

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
        .add_source(config::File::with_name("src-rust/config/devices.json")) // Zaktualizowana ścieżka
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
    let dm = Arc::new(DeviceManager::new(app_config.clone())
        .map_err(|e| {
            error!("Failed to initialize DeviceManager: {}", e);
            std::io::Error::new(std::io::ErrorKind::Other, format!("DeviceManager init error: {}", e))
        })?);

    // Connect to all devices on startup
    dm.connect_all_devices().await;

    *APP_CONFIG.write() = Some(app_config);
    *DEVICE_MANAGER.write() = Some(dm.clone()); // Używamy sklonowanego Arc

    let host = "0.0.0.0";
    let port = 8080;

    info!("Server running on http://{}:{}", host, port);

    // Graceful shutdown handler
    let dm_for_shutdown = dm.clone();
    ctrlc::set_handler(move || {
        info!("Ctrl-C received, initiating graceful shutdown...");
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("Failed to create Tokio runtime for shutdown handler");
        rt.block_on(async {
            dm_for_shutdown.disconnect_all_devices().await;
            info!("All devices disconnected. Exiting.");
            std::process::exit(0);
        });
    }).expect("Error setting Ctrl-C handler");


    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(dm.clone())) // Przekazujemy DeviceManager do handlerów
            .service(web::resource("/health").to(health_check))
            .service(web::resource("/devices").to(list_devices))
            .service(web::resource("/scalecmd").to(handle_scalecmd))
    })
    .bind(format!("{}:{}", host, port))?
    .run()
    .await
}