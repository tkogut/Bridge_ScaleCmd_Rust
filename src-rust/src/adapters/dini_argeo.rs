use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use chrono::Utc;
use lazy_static::lazy_static;
use log::{debug, error, info, warn};
use parking_lot::{Mutex, RwLock};
use regex::Regex;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::task;
use tokio::time::{timeout, Duration as TokioDuration};

lazy_static! {
    static ref DINI_VALUE_RE: Regex = Regex::new(r"(?P<num>[+-]?\d+(?:\.\d+)?)").unwrap();
    static ref DINI_UNIT_RE: Regex = Regex::new(r"[A-Za-z%]+").unwrap();
}

use crate::adapters::adapter::DeviceAdapter;
use crate::error::BridgeError;
use crate::models::device::{Connection, FlowControl, Parity, StopBits};
use crate::models::weight::WeightReading;

enum ConnectionType {
    Tcp {
        host: String,
        port: u16,
        stream: Arc<RwLock<Option<TcpStream>>>,
    },
    Serial {
        port_path: String,
        baud_rate: u32,
        data_bits: u8,
        stop_bits: StopBits,
        parity: Parity,
        flow_control: FlowControl,
        connection: Arc<Mutex<Option<Box<dyn serialport::SerialPort + Send>>>>,
    },
}

/// Adapter that speaks the ASCII/DFW protocol used by Dini Argeo controllers.
/// Supports both Serial and TCP connections.
pub struct DiniArgeoAsciiAdapter {
    device_id: String,
    connection_type: ConnectionType,
    timeout_ms: u32,
    commands: HashMap<String, String>,
}

impl DiniArgeoAsciiAdapter {
    pub fn new(
        device_id: String,
        connection: Connection,
        commands: HashMap<String, String>,
    ) -> Result<Self, BridgeError> {
        let (connection_type, timeout_ms) = match connection {
            Connection::Serial {
                port,
                baud_rate,
                data_bits,
                stop_bits,
                parity,
                flow_control,
                timeout_ms,
            } => (
                ConnectionType::Serial {
                    port_path: port,
                    baud_rate,
                    data_bits,
                    stop_bits,
                    parity,
                    flow_control,
                    connection: Arc::new(Mutex::new(None)),
                },
                timeout_ms,
            ),
            Connection::Tcp {
                host,
                port,
                timeout_ms,
            } => (
                ConnectionType::Tcp {
                    host,
                    port,
                    stream: Arc::new(RwLock::new(None)),
                },
                timeout_ms,
            ),
        };

        Ok(Self {
            device_id,
            connection_type,
            timeout_ms,
            commands,
        })
    }

