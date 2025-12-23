//! Connection management for TCP and Serial connections

use crate::error::HostError;
use log::{error, info, warn};
use parking_lot::Mutex;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::sync::RwLock;
use tokio::task;
use tokio::time::{timeout, Duration as TokioDuration};

/// Connection type (TCP or Serial)
#[derive(Clone)]
pub enum ConnectionType {
    Tcp {
        host: String,
        port: u16,
        stream: Arc<RwLock<Option<TcpStream>>>,
    },
    Serial {
        port_path: String,
        baud_rate: u32,
        data_bits: u8,
        stop_bits: serialport::StopBits,
        parity: serialport::Parity,
        flow_control: serialport::FlowControl,
        connection: Arc<Mutex<Option<Box<dyn serialport::SerialPort + Send>>>>,
    },
}

impl std::fmt::Debug for ConnectionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConnectionType::Tcp { host, port, .. } => {
                f.debug_struct("Tcp")
                    .field("host", host)
                    .field("port", port)
                    .finish()
            }
            ConnectionType::Serial {
                port_path,
                baud_rate,
                data_bits,
                stop_bits,
                parity,
                flow_control,
                ..
            } => {
                f.debug_struct("Serial")
                    .field("port_path", port_path)
                    .field("baud_rate", baud_rate)
                    .field("data_bits", data_bits)
                    .field("stop_bits", stop_bits)
                    .field("parity", parity)
                    .field("flow_control", flow_control)
                    .finish()
            }
        }
    }
}

/// Connection configuration
#[derive(Debug, Clone)]
pub struct Connection {
    pub connection_type: ConnectionType,
    pub timeout_ms: u32,
}

/// TCP connection configuration
#[derive(Debug, Clone)]
pub struct TcpConnection {
    pub host: String,
    pub port: u16,
    pub timeout_ms: u32,
}

/// Serial connection configuration
#[derive(Debug, Clone)]
pub struct SerialConnection {
    pub port: String,
    pub baud_rate: u32,
    pub data_bits: u8,
    pub stop_bits: serialport::StopBits,
    pub parity: serialport::Parity,
    pub flow_control: serialport::FlowControl,
    pub timeout_ms: u32,
}

impl Connection {
    /// Create TCP connection
    pub fn tcp(host: String, port: u16, timeout_ms: u32) -> Self {
        Self {
            connection_type: ConnectionType::Tcp {
                host: host.clone(),
                port,
                stream: Arc::new(RwLock::new(None)),
            },
            timeout_ms,
        }
    }

    /// Create Serial connection
    pub fn serial(
        port: String,
        baud_rate: u32,
        data_bits: u8,
        stop_bits: serialport::StopBits,
        parity: serialport::Parity,
        flow_control: serialport::FlowControl,
        timeout_ms: u32,
    ) -> Self {
        Self {
            connection_type: ConnectionType::Serial {
                port_path: port.clone(),
                baud_rate,
                data_bits,
                stop_bits,
                parity,
                flow_control,
                connection: Arc::new(Mutex::new(None)),
            },
            timeout_ms,
        }
    }

    /// Check if connection is active
    pub fn is_connected(&self) -> bool {
        match &self.connection_type {
            ConnectionType::Tcp { stream, .. } => {
                stream.try_read().map(|guard| guard.is_some()).unwrap_or(false)
            }
            ConnectionType::Serial { connection, .. } => {
                let guard = connection.lock();
                guard.is_some()
            }
        }
    }

    /// Connect TCP
    pub async fn connect_tcp(&self) -> Result<(), HostError> {
        match &self.connection_type {
            ConnectionType::Tcp { stream, host, port } => {
                {
                    let conn_guard = stream.read().await;
                    if conn_guard.is_some() {
                        info!("TCP connection already established to {}:{}", host, port);
                        return Ok(());
                    }
                }

                let addr = format!("{}:{}", host, port);
                info!("Connecting to TCP address: {}", addr);

                let connect_future = TcpStream::connect(&addr);
                let timeout_duration = TokioDuration::from_millis(self.timeout_ms as u64);

                let stream_result = timeout(timeout_duration, connect_future)
                    .await
                    .map_err(|_| {
                        error!("Connection timeout to {} for {}ms", addr, self.timeout_ms);
                        HostError::Timeout(format!(
                            "Connection timeout after {}ms",
                            self.timeout_ms
                        ))
                    })?
                    .map_err(|e| {
                        error!("Failed to connect to {}: {}", addr, e);
                        HostError::ConnectionError(format!("Failed to connect: {}", e))
                    })?;

                // Configure socket options for better reliability
                // Set TCP_NODELAY to disable Nagle's algorithm (send data immediately)
                let mut configured_stream = stream_result;
                if let Err(e) = configured_stream.set_nodelay(true) {
                    warn!("Failed to set TCP_NODELAY on connection to {}: {}", addr, e);
                }

                {
                    let mut conn_guard = stream.write().await;
                    *conn_guard = Some(configured_stream);
                }

                info!("Successfully connected to TCP address: {}", addr);
                Ok(())
            }
            ConnectionType::Serial { .. } => {
                Err(HostError::ConnectionError(
                    "Cannot use connect_tcp on Serial connection".to_string(),
                ))
            }
        }
    }

