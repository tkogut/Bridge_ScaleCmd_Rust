use actix_cors::Cors;
use actix_files::Files;
use actix_web::{
    delete, get, post,
    web::{self, Data},
    App, HttpResponse, HttpServer, Responder,
};
use env_logger::{Builder, Env};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use scaleit_bridge::device_manager::DeviceManager;
use scaleit_bridge::error::BridgeError;
use scaleit_bridge::models::device::SaveConfigRequest;
use scaleit_bridge::models::host::SaveHostRequest;
use scaleit_bridge::models::miernik::SaveMiernikRequest;
use scaleit_bridge::models::weight::{
    DeviceListResponse, HealthResponse, ScaleCommandRequest, ScaleCommandResponse,
};
use scaleit_bridge::mqtt;

// Constants
const DEFAULT_PORT: u16 = 8080;
const DEFAULT_CONFIG_PATH: &str = "config/devices.json";
const DEFAULT_WEB_PATH: &str = "dist";
const CORS_MAX_AGE: usize = 3600;

#[derive(Clone, Debug, PartialEq)]
enum NetworkMode {
    Local,      // Only localhost
    Lan,        // Local network (private IP ranges)
    Restricted, // Custom allowed origins
}

impl NetworkMode {
    fn from_env() -> Self {
        match std::env::var("NETWORK_MODE") {
            Ok(mode) => match mode.to_lowercase().as_str() {
                "local" => NetworkMode::Local,
                "lan" => NetworkMode::Lan,
                "restricted" => NetworkMode::Restricted,
                _ => {
                    warn!("Invalid NETWORK_MODE '{}', defaulting to 'lan'", mode);
                    NetworkMode::Lan
                }
            },
            Err(_) => NetworkMode::Lan, // Default to LAN mode
        }
    }
}