    fn get_command_terminator(&self) -> &'static str {
        "\r\n" // Dini Argeo uses CR+LF
    }

    fn format_command(&self, raw: &str) -> Vec<u8> {
        let mut bytes = raw.trim().as_bytes().to_vec();
        if bytes.is_empty() {
            return bytes;
        }

        if bytes.ends_with(&[b'\n']) {
            return bytes;
        }

        if bytes.ends_with(&[b'\r']) {
            bytes.push(b'\n');
        } else {
            bytes.extend_from_slice(b"\r\n");
        }

        bytes
    }

    fn parse_weight_from_response(
        &self,
        response: &str,
    ) -> Result<(f64, String, bool), BridgeError> {
        // Implementacja zgodna z scale-parser.md - parseGenericResponse
        if response.trim().is_empty() {
            return Err(BridgeError::ProtocolError(
                "Empty response from Dini Argeo device".to_string(),
            ));
        }

        // Pattern: ([+-]?\s*\d+\.\d+)\s*(kg|lb|g)
        let pattern = Regex::new(r"([+-]?\s*\d+\.\d+)\s*(kg|lb|g)").unwrap();
        if let Some(caps) = pattern.captures(response) {
            let mut num_str = caps.get(1).unwrap().as_str().to_string();
            num_str.retain(|c| c != ' '); // remove spaces between sign and digits
            let value = num_str.parse::<f64>().map_err(|e| {
                BridgeError::ProtocolError(format!("Failed to parse value: {}", e))
            })?;
            let unit = caps.get(2).unwrap().as_str().to_lowercase();
            // Assume Gross for generic parser
            return Ok((value, unit, true));
        }

        // Fallback: Dini controllers usually respond with comma separated flags
        // Example: ST,GS,+00023.450kg
        let first_token = response
            .split(',')
            .next()
            .map(str::trim)
            .unwrap_or("")
            .to_uppercase();
        let is_stable = first_token.starts_with('S') && !first_token.starts_with('U');

        let search_space = response
            .split(',')
            .last()
            .unwrap_or(response)
            .trim()
            .replace(',', ".");

        let num_match = DINI_VALUE_RE.find(&search_space).ok_or_else(|| {
            BridgeError::ProtocolError(format!(
                "Could not find numeric value in Dini Argeo response: '{}'",
                response
            ))
        })?;

        let value: f64 = search_space[num_match.start()..num_match.end()]
            .parse()
            .map_err(|e| {
                BridgeError::ProtocolError(format!(
                    "Failed to parse value '{}' ({})",
                    &search_space[num_match.start()..num_match.end()],
                    e
                ))
            })?;

        let unit = DINI_UNIT_RE
            .find(&search_space[num_match.end()..])
            .map(|m| m.as_str().to_string())
            .unwrap_or_default();

        Ok((value, unit, is_stable))
    }

    fn to_weight_reading(&self, value: f64, unit: String, is_stable: bool) -> WeightReading {
        WeightReading {
            gross_weight: value,
            net_weight: value,
            unit,
            is_stable,
            timestamp: Utc::now(),
        }
    }

    async fn send_command_and_read_response(&self, command: &str) -> Result<String, BridgeError> {
        let formatted_command = self.format_command(command);
        if formatted_command.is_empty() {
            return Err(BridgeError::InvalidCommand(
                "ASCII command cannot be empty".to_string(),
            ));
        }

        match &self.connection_type {
            ConnectionType::Tcp { stream, .. } => {
                self.send_command_tcp(stream, &formatted_command).await
            }
            ConnectionType::Serial { connection, .. } => {
                self.send_command_serial(connection, &formatted_command).await
            }
        }
    }

    async fn send_command_tcp(
        &self,
        stream: &Arc<RwLock<Option<TcpStream>>>,
        formatted_command: &[u8],
    ) -> Result<String, BridgeError> {
        let conn_opt = {
            let mut conn_guard = stream.write();
            conn_guard.take()
        };

        let mut conn = conn_opt.ok_or_else(|| {
            error!(
                "Attempted to send command without an active TCP connection for device {}",
                self.device_id
            );
            BridgeError::ConnectionError("No active TCP connection".to_string())
        })?;

        let timeout_duration = TokioDuration::from_millis(self.timeout_ms as u64);

        debug!(
            "Sending TCP command to {}: {}",
            self.device_id,
            String::from_utf8_lossy(formatted_command).trim()
        );

        timeout(timeout_duration, conn.write_all(formatted_command))
            .await
            .map_err(|_| {
                warn!("Write timeout for device {}", self.device_id);
                BridgeError::Timeout(format!("Write timeout after {}ms", self.timeout_ms))
            })?
            .map_err(|e| {
                error!("Failed to write to device {}: {}", self.device_id, e);
                BridgeError::IoError(e)
            })?;

        let mut buffer = vec![0; 256];
        let mut response = Vec::new();
        let timeout = TokioDuration::from_millis(self.timeout_ms as u64);
        let start = std::time::Instant::now();

        loop {
            if start.elapsed() >= Duration::from_millis(self.timeout_ms as u64) {
                return Err(BridgeError::Timeout(format!(
                    "Timed out waiting {} ms for response",
                    self.timeout_ms
                )));
            }

            let bytes_read = match timeout(timeout, conn.read(&mut buffer)).await {
                Ok(Ok(0)) => continue,
                Ok(Ok(n)) => n,
                Ok(Err(e)) => return Err(BridgeError::IoError(e)),
                Err(_) => {
                    if response.is_empty() {
                        return Err(BridgeError::Timeout(format!(
                            "No response from device in {} ms",
                            self.timeout_ms
                        )));
                    }
                    break;
                }
            };

            response.extend_from_slice(&buffer[..bytes_read]);
            if response.contains(&b'\n') {
                break;
            }
        }

        {
            let mut conn_guard = stream.write();
            *conn_guard = Some(conn);
        }

        let resp = String::from_utf8_lossy(&response).trim().to_string();
        debug!("TCP response from {}: {}", self.device_id, resp);
        Ok(resp)
    }

    async fn send_command_serial(
        &self,
        connection: &Arc<Mutex<Option<Box<dyn serialport::SerialPort + Send>>>>,
        formatted_command: &[u8],
    ) -> Result<String, BridgeError> {
        let connection_clone = connection.clone();
        let timeout_ms = self.timeout_ms;
        let device_id = self.device_id.clone();

        task::spawn_blocking(move || {
            let mut guard = connection_clone.lock();
            let port = guard.as_mut().ok_or_else(|| {
                BridgeError::ConnectionError("Serial port not opened".to_string())
            })?;

            debug!(
                "Sending Serial command to {}: {}",
                device_id,
                String::from_utf8_lossy(formatted_command).trim()
            );

            port.write_all(formatted_command)
                .map_err(|e| BridgeError::IoError(e))?;
            port.flush().map_err(|e| BridgeError::IoError(e))?;

            let mut buffer = [0u8; 256];
            let mut response = Vec::new();
            let timeout = Duration::from_millis(timeout_ms as u64);
            let start = Instant::now();

            loop {
                if start.elapsed() >= timeout {
                    return Err(BridgeError::Timeout(format!(
                        "Timed out waiting {} ms for response",
                        timeout_ms
                    )));
                }

                match port.read(&mut buffer) {
                    Ok(0) => continue,
                    Ok(n) => {
                        response.extend_from_slice(&buffer[..n]);
                        if response.contains(&b'\n') {
                            break;
                        }
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                        if response.is_empty() {
                            return Err(BridgeError::Timeout(format!(
                                "No response from device in {} ms",
                                timeout_ms
                            )));
                        }
                        break;
                    }
                    Err(e) => return Err(BridgeError::IoError(e)),
                }
            }

            let resp = String::from_utf8_lossy(&response).trim().to_string();
            debug!("Serial response from {}: {}", device_id, resp);
            Ok(resp)
        })
        .await
        .map_err(|e| {
            BridgeError::InternalServerError(format!(
                "Blocking task failed for Serial command: {}",
                e
            ))
        })?
    }
}

