use actix_cors::Cors;
use actix_web::{
    delete, get, post,
    web::{self, Data},
    App, HttpResponse, HttpServer, Responder,
};
use config::Config;
use env_logger::{Builder, Env};
use log::{error, info};
use serde_json::json;
use std::sync::Arc;

use scaleit_bridge::device_manager::DeviceManager;
use scaleit_bridge::error::BridgeError;
use scaleit_bridge::models::device::{AppConfig, SaveConfigRequest};
use scaleit_bridge::models::weight::{
    DeviceListResponse, HealthResponse, ScaleCommandRequest, ScaleCommandResponse,
};

struct AppState {
    device_manager: Arc<DeviceManager>,
}

impl AppState {
    fn new(device_manager: Arc<DeviceManager>) -> Self {
        Self { device_manager }
    }
}

fn bridge_error_response(
    device_id: Option<String>,
    command: Option<String>,
    err: BridgeError,
) -> HttpResponse {
    match err {
        BridgeError::DeviceNotFound(_) => HttpResponse::NotFound().json(json!({
            "success": false,
            "error": err.to_string()
        })),
        BridgeError::ConfigurationError(_) => HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": err.to_string()
        })),
        _ => HttpResponse::InternalServerError().json(ScaleCommandResponse {
            success: false,
            device_id: device_id.unwrap_or_default(),
            command: command.unwrap_or_default(),
            result: None,
            error: Some(err.to_string()),
        }),
    }
}

#[get("/health")]
async fn health_check() -> impl Responder {
    info!("Received health check request");
    HttpResponse::Ok().json(HealthResponse {
        status: "OK".to_string(),
        service: "ScaleIT Bridge".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[get("/devices")]
async fn list_devices(state: Data<AppState>) -> impl Responder {
    info!("Received list devices request");
    HttpResponse::Ok().json(DeviceListResponse {
        success: true,
        devices: state.device_manager.get_devices(),
    })
}

#[post("/scalecmd")]
async fn handle_scalecmd(
    req_body: web::Json<ScaleCommandRequest>,
    state: Data<AppState>,
) -> impl Responder {
    let request = req_body.into_inner();
    let device_id = request.device_id.clone();
    let command = request.command.clone();
    info!("Received scalecmd request for device: {}", device_id);

    match state.device_manager.execute_command(request).await {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => {
            error!("Error executing command: {:?}", e);
            bridge_error_response(Some(device_id), Some(command), e)
        }
    }
}

#[get("/api/config")]
async fn get_device_configs(state: Data<AppState>) -> impl Responder {
    HttpResponse::Ok().json(state.device_manager.list_configs())
}

#[post("/api/config/save")]
async fn save_device_config(
    payload: web::Json<SaveConfigRequest>,
    state: Data<AppState>,
) -> impl Responder {
    let device_id = payload.device_id.clone();
    if let Err(e) = state
        .device_manager
        .save_config(&device_id, payload.config.clone())
        .await
    {
        error!("Failed to save config: {:?}", e);
        return bridge_error_response(Some(device_id), None, e);
    }

    if let Err(e) = state.device_manager.reload_config().await {
        error!("Failed to reload config: {:?}", e);
        return bridge_error_response(Some(device_id), None, e);
    }

    HttpResponse::Ok().json(json!({
        "success": true,
        "message": format!("Configuration for {} saved and reloaded.", device_id)
    }))
}

#[delete("/api/config/{device_id}")]
async fn delete_device_config(
    device_id: web::Path<String>,
    state: Data<AppState>,
) -> impl Responder {
    let id = device_id.into_inner();
    if let Err(e) = state.device_manager.delete_config(&id).await {
        error!("Failed to delete config: {:?}", e);
        return bridge_error_response(Some(id.clone()), None, e);
    }

    if let Err(e) = state.device_manager.reload_config().await {
        error!("Failed to reload config: {:?}", e);
        return bridge_error_response(Some(id.clone()), None, e);
    }

    HttpResponse::Ok().json(json!({
        "success": true,
        "message": format!("Device {} deleted and configuration reloaded.", id)
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    Builder::from_env(Env::default().default_filter_or("info")).init();

    info!("Starting ScaleIT Bridge v{}", env!("CARGO_PKG_VERSION"));

    let config_path =
        std::env::var("CONFIG_PATH").unwrap_or_else(|_| "config/devices.json".to_string());
    let settings = Config::builder()
        .add_source(config::File::with_name(&config_path))
        .build()
        .map_err(|e| {
            error!("Failed to load configuration: {}", e);
            std::io::Error::new(std::io::ErrorKind::Other, format!("Config error: {}", e))
        })?;

    let app_config: AppConfig = settings.try_deserialize().map_err(|e| {
        error!("Failed to deserialize configuration: {}", e);
        std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Deserialization error: {}", e),
        )
    })?;

    info!(
        "Configuration loaded successfully. Devices: {:?}",
        app_config.devices.keys()
    );

    let dm = Arc::new(
        DeviceManager::from_config(&config_path, app_config).map_err(|e| {
            error!("Failed to initialize DeviceManager: {}", e);
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("DeviceManager init error: {}", e),
            )
        })?,
    );

    dm.connect_all_devices().await;

    let host = "0.0.0.0";
    let port = 8080;

    info!("Server running on http://{}:{}", host, port);

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
    })
    .expect("Error setting Ctrl-C handler");

    HttpServer::new(move || {
        let state = AppState::new(dm.clone());
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .supports_credentials()
            .max_age(3600);
        
        App::new()
            .wrap(cors)
            .app_data(Data::new(state))
            .service(health_check)
            .service(list_devices)
            .service(handle_scalecmd)
            .service(get_device_configs)
            .service(save_device_config)
            .service(delete_device_config)
    })
    .bind(format!("{}:{}", host, port))?
    .run()
    .await
}