/// Check if an origin URL contains a private IP address
fn is_private_ip(origin: &str) -> bool {
    // Extract hostname from origin (e.g., "http://192.168.1.100:8080" -> "192.168.1.100")
    let hostname = origin
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .split(':')
        .next()
        .unwrap_or(origin);
    
    // Check for localhost variants
    if hostname == "localhost" || hostname == "127.0.0.1" || hostname == "::1" {
        return true;
    }
    
    // Check for private IP ranges
    // 192.168.0.0/16
    if hostname.starts_with("192.168.") {
        return true;
    }
    
    // 10.0.0.0/8
    if hostname.starts_with("10.") {
        return true;
    }
    
    // 172.16.0.0/12 (172.16.0.0 to 172.31.255.255)
    if hostname.starts_with("172.") {
        if let Some(dot_pos) = hostname.chars().position(|c| c == '.') {
            if dot_pos == 3 {
                let second_octet_str = &hostname[4..];
                if let Some(second_dot_pos) = second_octet_str.chars().position(|c| c == '.') {
                    let second_octet = second_octet_str[..second_dot_pos].parse::<u8>().ok();
                    if let Some(octet) = second_octet {
                        if (16..=31).contains(&octet) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    
    false
}

/// Get local IP addresses of the server
fn get_local_ip_addresses() -> Vec<String> {
    let mut ip_addresses = Vec::new();
    
    // Add localhost variants
    ip_addresses.push("127.0.0.1".to_string());
    ip_addresses.push("localhost".to_string());
    
    // Try to determine local IP by connecting to a public address
    // This works on both Windows and Unix
    use std::net::UdpSocket;
    
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        // Try connecting to a public DNS server (doesn't actually send data)
        if let Ok(_) = socket.connect("8.8.8.8:80") {
            if let Ok(addr) = socket.local_addr() {
                match addr.ip() {
                    std::net::IpAddr::V4(ipv4) => {
                        let ip_str = ipv4.to_string();
                        // Only add if it's a private IP (not a public IP)
                        if is_private_ip(&format!("http://{}", ip_str)) && !ip_addresses.contains(&ip_str) {
                            ip_addresses.push(ip_str);
                        }
                    }
                    std::net::IpAddr::V6(_) => {
                        // IPv6 support can be added later
                    }
                }
            }
        }
    }
    
    // Note: This is a simplified implementation
    // For production, consider using a crate like `local_ipaddress` or `get_if_addrs`
    // which can enumerate all network interfaces
    
    ip_addresses
}

struct AppState {
    device_manager: Arc<DeviceManager>,
}

impl AppState {
    fn new(device_manager: Arc<DeviceManager>) -> Self {
        Self { device_manager }
    }
}

/// Determine configuration file path based on platform and environment
fn determine_config_path() -> String {
    if cfg!(windows) {
        let program_data = std::env::var("ProgramData").unwrap_or_else(|_| String::new());
        if !program_data.is_empty() {
            let program_data_config = format!("{}\\ScaleCmdBridge\\config\\devices.json", program_data);
            if std::path::Path::new(&program_data_config).exists() {
                return program_data_config;
            }
        }
    }
    std::env::var("CONFIG_PATH").unwrap_or_else(|_| DEFAULT_CONFIG_PATH.to_string())
}

/// Determine web frontend files path based on platform and environment
fn determine_web_path() -> String {
    if cfg!(windows) {
        let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| String::new());
        if !program_files.is_empty() {
            let program_files_web = format!("{}\\ScaleCmdBridge\\web", program_files);
            if std::path::Path::new(&program_files_web).exists() {
                return program_files_web;
            }
        }
    }
    std::env::var("WEB_PATH").unwrap_or_else(|_| DEFAULT_WEB_PATH.to_string())
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

/// Health check endpoint
/// 
/// Returns the current status of the bridge service.
/// Used for monitoring and service discovery.
/// 
/// # Example Request
/// ```http
/// GET /health
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "status": "OK",
///   "service": "ScaleIT Bridge",
///   "version": "0.1.1"
/// }
/// ```
#[get("/health")]
async fn health_check() -> impl Responder {
    info!("Received health check request");
    HttpResponse::Ok()
        .json(HealthResponse {
            status: "OK".to_string(),
            service: "ScaleIT Bridge".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
        })
}

/// List all configured scale devices
/// 
/// Returns a list of all enabled scale devices with their IDs, names, and models.
/// 
/// # Example Request
/// ```http
/// GET /devices
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "success": true,
///   "devices": [
///     ["device_id", "Device Name", "Model"],
///     ["scale1", "Main Scale", "Rinstrum C320"]
///   ]
/// }
/// ```
#[get("/devices")]
async fn list_devices(state: Data<AppState>) -> impl Responder {
    info!("Received list devices request");
    HttpResponse::Ok().json(DeviceListResponse {
        success: true,
        devices: state.device_manager.get_devices(),
    })
}

/// Execute a command on a scale device
/// 
/// Sends a command to a specific scale device and returns the result.
/// Supported commands depend on the device type and protocol.
/// 
/// # Example Request
/// ```http
/// POST /scalecmd
/// Content-Type: application/json
/// 
/// {
///   "device_id": "scale1",
///   "command": "read_gross"
/// }
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "success": true,
///   "device_id": "scale1",
///   "command": "read_gross",
///   "result": {
///     "weight": 123.45,
///     "unit": "kg",
///     "is_stable": true
///   },
///   "error": null
/// }
/// ```
/// 
/// # Errors
/// - `400 Bad Request` - Invalid request (missing device_id)
/// - `404 Not Found` - Device not found
/// - `500 Internal Server Error` - Command execution error
#[post("/scalecmd")]
async fn handle_scalecmd(
    req_body: web::Json<ScaleCommandRequest>,
    state: Data<AppState>,
) -> impl Responder {
    let request = match req_body.into_inner() {
        req if req.device_id.is_empty() => {
            error!("Received scalecmd request with empty device_id");
            return HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "device_id is required"
            }));
        }
        req => req
    };
    
    let device_id = request.device_id.clone();
    let command = request.command.clone();
    info!("Received scalecmd request for device: {}, command: {}", device_id, command);

    match state.device_manager.execute_command(request).await {
        Ok(response) => {
            info!("Command executed successfully for device: {}", device_id);
            HttpResponse::Ok().json(response)
        },
        Err(e) => {
            error!("Error executing command for device {}: {:?}", device_id, e);
            bridge_error_response(Some(device_id), Some(command), e)
        }
    }
}

/// Get all device configurations
/// 
/// Returns the complete configuration for all devices (enabled and disabled).
/// 
/// # Example Request
/// ```http
/// GET /api/config
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "device_id": {
///     "name": "Device Name",
///     "manufacturer": "Manufacturer",
///     "model": "Model",
///     "protocol": "RINCMD",
///     "connection": { ... },
///     "enabled": true
///   }
/// }
/// ```
#[get("/api/config")]
async fn get_device_configs(state: Data<AppState>) -> impl Responder {
    HttpResponse::Ok().json(state.device_manager.list_configs())
}

/// Save or update device configuration
/// 
/// Saves a new device configuration or updates an existing one.
/// The configuration is immediately reloaded after saving.
/// 
/// # Example Request
/// ```http
/// POST /api/config/save
/// Content-Type: application/json
/// 
/// {
///   "device_id": "scale1",
///   "config": {
///     "name": "Main Scale",
///     "manufacturer": "Rinstrum",
///     "model": "C320",
///     "protocol": "RINCMD",
///     "connection": { ... },
///     "enabled": true
///   }
/// }
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "success": true,
///   "message": "Configuration for scale1 saved and reloaded."
/// }
/// ```
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

/// Delete a device configuration
/// 
/// Removes a device configuration and reloads the configuration.
/// 
/// # Example Request
/// ```http
/// DELETE /api/config/device_id
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "success": true,
///   "message": "Device device_id deleted and configuration reloaded."
/// }
/// ```
/// 
/// # Errors
/// - `404 Not Found` - Device not found
/// - `500 Internal Server Error` - Failed to reload configuration
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

/// List all configured hosts
/// 
/// Returns all host configurations (TCP/IP connection endpoints).
/// 
/// # Example Request
/// ```http
/// GET /api/hosts
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "host_id": {
///     "name": "Host Name",
///     "connection": {
///       "connection_type": "Tcp",
///       "host": "192.168.1.100",
///       "port": 4001,
///       "timeout_ms": 3000
///     }
///   }
/// }
/// ```
#[get("/api/hosts")]
async fn get_hosts(state: Data<AppState>) -> impl Responder {
    HttpResponse::Ok().json(state.device_manager.list_hosts())
}

/// Get a specific host configuration
/// 
/// Returns the configuration for a specific host by ID.
/// 
/// # Example Request
/// ```http
/// GET /api/hosts/host_id
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "name": "Host Name",
///   "connection": {
///     "connection_type": "Tcp",
///     "host": "192.168.1.100",
///     "port": 4001,
///     "timeout_ms": 3000
///   }
/// }
/// ```
/// 
/// # Errors
/// - `404 Not Found` - Host not found
#[get("/api/hosts/{host_id}")]
async fn get_host(
    host_id: web::Path<String>,
    state: Data<AppState>,
) -> impl Responder {
    let id = host_id.into_inner();
    match state.device_manager.get_host(&id) {
        Ok(config) => HttpResponse::Ok().json(config),
        Err(e) => bridge_error_response(Some(id), None, e),
    }
}

/// Save or update host configuration
/// 
/// Saves a new host configuration or updates an existing one.
/// The configuration is immediately reloaded after saving.
/// 
/// # Example Request
/// ```http
/// POST /api/hosts/save
/// Content-Type: application/json
/// 
/// {
///   "host_id": "host1",
///   "config": {
///     "name": "Main Host",
///     "connection": {
///       "connection_type": "Tcp",
///       "host": "192.168.1.100",
///       "port": 4001,
///       "timeout_ms": 3000
///     }
///   }
/// }
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "success": true,
///   "message": "Host host1 saved and configuration reloaded."
/// }
/// ```
#[post("/api/hosts/save")]
async fn save_host(
    payload: web::Json<SaveHostRequest>,
    state: Data<AppState>,
) -> impl Responder {
    let host_id = payload.host_id.clone();
    if let Err(e) = state
        .device_manager
        .save_host(&host_id, payload.config.clone())
        .await
    {
        error!("Failed to save host: {:?}", e);
        return bridge_error_response(Some(host_id), None, e);
    }

    if let Err(e) = state.device_manager.reload_config().await {
        error!("Failed to reload config: {:?}", e);
        return bridge_error_response(Some(host_id), None, e);
    }

    HttpResponse::Ok().json(json!({
        "success": true,
        "message": format!("Host {} saved and configuration reloaded.", host_id)
    }))
}

/// Test host connection
/// 
/// Attempts to establish a connection to the specified host to verify connectivity.
/// This creates a temporary connection that is immediately closed and does not affect
/// existing device connections.
/// 
/// # Example Request
/// ```http
/// POST /api/hosts/host_id/test
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "success": true,
///   "message": "Connection test successful"
/// }
/// ```
/// 
/// # Errors
/// - `404 Not Found` - Host not found
/// - `500 Internal Server Error` - Connection test failed
#[post("/api/hosts/{host_id}/test")]
async fn test_host_connection(
    host_id: web::Path<String>,
    state: Data<AppState>,
) -> impl Responder {
    let id = host_id.into_inner();
    match state.device_manager.test_host_connection(&id).await {
        Ok(message) => HttpResponse::Ok().json(json!({
            "success": true,
            "message": message
        })),
        Err(e) => bridge_error_response(Some(id), None, e),
    }
}

/// Delete a host configuration
/// 
/// Removes a host configuration and reloads the configuration.
/// 
/// # Example Request
/// ```http
/// DELETE /api/hosts/host_id
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "success": true,
///   "message": "Host host_id deleted and configuration reloaded."
/// }
/// ```
/// 
/// # Errors
/// - `404 Not Found` - Host not found
/// - `500 Internal Server Error` - Failed to reload configuration
#[delete("/api/hosts/{host_id}")]
async fn delete_host(
    host_id: web::Path<String>,
    state: Data<AppState>,
) -> impl Responder {
    let id = host_id.into_inner();
    if let Err(e) = state.device_manager.delete_host(&id).await {
        error!("Failed to delete host: {:?}", e);
        return bridge_error_response(Some(id.clone()), None, e);
    }

    if let Err(e) = state.device_manager.reload_config().await {
        error!("Failed to reload config: {:?}", e);
        return bridge_error_response(Some(id.clone()), None, e);
    }

    HttpResponse::Ok().json(json!({
        "success": true,
        "message": format!("Host {} deleted and configuration reloaded.", id)
    }))
}

/// List all configured mierniki (indicators)
/// 
/// Returns all miernik (indicator) configurations.
/// Mierniki define the protocol and command mappings for specific scale models.
/// 
/// # Example Request
/// ```http
/// GET /api/mierniki
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "miernik_id": {
///     "name": "Miernik Name",
///     "protocol": "RINCMD",
///     "commands": { ... }
///   }
/// }
/// ```
#[get("/api/mierniki")]
async fn get_mierniki(state: Data<AppState>) -> impl Responder {
    HttpResponse::Ok().json(state.device_manager.list_mierniki())
}

/// Get a specific miernik (indicator) configuration
/// 
/// Returns the configuration for a specific miernik by ID.
/// 
/// # Example Request
/// ```http
/// GET /api/mierniki/miernik_id
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "name": "Miernik Name",
///   "protocol": "RINCMD",
///   "commands": {
///     "read_gross": "R",
///     "tare": "T"
///   }
/// }
/// ```
/// 
/// # Errors
/// - `404 Not Found` - Miernik not found
#[get("/api/mierniki/{miernik_id}")]
async fn get_miernik(
    miernik_id: web::Path<String>,
    state: Data<AppState>,
) -> impl Responder {
    let id = miernik_id.into_inner();
    match state.device_manager.get_miernik(&id) {
        Ok(config) => HttpResponse::Ok().json(config),
        Err(e) => bridge_error_response(Some(id), None, e),
    }
}

/// Save or update miernik (indicator) configuration
/// 
/// Saves a new miernik configuration or updates an existing one.
/// The configuration is immediately reloaded after saving.
/// 
/// # Example Request
/// ```http
/// POST /api/mierniki/save
/// Content-Type: application/json
/// 
/// {
///   "miernik_id": "rinstrum_c320",
///   "config": {
///     "name": "Rinstrum C320",
///     "protocol": "RINCMD",
///     "commands": {
///       "read_gross": "R",
///       "tare": "T"
///     }
///   }
/// }
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "success": true,
///   "message": "Miernik rinstrum_c320 saved and configuration reloaded."
/// }
/// ```
#[post("/api/mierniki/save")]
async fn save_miernik(
    payload: web::Json<SaveMiernikRequest>,
    state: Data<AppState>,
) -> impl Responder {
    let miernik_id = payload.miernik_id.clone();
    if let Err(e) = state
        .device_manager
        .save_miernik(&miernik_id, payload.config.clone())
        .await
    {
        error!("Failed to save miernik: {:?}", e);
        return bridge_error_response(Some(miernik_id), None, e);
    }

    if let Err(e) = state.device_manager.reload_config().await {
        error!("Failed to reload config: {:?}", e);
        return bridge_error_response(Some(miernik_id), None, e);
    }

    HttpResponse::Ok().json(json!({
        "success": true,
        "message": format!("Miernik {} saved and configuration reloaded.", miernik_id)
    }))
}

/// Delete a miernik (indicator) configuration
/// 
/// Removes a miernik configuration and reloads the configuration.
/// 
/// # Example Request
/// ```http
/// DELETE /api/mierniki/miernik_id
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "success": true,
///   "message": "Miernik miernik_id deleted and configuration reloaded."
/// }
/// ```
/// 
/// # Errors
/// - `404 Not Found` - Miernik not found
/// - `500 Internal Server Error` - Failed to reload configuration
#[delete("/api/mierniki/{miernik_id}")]
async fn delete_miernik(
    miernik_id: web::Path<String>,
    state: Data<AppState>,
) -> impl Responder {
    let id = miernik_id.into_inner();
    if let Err(e) = state.device_manager.delete_miernik(&id).await {
        error!("Failed to delete miernik: {:?}", e);
        return bridge_error_response(Some(id.clone()), None, e);
    }

    if let Err(e) = state.device_manager.reload_config().await {
        error!("Failed to reload config: {:?}", e);
        return bridge_error_response(Some(id.clone()), None, e);
    }

    HttpResponse::Ok().json(json!({
        "success": true,
        "message": format!("Miernik {} deleted and configuration reloaded.", id)
    }))
}

/// Gracefully shutdown the server
/// 
/// Initiates a graceful shutdown procedure:
/// 1. Disconnects all active device connections
/// 2. Stops the HTTP server
/// 3. Exits the process
/// 
/// **Warning:** This endpoint will stop the server. Use with caution.
/// 
/// # Example Request
/// ```http
/// POST /api/shutdown
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "success": true,
///   "message": "Shutdown initiated. Server will stop after disconnecting all devices."
/// }
/// ```
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

/// Get server information (IP addresses, network mode, version)
/// 
/// Returns information about the server including local IP addresses,
/// network mode, and version.
/// 
/// # Example Request
/// ```http
/// GET /api/server/info
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "hostname": "COMPUTER-NAME",
///   "ip_addresses": ["192.168.1.100", "10.0.0.5", "127.0.0.1"],
///   "port": 8080,
///   "network_mode": "lan",
///   "version": "0.1.5"
/// }
/// ```
#[derive(Serialize, Deserialize)]
struct ServerInfo {
    hostname: String,
    ip_addresses: Vec<String>,
    port: u16,
    network_mode: String,
    version: String,
}

#[get("/api/server/info")]
async fn get_server_info() -> impl Responder {
    let hostname = hostname::get()
        .ok()
        .and_then(|h| h.to_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "unknown".to_string());
    
    let ip_addresses = get_local_ip_addresses();
    
    let port = match std::env::var("PORT") {
        Ok(port_str) => port_str.parse::<u16>().unwrap_or(DEFAULT_PORT),
        Err(_) => DEFAULT_PORT,
    };
    
    let network_mode = NetworkMode::from_env();
    let network_mode_str = match network_mode {
        NetworkMode::Local => "local",
        NetworkMode::Lan => "lan",
        NetworkMode::Restricted => "restricted",
    };
    
    HttpResponse::Ok().json(ServerInfo {
        hostname,
        ip_addresses,
        port,
        network_mode: network_mode_str.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// Start the server process (Windows only)
/// 
/// Attempts to start a new instance of the bridge server in the background.
/// This is a convenience endpoint for remote server management.
/// 
/// **Note:** This endpoint is Windows-only. On other platforms, start the server manually.
/// 
/// # Example Request
/// ```http
/// POST /api/start
/// ```
/// 
/// # Example Response
/// ```json
/// {
///   "success": true,
///   "message": "Server start command executed. Please wait a few seconds and check the status."
/// }
/// ```
/// 
/// # Errors
/// - `400 Bad Request` - Server executable or run script not found
/// - `500 Internal Server Error` - Failed to start server process
/// - `501 Not Implemented` - Not supported on this platform
#[post("/api/start")]
async fn start_server() -> impl Responder {
    info!("Start server request received");
    
    #[cfg(windows)]
    {
        use std::process::Command;
        
        // Get the current executable directory
        let exe_path = match std::env::current_exe() {
            Ok(path) => path.parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| std::path::PathBuf::from(".")),
            Err(e) => {
                error!("Failed to get current executable path: {}", e);
                return HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": format!("Failed to determine executable path: {}", e)
                }));
            }
        };
        
        // Try to find the run script or executable
        let project_root = exe_path
            .parent()
            .and_then(|p| p.parent())
            .unwrap_or_else(|| exe_path.as_path());
        
        let run_script = project_root.join("run-backend.ps1");
        let release_exe = exe_path.join("target").join("release").join("scaleit-bridge.exe");
        let debug_exe = exe_path.join("target").join("debug").join("scaleit-bridge.exe");
        
        // Determine what to run and spawn process
        let result = if run_script.exists() {
            // Use PowerShell script directly
            info!("Starting server using PowerShell script: {}", run_script.display());
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
        } else if release_exe.exists() {
            info!("Starting server using release executable: {}", release_exe.display());
            Command::new(&release_exe)
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn()
        } else if debug_exe.exists() {
            info!("Starting server using debug executable: {}", debug_exe.display());
            Command::new(&debug_exe)
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn()
        } else {
            // Fallback: try cargo run from src-rust
            let src_rust = project_root.join("src-rust");
            if src_rust.exists() {
                warn!("No executable found, attempting to use cargo run from: {}", src_rust.display());
                Command::new("powershell.exe")
                    .args(&[
                        "-NoProfile",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-Command",
                        &format!("cd '{}'; cargo run", src_rust.display()),
                    ])
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .spawn()
            } else {
                error!("Could not find server executable, run script, or src-rust directory");
                return HttpResponse::BadRequest().json(json!({
                    "success": false,
                    "error": "Could not find server executable or run script. Please start the server manually.",
                    "details": {
                        "checked_paths": [
                            run_script.to_string_lossy().to_string(),
                            release_exe.to_string_lossy().to_string(),
                            debug_exe.to_string_lossy().to_string(),
                            src_rust.to_string_lossy().to_string()
                        ]
                    }
                }));
            }
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
                    "error": format!("Failed to start server: {}", e),
                    "error_type": e.kind().to_string()
                }))
            }
        }
    }
    
    #[cfg(not(windows))]
    {
        warn!("Server start endpoint called on non-Windows platform");
        HttpResponse::NotImplemented().json(json!({
            "success": false,
            "error": "Server start is only supported on Windows. Please start the server manually."
        }))
    }
}

