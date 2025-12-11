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

#[post("/api/shutdown")]
async fn shutdown_server(state: Data<AppState>) -> impl Responder {
    info!("Shutdown request received");
    let dm = state.device_manager.clone();
    
    // Spawn task to handle graceful shutdown
    actix_web::rt::spawn(async move {
        info!("Initiating graceful shutdown...");
        dm.disconnect_all_devices().await;
        info!("All devices disconnected. Exiting.");
        // Exit the process gracefully
        std::process::exit(0);
    });

    HttpResponse::Ok().json(json!({
        "success": true,
        "message": "Shutdown initiated. Server will stop after disconnecting all devices."
    }))
}

#[post("/api/start")]
async fn start_server() -> impl Responder {
    info!("Start server request received");
    
    // Get the current executable directory
    let exe_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    
    // Try to find the run script or executable
    let project_root = exe_path
        .parent()
        .and_then(|p| p.parent())
        .unwrap_or_else(|| exe_path.as_path());
    
    let run_script = project_root.join("run-backend.ps1");
    let release_exe = exe_path.join("target").join("release").join("scaleit-bridge.exe");
    let debug_exe = exe_path.join("target").join("debug").join("scaleit-bridge.exe");
    
    // Determine what to run
    let command = if run_script.exists() {
        // Use PowerShell script
        format!(
            "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"{}\"",
            run_script.display()
        )
    } else if release_exe.exists() {
        // Use release executable
        format!("\"{}\"", release_exe.display())
    } else if debug_exe.exists() {
        // Use debug executable
        format!("\"{}\"", debug_exe.display())
    } else {
        // Fallback: try cargo run from src-rust
        let src_rust = project_root.join("src-rust");
        if src_rust.exists() {
            format!(
                "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"cd '{}'; cargo run\"",
                src_rust.display()
            )
        } else {
            return HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "Could not find server executable or run script. Please start the server manually."
            }));
        }
    };
    
        // Start the server in background
        #[cfg(windows)]
        {
            use std::process::Command;
            
            let result = if run_script.exists() {
                // Use PowerShell script directly
                Command::new("powershell.exe")
                    .args(&[
                        "-NoProfile",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-File",
                        &run_script.to_string_lossy(),
                    ])
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .spawn()
            } else if command.contains("powershell.exe") {
                // For PowerShell commands
                Command::new("powershell.exe")
                    .args(&[
                        "-NoProfile",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-Command",
                        &format!("Start-Process -FilePath '{}' -WindowStyle Hidden", command),
                    ])
                    .spawn()
            } else {
                // For direct executable
                Command::new("cmd")
                    .args(&["/C", "start", "/B", &command])
                    .spawn()
            };
        
        match result {
            Ok(_) => {
                info!("Server start command executed successfully");
                HttpResponse::Ok().json(json!({
                    "success": true,
                    "message": "Server start command executed. Please wait a few seconds and check the status."
                }))
            }
            Err(e) => {
                error!("Failed to start server: {}", e);
                HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": format!("Failed to start server: {}", e)
                }))
            }
        }
    }
    
    #[cfg(not(windows))]
    {
        // For non-Windows, use different approach
        HttpResponse::NotImplemented().json(json!({
            "success": false,
            "error": "Server start is only supported on Windows. Please start the server manually."
        }))
    }
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
            .service(shutdown_server)
            .service(start_server)
    })
    .bind(format!("{}:{}", host, port))?
    .run()
    .await
}