    /// Connect Serial
    pub async fn connect_serial(&self) -> Result<(), HostError> {
        match &self.connection_type {
            ConnectionType::Serial {
                port_path,
                baud_rate,
                data_bits,
                stop_bits,
                parity,
                flow_control,
                connection,
            } => {
                if self.is_connected() {
                    info!("Serial connection already established on {}", port_path);
                    return Ok(());
                }

                let port_path_clone = port_path.clone();
                let baud_rate_clone = *baud_rate;
                let data_bits_clone = *data_bits;
                let stop_bits_clone = *stop_bits;
                let parity_clone = *parity;
                let flow_control_clone = *flow_control;
                let timeout_ms = self.timeout_ms;
                let connection_clone = connection.clone();

                task::spawn_blocking(move || {
                    let data_bits_serial = match data_bits_clone {
                        5 => serialport::DataBits::Five,
                        6 => serialport::DataBits::Six,
                        7 => serialport::DataBits::Seven,
                        8 => serialport::DataBits::Eight,
                        _ => serialport::DataBits::Eight,
                    };

                    let stop_bits_serial = match stop_bits_clone {
                        serialport::StopBits::One => serialport::StopBits::One,
                        serialport::StopBits::Two => serialport::StopBits::Two,
                    };

                    let parity_serial = match parity_clone {
                        serialport::Parity::None => serialport::Parity::None,
                        serialport::Parity::Even => serialport::Parity::Even,
                        serialport::Parity::Odd => serialport::Parity::Odd,
                    };

                    let flow_control_serial = match flow_control_clone {
                        serialport::FlowControl::None => serialport::FlowControl::None,
                        serialport::FlowControl::Software => serialport::FlowControl::Software,
                        serialport::FlowControl::Hardware => serialport::FlowControl::Hardware,
                    };

                    let mut port = serialport::new(port_path_clone.clone(), baud_rate_clone)
                        .data_bits(data_bits_serial)
                        .stop_bits(stop_bits_serial)
                        .parity(parity_serial)
                        .flow_control(flow_control_serial)
                        .timeout(Duration::from_millis(timeout_ms as u64))
                        .open()
                        .map_err(|e| {
                            error!("Failed to open serial port {}: {}", port_path_clone, e);
                            HostError::ConnectionError(format!(
                                "Unable to open serial port {}: {}",
                                port_path_clone, e
                            ))
                        })?;

                    if let Err(e) = port.set_timeout(Duration::from_millis(timeout_ms as u64)) {
                        warn!("Unable to set timeout on serial port: {}", e);
                    }

                    let mut guard = connection_clone.lock();
                    *guard = Some(port);
                    info!(
                        "Serial port {} opened ({} baud, {}-{}-{})",
                        port_path_clone,
                        baud_rate_clone,
                        data_bits_clone,
                        match parity_serial {
                            serialport::Parity::None => "N",
                            serialport::Parity::Even => "E",
                            serialport::Parity::Odd => "O",
                        },
                        match stop_bits_serial {
                            serialport::StopBits::One => "1",
                            serialport::StopBits::Two => "2",
                        }
                    );
                    Ok::<(), HostError>(())
                })
                .await
                .map_err(|e| {
                    HostError::ConnectionError(format!("Blocking task failed: {}", e))
                })?
            }
            ConnectionType::Tcp { .. } => {
                Err(HostError::ConnectionError(
                    "Cannot use connect_serial on TCP connection".to_string(),
                ))
            }
        }
    }

    /// Disconnect
    pub async fn disconnect(&self) -> Result<(), HostError> {
        match &self.connection_type {
            ConnectionType::Tcp { stream, .. } => {
                let mut conn_guard = stream.write().await;
                *conn_guard = None;
                Ok(())
            }
            ConnectionType::Serial { connection, .. } => {
                let mut guard = connection.lock();
                *guard = None;
                Ok(())
            }
        }
    }
}