// Default handler for SPA routing - serves index.html for non-API routes
async fn default_handler() -> impl Responder {
    // Use the same path resolution logic as main()
    let web_path = determine_web_path();
    let index_path = std::path::Path::new(&web_path).join("index.html");
    
    if index_path.exists() {
        match std::fs::read_to_string(&index_path) {
            Ok(content) => HttpResponse::Ok()
                .content_type("text/html")
                .body(content),
            Err(e) => {
                error!("Failed to read index.html from {}: {}", index_path.display(), e);
                HttpResponse::NotFound().json(json!({
                    "error": format!("index.html not readable: {}", e)
                }))
            },
        }
    } else {
        warn!("Frontend index.html not found at: {}", index_path.display());
        HttpResponse::NotFound().json(json!({
            "error": format!("Frontend not found at {}. Please build the frontend first.", index_path.display())
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
    let config_path = determine_config_path();
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

    // Initialize MQTT if enabled
    let mqtt_config = mqtt::MqttConfig::from_env();
    let mqtt_publisher = if mqtt_config.enabled {
        match mqtt::init_mqtt_publisher(mqtt_config.clone()) {
            Ok(publisher) => {
                info!("MQTT publisher initialized successfully");
                Some(publisher)
            }
            Err(e) => {
                warn!("Failed to initialize MQTT publisher: {}", e);
                None
            }
        }
    } else {
        info!("MQTT is disabled (MQTT_ENABLED not set or false)");
        None
    };

    // Set MQTT publisher in DeviceManager if available
    if let Some(ref mqtt) = mqtt_publisher {
        dm.set_mqtt_publisher(mqtt.clone());
    }

    // Start MQTT subscriber event loop if enabled
    let _mqtt_subscriber_handle = if mqtt_config.enabled {
        let dm_for_mqtt = dm.clone();
        let mqtt_config_clone = mqtt_config.clone();
        let mqtt_pub_clone = mqtt_publisher.clone();
        
        match mqtt::start_mqtt_subscriber_event_loop(mqtt_config_clone, dm_for_mqtt, mqtt_pub_clone).await {
            Ok(handle) => {
                info!("MQTT subscriber event loop started");
                Some(handle)
            }
            Err(e) => {
                warn!("Failed to start MQTT subscriber event loop: {}", e);
                None
            }
        }
    } else {
        None
    };

    dm.connect_all_devices().await;

    let host = "0.0.0.0";
    let port = match std::env::var("PORT") {
        Ok(port_str) => {
            match port_str.parse::<u16>() {
                Ok(p) if p > 0 => p,
                Ok(0) => {
                    warn!("Invalid port number: 0. Using default port {}", DEFAULT_PORT);
                    DEFAULT_PORT
                }
                Ok(_) => {
                    warn!("Port number out of range. Using default port {}", DEFAULT_PORT);
                    DEFAULT_PORT
                }
                Err(e) => {
                    warn!("Invalid PORT environment variable '{}': {}. Using default port {}", port_str, e, DEFAULT_PORT);
                    DEFAULT_PORT
                }
            }
        }
        Err(_) => DEFAULT_PORT,
    };
    
    // Path to static files (frontend dist/)
    // On Windows, try Program Files first (production), then WEB_PATH, then default
    let web_path = determine_web_path();
    
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
        match tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
        {
            Ok(rt) => {
                rt.block_on(async {
                    dm_for_shutdown.disconnect_all_devices().await;
                    info!("All devices disconnected. Exiting.");
                    std::process::exit(0);
                });
            }
            Err(e) => {
                error!("Failed to create Tokio runtime for shutdown handler: {}", e);
                eprintln!("Critical error: Failed to create runtime for graceful shutdown");
                std::process::exit(1);
            }
        }
    })
    .map_err(|e| {
        error!("Failed to set Ctrl-C handler: {}", e);
        std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to set Ctrl-C handler: {}", e),
        )
    })?;

    let web_path_clone = web_path.clone();
    let network_mode = NetworkMode::from_env();
    let local_ips = get_local_ip_addresses();
    
    // Log network configuration
    info!("Network mode: {:?}", network_mode);
    info!("Server accessible at:");
    info!("  - http://localhost:{}", port);
    for ip in &local_ips {
        if ip != "localhost" && ip != "127.0.0.1" {
            info!("  - http://{}:{}", ip, port);
        }
    }
    
    HttpServer::new(move || {
        let state = AppState::new(dm.clone());
        let network_mode_clone = network_mode.clone();
        
        // CORS configuration based on NETWORK_MODE
        let cors = match network_mode_clone {
            NetworkMode::Local => {
                // Only localhost origins
                Cors::default()
                    .allowed_origin("http://localhost:3000")
                    .allowed_origin("http://localhost:5173")
                    .allowed_origin("http://localhost:8080")
                    .allowed_origin("http://127.0.0.1:3000")
                    .allowed_origin("http://127.0.0.1:5173")
                    .allowed_origin("http://127.0.0.1:8080")
                    .allowed_methods(vec!["GET", "POST", "DELETE", "OPTIONS"])
                    .allowed_headers(vec![
                        "Content-Type",
                        "Authorization",
                        "Accept",
                    ])
                    .max_age(Some(CORS_MAX_AGE))
            }
            NetworkMode::Lan => {
                // Allow private IP ranges - use allow_any_origin for LAN mode
                // This allows connections from any private IP in the local network
                // Security: Only accessible from private IP ranges (handled by firewall)
                match std::env::var("ALLOWED_ORIGINS") {
                    Ok(origins) => {
                        let origins_vec: Vec<&str> = origins.split(',').map(|s| s.trim()).collect();
                        if origins_vec.contains(&"*") {
                            Cors::default()
                                .allow_any_origin()
                                .allow_any_method()
                                .allow_any_header()
                                .max_age(Some(CORS_MAX_AGE))
                        } else {
                            // Build CORS with specific origins
                            let mut cors_builder = Cors::default()
                                .allowed_methods(vec!["GET", "POST", "DELETE", "OPTIONS"])
                                .allowed_headers(vec![
                                    "Content-Type",
                                    "Authorization",
                                    "Accept",
                                ])
                                .max_age(Some(CORS_MAX_AGE));
                            
                            for origin in origins_vec {
                                cors_builder = cors_builder.allowed_origin(origin);
                            }
                            cors_builder
                        }
                    }
                    Err(_) => {
                        // LAN mode: Allow any origin from private IP ranges
                        // Note: This allows CORS from any private IP, which is appropriate for local network access
                        // For additional security, use ALLOWED_ORIGINS to specify exact origins
                        Cors::default()
                            .allow_any_origin()
                            .allow_any_method()
                            .allow_any_header()
                            .max_age(Some(CORS_MAX_AGE))
                    }
                }
            }
            NetworkMode::Restricted => {
                // Use ALLOWED_ORIGINS environment variable
                match std::env::var("ALLOWED_ORIGINS") {
                    Ok(origins) => {
                        let origins_vec: Vec<&str> = origins.split(',').map(|s| s.trim()).collect();
                        if origins_vec.contains(&"*") {
                            Cors::default()
                                .allow_any_origin()
                                .allow_any_method()
                                .allow_any_header()
                                .max_age(Some(CORS_MAX_AGE))
                        } else {
                            let mut cors_builder = Cors::default()
                                .allowed_methods(vec!["GET", "POST", "DELETE", "OPTIONS"])
                                .allowed_headers(vec![
                                    "Content-Type",
                                    "Authorization",
                                    "Accept",
                                ])
                                .max_age(Some(CORS_MAX_AGE));
                            
                            for origin in origins_vec {
                                cors_builder = cors_builder.allowed_origin(origin);
                            }
                            cors_builder
                        }
                    }
                    Err(_) => {
                        warn!("NETWORK_MODE=restricted but ALLOWED_ORIGINS not set. Defaulting to localhost only.");
                        Cors::default()
                            .allowed_origin("http://localhost:8080")
                            .allowed_origin("http://127.0.0.1:8080")
                            .allowed_methods(vec!["GET", "POST", "DELETE", "OPTIONS"])
                            .allowed_headers(vec![
                                "Content-Type",
                                "Authorization",
                                "Accept",
                            ])
                            .max_age(Some(CORS_MAX_AGE))
                    }
                }
            }
        };
        
        let mut app = App::new()
            .wrap(cors)
            .app_data(Data::new(state))
            // API endpoints - must be registered before static files
            .service(health_check)
            .service(get_server_info)
            .service(list_devices)
            .service(handle_scalecmd)
            .service(get_device_configs)
            .service(save_device_config)
            .service(delete_device_config)
            .service(get_hosts)
            .service(get_host)
            .service(save_host)
            .service(test_host_connection)
            .service(delete_host)
            .service(get_mierniki)
            .service(get_miernik)
            .service(save_miernik)
            .service(delete_miernik)
            .service(shutdown_server)
            .service(start_server);
        
        // Serve static files if directory exists
        // Check if web directory exists
        if std::path::Path::new(&web_path_clone).exists() {
            info!("Serving static files from: {}", web_path_clone);
            app = app.service(
                Files::new("/", &web_path_clone)
                    .index_file("index.html")
                    .default_handler(web::route().to(default_handler))
            );
        } else {
            warn!("Static files directory not found at: {}. Frontend will not be available.", web_path_clone);
        }
        
        app
    })
    .bind(format!("{}:{}", host, port))?
    .run()
    .await
}
