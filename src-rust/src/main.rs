use actix_cors::Cors;
use actix_files::Files;
use actix_web::{
    delete, get, post,
    web::{self, Data},
    App, HttpResponse, HttpServer, Responder,
};
use env_logger::{Builder, Env};
use log::{error, info, warn};
use serde_json::json;
use std::sync::Arc;

use scaleit_bridge::device_manager::DeviceManager;
use scaleit_bridge::error::BridgeError;
use scaleit_bridge::models::device::SaveConfigRequest;
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

// Default handler for SPA routing - serves index.html for non-API routes
async fn default_handler() -> impl Responder {
    let web_path = std::env::var("WEB_PATH")
        .unwrap_or_else(|_| "dist".to_string());
    let index_path = std::path::Path::new(&web_path).join("index.html");
    
    if index_path.exists() {
        match std::fs::read_to_string(&index_path) {
            Ok(content) => HttpResponse::Ok()
                .content_type("text/html")
                .body(content),
            Err(_) => HttpResponse::NotFound().json(json!({
                "error": "index.html not found"
            })),
        }
    } else {
        HttpResponse::NotFound().json(json!({
            "error": "Frontend not found. Please build the frontend first."
        }))
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    
    // Setup logging - to both console and file (if log_file_path is set)
    let mut builder = Builder::from_env(Env::default().default_filter_or("info"));
    
    // Add file logging if log file path is available (will be set after determining paths)
    // For now, just console logging - file logging will be added after path determination
    
    builder.init();

    info!("Starting ScaleIT Bridge v{}", env!("CARGO_PKG_VERSION"));

    // Determine config path - use ProgramData on Windows if available, otherwise use CONFIG_PATH or default
    let config_path = if cfg!(windows) {
        // Try ProgramData first (production installation)
        let program_data = std::env::var("ProgramData").unwrap_or_else(|_| String::new());
        if !program_data.is_empty() {
            let program_data_config = format!("{}\\ScaleCmdBridge\\config\\devices.json", program_data);
            if std::path::Path::new(&program_data_config).exists() {
                program_data_config
            } else {
                // Fallback to CONFIG_PATH or default
                std::env::var("CONFIG_PATH").unwrap_or_else(|_| "config/devices.json".to_string())
            }
        } else {
            std::env::var("CONFIG_PATH").unwrap_or_else(|_| "config/devices.json".to_string())
        }
    } else {
        std::env::var("CONFIG_PATH").unwrap_or_else(|_| "config/devices.json".to_string())
    };
    
    info!("Using config path: {}", config_path);
    
    // Ensure config file exists (DeviceManager will create it if missing)
    // We need to do this before using the config crate
    let config_path_buf = std::path::PathBuf::from(&config_path);
    if !config_path_buf.exists() {
        info!("Config file does not exist, DeviceManager will create default configuration");
    }
    
    // Use DeviceManager::from_path which handles missing files automatically
    let dm = Arc::new(
        DeviceManager::from_path(&config_path).map_err(|e| {
            error!("Failed to initialize DeviceManager: {}", e);
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("DeviceManager init error: {}", e),
            )
        })?,
    );
    
    info!(
        "Configuration loaded successfully. Devices: {:?}",
        dm.list_configs().keys()
    );

    dm.connect_all_devices().await;

    let host = "0.0.0.0";
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(8080);
    
    // Path to static files (frontend dist/)
    // On Windows, try Program Files first (production), then WEB_PATH, then default
    let web_path = if cfg!(windows) {
        let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| String::new());
        if !program_files.is_empty() {
            let program_files_web = format!("{}\\ScaleCmdBridge\\web", program_files);
            if std::path::Path::new(&program_files_web).exists() {
                program_files_web
            } else {
                std::env::var("WEB_PATH").unwrap_or_else(|_| "dist".to_string())
            }
        } else {
            std::env::var("WEB_PATH").unwrap_or_else(|_| "dist".to_string())
        }
    } else {
        std::env::var("WEB_PATH").unwrap_or_else(|_| "dist".to_string())
    };
    
    info!("Server running on http://{}:{}", host, port);
    info!("Serving static files from: {}", web_path);
    
    // Setup log file path (ProgramData on Windows)
    let log_file_path = if cfg!(windows) {
        let program_data = std::env::var("ProgramData").unwrap_or_else(|_| String::new());
        if !program_data.is_empty() {
            let logs_dir = format!("{}\\ScaleCmdBridge\\logs", program_data);
            // Create logs directory if it doesn't exist
            if let Err(e) = std::fs::create_dir_all(&logs_dir) {
                warn!("Failed to create logs directory {}: {}", logs_dir, e);
            }
            Some(format!("{}\\scaleit-bridge.log", logs_dir))
        } else {
            None
        }
    } else {
        None
    };
    
    if let Some(ref log_path) = log_file_path {
        info!("Log file: {}", log_path);
        // Note: env_logger doesn't support file output directly
        // We'll use a custom logger or add file appender later if needed
        // For now, logs go to console/EventLog
    }

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

    let web_path_clone = web_path.clone();
    HttpServer::new(move || {
        let state = AppState::new(dm.clone());
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .expose_headers(&["Content-Type", "Content-Length"])
            .max_age(3600);
        
        let mut app = App::new()
            .wrap(cors)
            .app_data(Data::new(state))
            // API endpoints - must be registered before static files
            .service(health_check)
            .service(list_devices)
            .service(handle_scalecmd)
            .service(get_device_configs)
            .service(save_device_config)
            .service(delete_device_config)
            .service(shutdown_server)
            .service(start_server);
        
        // Serve static files if directory exists
        // Check if web directory exists
        if std::path::Path::new(&web_path_clone).exists() {
            app = app.service(
                Files::new("/", &web_path_clone)
                    .index_file("index.html")
                    .default_handler(web::route().to(default_handler))
            );
        }
        
        app
    })
    .bind(format!("{}:{}", host, port))?
    .run()
    .await
}