#[async_trait]
impl DeviceAdapter for DiniArgeoAsciiAdapter {
    async fn connect(&self) -> Result<(), BridgeError> {
        match &self.connection_type {
            ConnectionType::Tcp { stream, host, port } => {
                {
                    let conn_guard = stream.read();
                    if conn_guard.is_some() {
                        info!("Device {} already connected (TCP).", self.device_id);
                        return Ok(());
                    }
                }

                let addr = format!("{}:{}", host, port);
                info!("Attempting to connect to Dini Argeo at {} (TCP)", addr);

                let connect_future = TcpStream::connect(&addr);
                let timeout_duration = TokioDuration::from_millis(self.timeout_ms as u64);

                let stream_result = timeout(timeout_duration, connect_future)
                    .await
                    .map_err(|_| {
                        error!(
                            "Connection timeout to {} for device {}",
                            addr, self.device_id
                        );
                        BridgeError::Timeout(format!(
                            "Connection timeout after {}ms",
                            self.timeout_ms
                        ))
                    })?
                    .map_err(|e| {
                        error!("Failed to connect to Dini Argeo at {}: {}", addr, e);
                        BridgeError::ConnectionError(format!("Failed to connect: {}", e))
                    })?;

                info!(
                    "Successfully connected to Dini Argeo at {} for device {} (TCP)",
                    addr, self.device_id
                );
                {
                    let mut conn_guard = stream.write();
                    *conn_guard = Some(stream_result);
                }
                Ok(())
            }
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
                    info!("Device {} already connected (Serial).", self.device_id);
                    return Ok(());
                }

                let port_path_clone = port_path.clone();
                let baud_rate_clone = *baud_rate;
                let data_bits_clone = *data_bits;
                let stop_bits_clone = stop_bits.clone();
                let parity_clone = parity.clone();
                let flow_control_clone = flow_control.clone();
                let timeout_ms = self.timeout_ms;
                let connection_clone = connection.clone();
                let device_id = self.device_id.clone();

                task::spawn_blocking(move || {
                    let data_bits_serial = match data_bits_clone {
                        5 => serialport::DataBits::Five,
                        6 => serialport::DataBits::Six,
                        7 => serialport::DataBits::Seven,
                        8 => serialport::DataBits::Eight,
                        _ => {
                            return Err(BridgeError::ConfigurationError(format!(
                                "Invalid data bits: {}. Must be 5, 6, 7, or 8",
                                data_bits_clone
                            )));
                        }
                    };

                    let stop_bits_serial = match stop_bits_clone {
                        StopBits::One => serialport::StopBits::One,
                        StopBits::Two => serialport::StopBits::Two,
                    };

                    let parity_serial = match parity_clone {
                        Parity::None => serialport::Parity::None,
                        Parity::Even => serialport::Parity::Even,
                        Parity::Odd => serialport::Parity::Odd,
                    };

                    let flow_control_serial = match flow_control_clone {
                        FlowControl::None => serialport::FlowControl::None,
                        FlowControl::Software => serialport::FlowControl::Software,
                        FlowControl::Hardware => serialport::FlowControl::Hardware,
                    };

                    let mut port = serialport::new(port_path_clone.clone(), baud_rate_clone)
                        .data_bits(data_bits_serial)
                        .stop_bits(stop_bits_serial)
                        .parity(parity_serial)
                        .flow_control(flow_control_serial)
                        .timeout(Duration::from_millis(timeout_ms as u64))
                        .open()
                        .map_err(|e| {
                            error!(
                                "Failed to open serial port {} for device {}: {}",
                                port_path_clone, device_id, e
                            );
                            BridgeError::ConnectionError(format!(
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
                        "Serial port {} opened for Dini Argeo device {} ({} baud, {}-{}-{})",
                        port_path_clone,
                        device_id,
                        baud_rate_clone,
                        data_bits_clone,
                        match parity_clone {
                            Parity::None => "N",
                            Parity::Even => "E",
                            Parity::Odd => "O",
                        },
                        match stop_bits_clone {
                            StopBits::One => "1",
                            StopBits::Two => "2",
                        }
                    );
                    Ok(())
                })
                .await
                .map_err(|e| {
                    BridgeError::InternalServerError(format!(
                        "Blocking task failed while opening serial port: {}",
                        e
                    ))
                })?
            }
        }
    }

    async fn disconnect(&self) -> Result<(), BridgeError> {
        match &self.connection_type {
            ConnectionType::Tcp { stream, .. } => {
                let mut conn_guard = stream.write();
                if let Some(_stream) = conn_guard.take() {
                    info!("Disconnected from device {} (TCP)", self.device_id);
                } else {
                    warn!(
                        "Attempted to disconnect device {} which was not connected (TCP).",
                        self.device_id
                    );
                }
                Ok(())
            }
            ConnectionType::Serial { connection, .. } => {
                let mut guard = connection.lock();
                if guard.take().is_some() {
                    info!("Disconnected from device {} (Serial)", self.device_id);
                } else {
                    warn!(
                        "Attempted to disconnect device {} which was not connected (Serial).",
                        self.device_id
                    );
                }
                Ok(())
            }
        }
    }

    fn is_connected(&self) -> bool {
        match &self.connection_type {
            ConnectionType::Tcp { stream, .. } => stream.read().is_some(),
            ConnectionType::Serial { connection, .. } => connection.lock().is_some(),
        }
    }

    async fn execute_command(&self, command: &str) -> Result<WeightReading, BridgeError> {
        if !self.is_connected() {
            self.connect().await?;
        }

        let command_str = self.commands.get(command).ok_or_else(|| {
            BridgeError::InvalidCommand(format!("Unknown ASCII command: {}", command))
        })?;

        let response = self.send_command_and_read_response(command_str).await?;
        let (value, unit, is_stable) = self.parse_weight_from_response(&response)?;
        Ok(self.to_weight_reading(value, unit, is_stable))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn adapter_for_tests_serial() -> DiniArgeoAsciiAdapter {
        use crate::models::device::{FlowControl, Parity, StopBits};
        let connection = Connection::Serial {
            port: "COM1".to_string(),
            baud_rate: 9600,
            data_bits: 8,
            stop_bits: StopBits::One,
            parity: Parity::None,
            flow_control: FlowControl::None,
            timeout_ms: 1000,
        };
        let mut commands = HashMap::new();
        commands.insert("readGross".to_string(), "READ".to_string());
        commands.insert("readNet".to_string(), "REXT".to_string());
        commands.insert("tare".to_string(), "TARE".to_string());
        commands.insert("zero".to_string(), "ZERO".to_string());

        DiniArgeoAsciiAdapter::new("test".to_string(), connection, commands).unwrap()
    }

    fn adapter_for_tests_tcp() -> DiniArgeoAsciiAdapter {
        let connection = Connection::Tcp {
            host: "127.0.0.1".to_string(),
            port: 4001,
            timeout_ms: 1000,
        };
        let mut commands = HashMap::new();
        commands.insert("readGross".to_string(), "READ".to_string());
        commands.insert("readNet".to_string(), "REXT".to_string());
        commands.insert("tare".to_string(), "TARE".to_string());
        commands.insert("zero".to_string(), "ZERO".to_string());

        DiniArgeoAsciiAdapter::new("test".to_string(), connection, commands).unwrap()
    }

    #[test]
    fn parses_generic_pattern() {
        let adapter = adapter_for_tests_serial();
        let (value, unit, is_stable) = adapter
            .parse_weight_from_response("+123.45 kg")
            .unwrap();
        assert_eq!(value, 123.45);
        assert_eq!(unit, "kg");
        assert!(is_stable);
    }

    #[test]
    fn parses_standard_response() {
        let adapter = adapter_for_tests_serial();
        let (value, unit, is_stable) = adapter
            .parse_weight_from_response("ST,GS,+00023.450kg")
            .unwrap();
        assert_eq!(value, 23.45);
        assert_eq!(unit, "kg");
        assert!(is_stable);
    }

    #[test]
    fn parses_unstable_negative_response() {
        let adapter = adapter_for_tests_serial();
        let (value, unit, is_stable) = adapter.parse_weight_from_response("US,NT,-12.5kg").unwrap();
        assert_eq!(value, -12.5);
        assert_eq!(unit, "kg");
        assert!(!is_stable);
    }

    #[test]
    fn fails_on_empty_response() {
        let adapter = adapter_for_tests_serial();
        assert!(adapter.parse_weight_from_response("   ").is_err());
    }
}
