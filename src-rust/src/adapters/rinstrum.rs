use async_trait::async_trait;
use chrono::Utc;
use log::{debug, error, info, warn};
use parking_lot::{Mutex, RwLock};
use regex::Regex;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::task;
use tokio::time::{timeout, Duration as TokioDuration};

use super::adapter::DeviceAdapter;
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

pub struct RinstrumC320Adapter {
    device_id: String,
    connection_type: ConnectionType,
    timeout_ms: u32,
    commands: HashMap<String, String>,
}

impl RinstrumC320Adapter {
    pub fn new(
        device_id: String,
        connection: Connection,
        commands: HashMap<String, String>,
    ) -> Result<Self, BridgeError> {
        let (connection_type, timeout_ms) = match connection {
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
        };

        Ok(Self {
            device_id,
            connection_type,
            timeout_ms,
            commands,
        })
    }

    fn get_command_terminator(&self) -> &'static str {
        "\r\n" // RINCMD uses CR+LF
    }

    async fn send_command_and_read_response(
        &self,
        command_str: &str,
    ) -> Result<String, BridgeError> {
        let full_command = format!("{}{}", command_str, self.get_command_terminator());
        debug!(
            "Sending command to {}: {}",
            self.device_id,
            full_command.trim()
        );

        match &self.connection_type {
            ConnectionType::Tcp { stream, .. } => {
                self.send_command_tcp(stream, &full_command).await
            }
            ConnectionType::Serial { connection, .. } => {
                self.send_command_serial(connection, &full_command).await
            }
        }
    }

    async fn send_command_tcp(
        &self,
        stream: &Arc<RwLock<Option<TcpStream>>>,
        full_command: &str,
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

        timeout(timeout_duration, conn.write_all(full_command.as_bytes()))
            .await
            .map_err(|_| {
                warn!("Write timeout for device {}", self.device_id);
                BridgeError::Timeout(format!("Write timeout after {}ms", self.timeout_ms))
            })?
            .map_err(|e| {
                error!("Failed to write to device {}: {}", self.device_id, e);
                BridgeError::IoError(e)
            })?;

        let mut buffer = vec![0; 1024];

        let bytes_read = timeout(timeout_duration, conn.read(&mut buffer))
            .await
            .map_err(|_| {
                warn!("Read timeout for device {}", self.device_id);
                BridgeError::Timeout(format!("Read timeout after {}ms", self.timeout_ms))
            })?
            .map_err(|e| {
                error!("Failed to read from device {}: {}", self.device_id, e);
                BridgeError::IoError(e)
            })?;

        let response = String::from_utf8_lossy(&buffer[..bytes_read])
            .trim()
            .to_string();
        debug!("Received TCP response from {}: {}", self.device_id, response);

        {
            let mut conn_guard = stream.write();
            *conn_guard = Some(conn);
        }

        Ok(response)
    }

    async fn send_command_serial(
        &self,
        connection: &Arc<Mutex<Option<Box<dyn serialport::SerialPort + Send>>>>,
        full_command: &str,
    ) -> Result<String, BridgeError> {
        let connection_clone = connection.clone();
        let device_id = self.device_id.clone();
        let timeout_ms = self.timeout_ms;
        let command_bytes = full_command.as_bytes().to_vec();

        task::spawn_blocking(move || {
            let mut guard = connection_clone.lock();
            let port = guard.as_mut().ok_or_else(|| {
                BridgeError::ConnectionError("Serial port not opened".to_string())
            })?;

            debug!(
                "Sending Serial command to {}: {}",
                device_id,
                String::from_utf8_lossy(&command_bytes).trim()
            );

            port.write_all(&command_bytes)
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
            debug!("Received Serial response from {}: {}", device_id, resp);
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

    fn parse_rincmd_response(&self, response: &str) -> Result<WeightReading, BridgeError> {
        // Implementacja zgodna z scale-parser.md - parseRinCmdResponse
        if response.is_empty() {
            return Err(BridgeError::ProtocolError(
                "Empty response from device".to_string(),
            ));
        }

        // Pattern 1: (\d{8})([+-])(\d+\.\d+)(kg|lb)
        // Example: "20050026+123.45kg" or "20050025-23.5kg"
        let pattern1 = Regex::new(r"(\d{8})([+-])(\d+\.\d+)(kg|lb)").unwrap();
        if let Some(caps) = pattern1.captures(response) {
            let command_code = caps.get(1).unwrap().as_str();
            let sign = caps.get(2).unwrap().as_str();
            let value = caps.get(3).unwrap().as_str();
            let unit = caps.get(4).unwrap().as_str().to_lowercase();

            let weight_val = format!("{}{}", sign, value).parse::<f64>().map_err(|e| {
                BridgeError::ProtocolError(format!("Failed to parse weight: {}", e))
            })?;

            // 20050026 = readGross, 20050025 = readNet
            let is_gross = command_code == "20050026";
            let is_stable = true; // Assume stable for this format

            return Ok(WeightReading {
                gross_weight: if is_gross { weight_val } else { 0.0 },
                net_weight: if is_gross { 0.0 } else { weight_val },
                unit,
                is_stable,
                timestamp: Utc::now(),
            });
        }

        // Pattern 2: :\s*([+-]?)\s*(\d+\.?\d*)\s*(kg|lb|g)\s*([GNTZ])
        // Example: ": -23 kg G" or ": +123.45 kg N"
        let pattern2 = Regex::new(r":\s*([+-]?)\s*(\d+\.?\d*)\s*(kg|lb|g)\s*([GNTZ])").unwrap();
        if let Some(caps) = pattern2.captures(response) {
            let sign = caps.get(1).unwrap().as_str();
            let value = caps.get(2).unwrap().as_str();
            let unit = caps.get(3).unwrap().as_str().to_lowercase();
            let status_char = caps.get(4).unwrap().as_str().to_uppercase();

            let numeric_value = value.parse::<f64>().map_err(|e| {
                BridgeError::ProtocolError(format!("Failed to parse value: {}", e))
            })?;

            let weight_val = if sign == "-" {
                -numeric_value
            } else {
                numeric_value
            };

            let is_net = status_char == "N";
            let is_stable = status_char == "G" || status_char == "N";

            return Ok(WeightReading {
                gross_weight: if is_net { 0.0 } else { weight_val },
                net_weight: if is_net { weight_val } else { 0.0 },
                unit,
                is_stable,
                timestamp: Utc::now(),
            });
        }

        // Fallback: Try to parse standard RINCMD format "S 00000.000 kg" or "U 00000.000 kg"
        let mut cleaned = response.trim().to_string();
        let replacements = [
            ('\t', ' '),
            ('\n', ' '),
            ('\x0B', ' '),
            ('\x0C', ' '),
            ('\r', ' '),
            ('\u{00A0}', ' '),
        ];
        for (from, to) in replacements.iter() {
            cleaned = cleaned.replace(*from, &to.to_string());
        }

        let dash_chars = ['−', '–', '—', '―', '‑', '−', '－'];
        for d in dash_chars.iter() {
            if cleaned.contains(*d) {
                cleaned = cleaned.replace(*d, "-");
            }
        }

        if cleaned == "E" || response == "E" {
            return Err(BridgeError::ProtocolError(
                "Device returned error 'E'".to_string(),
            ));
        }

        let parts: Vec<&str> = cleaned.split_whitespace().collect();
        if parts.is_empty() {
            return Err(BridgeError::ProtocolError(
                "Empty response from device".to_string(),
            ));
        }

        let is_stable = parts[0] == "S";

        let search_space = if let Some(pos) = cleaned.find(':') {
            cleaned[(pos + 1)..].trim().to_string()
        } else {
            cleaned.clone()
        };

        let num_re = Regex::new(r"([+-]?\s*\d+(?:\.\d+)?)").unwrap();
        if let Some(m) = num_re.find(&search_space) {
            let mut num_str = m.as_str().to_string();
            num_str.retain(|c| c != ' ');
            let weight_val = num_str.parse::<f64>().map_err(|e| {
                BridgeError::ProtocolError(format!("Failed to parse weight '{}': {}", num_str, e))
            })?;

            let after = &search_space[m.end()..];
            let unit_re = Regex::new(r"[A-Za-z%]+").unwrap();
            let unit = unit_re
                .find(after)
                .map(|u| u.as_str().to_string())
                .unwrap_or_else(|| "kg".to_string());

            return Ok(WeightReading {
                gross_weight: weight_val,
                net_weight: weight_val,
                unit,
                is_stable,
                timestamp: Utc::now(),
            });
        }

        Err(BridgeError::ProtocolError(format!(
            "Unexpected response format: '{}'",
            response
        )))
    }
}

#[async_trait]
impl DeviceAdapter for RinstrumC320Adapter {
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
                info!("Attempting to connect to Rinstrum C320 at {} (TCP)", addr);

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
                        error!("Failed to connect to Rinstrum C320 at {}: {}", addr, e);
                        BridgeError::ConnectionError(format!("Failed to connect: {}", e))
                    })?;

                info!(
                    "Successfully connected to Rinstrum C320 at {} for device {} (TCP)",
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
                        "Serial port {} opened for Rinstrum C320 device {} ({} baud, {}-{}-{})",
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
            warn!(
                "Device {} not connected, attempting to reconnect for command '{}'",
                self.device_id, command
            );
            self.connect().await?;
        }

        let command_str = self
            .commands
            .get(command)
            .ok_or_else(|| BridgeError::InvalidCommand(format!("Unknown command: {}", command)))?;

        let response = self.send_command_and_read_response(command_str).await?;
        self.parse_rincmd_response(&response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn make_adapter_tcp() -> RinstrumC320Adapter {
        let conn = Connection::Tcp {
            host: "127.0.0.1".to_string(),
            port: 4001,
            timeout_ms: 1000,
        };
        let mut cmd = HashMap::new();
        cmd.insert("readGross".to_string(), "20050026".to_string());
        cmd.insert("readNet".to_string(), "20050025".to_string());
        cmd.insert("tare".to_string(), "21120008:0C".to_string());
        cmd.insert("zero".to_string(), "21120008:0B".to_string());
        RinstrumC320Adapter::new("test_device".to_string(), conn, cmd).unwrap()
    }

    #[test]
    fn parses_pattern1_with_gross() {
        let a = make_adapter_tcp();
        let parsed = a.parse_rincmd_response("20050026+123.45kg").unwrap();
        assert!(parsed.is_stable);
        assert_eq!(parsed.unit, "kg");
        assert_eq!(parsed.gross_weight, 123.45);
        assert_eq!(parsed.net_weight, 0.0);
    }

    #[test]
    fn parses_pattern1_with_net() {
        let a = make_adapter_tcp();
        let parsed = a.parse_rincmd_response("20050025-23.5kg").unwrap();
        assert!(parsed.is_stable);
        assert_eq!(parsed.unit, "kg");
        assert_eq!(parsed.gross_weight, 0.0);
        assert_eq!(parsed.net_weight, -23.5);
    }

    #[test]
    fn parses_pattern2_with_gross() {
        let a = make_adapter_tcp();
        let parsed = a.parse_rincmd_response(": -23 kg G").unwrap();
        assert!(parsed.is_stable);
        assert_eq!(parsed.unit, "kg");
        assert_eq!(parsed.gross_weight, -23.0);
        assert_eq!(parsed.net_weight, 0.0);
    }

    #[test]
    fn parses_pattern2_with_net() {
        let a = make_adapter_tcp();
        let parsed = a.parse_rincmd_response(": +123.45 kg N").unwrap();
        assert!(parsed.is_stable);
        assert_eq!(parsed.unit, "kg");
        assert_eq!(parsed.gross_weight, 0.0);
        assert_eq!(parsed.net_weight, 123.45);
    }

    #[test]
    fn parses_negative_with_space_and_unit() {
        let a = make_adapter_tcp();
        let parsed = a.parse_rincmd_response("S -32.000 kg").unwrap();
        assert!(parsed.is_stable);
        assert_eq!(parsed.unit, "kg");
        assert_eq!(parsed.gross_weight, -32.0);
    }

    #[test]
    fn parses_unstable_positive() {
        let a = make_adapter_tcp();
        let parsed = a.parse_rincmd_response("U 00032.000 kg").unwrap();
        assert!(!parsed.is_stable);
        assert_eq!(parsed.unit, "kg");
        assert_eq!(parsed.gross_weight, 32.0);
    }

    #[test]
    fn returns_error_on_e() {
        let a = make_adapter_tcp();
        assert!(a.parse_rincmd_response("E").is_err());
    }

    #[test]
    fn parses_negative_spaced_sign_and_flags() {
        let a = make_adapter_tcp();
        let raw = "81050026:-     23 kg G";
        let parsed = a.parse_rincmd_response(raw).unwrap();
        assert_eq!(parsed.gross_weight, -23.0);
        assert_eq!(parsed.unit, "kg");
    }
}
