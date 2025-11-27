use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use chrono::Utc;
use lazy_static::lazy_static;
use log::{debug, error, info, warn};
use parking_lot::Mutex;
use regex::Regex;
use tokio::task;

lazy_static! {
    static ref DINI_VALUE_RE: Regex = Regex::new(r"(?P<num>[+-]?\d+(?:\.\d+)?)").unwrap();
    static ref DINI_UNIT_RE: Regex = Regex::new(r"[A-Za-z%]+").unwrap();
}

use crate::adapters::adapter::DeviceAdapter;
use crate::error::BridgeError;
use crate::models::device::Connection;
use crate::models::weight::WeightReading;

/// Adapter that speaks the ASCII/DFW protocol used by Dini Argeo controllers.
/// Serial I/O is performed inside `spawn_blocking` so it does not block the async runtime.
pub struct DiniArgeoAsciiAdapter {
    device_id: String,
    port_path: String,
    baud_rate: u32,
    timeout_ms: u32,
    commands: HashMap<String, String>,
    connection: Arc<Mutex<Option<Box<dyn serialport::SerialPort + Send>>>>,
}

impl DiniArgeoAsciiAdapter {
    pub fn new(
        device_id: String,
        connection: Connection,
        commands: HashMap<String, String>,
    ) -> Result<Self, BridgeError> {
        let (port_path, baud_rate, timeout_ms) = match connection {
            Connection::Serial {
                port,
                baud_rate,
                timeout_ms,
            } => (port, baud_rate, timeout_ms),
            other => {
                return Err(BridgeError::ConfigurationError(format!(
                    "DiniArgeoAsciiAdapter requires a serial connection, got {:?}",
                    other
                )))
            }
        };

        Ok(Self {
            device_id,
            port_path,
            baud_rate,
            timeout_ms,
            commands,
            connection: Arc::new(Mutex::new(None)),
        })
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
        if response.trim().is_empty() {
            return Err(BridgeError::ProtocolError(
                "Empty response from Dini Argeo device".to_string(),
            ));
        }

        // Dini controllers usually respond with comma separated flags, example: ST,GS,+00023.450kg
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

    async fn open_serial_port(&self) -> Result<(), BridgeError> {
        if self.is_connected() {
            return Ok(());
        }

        let port_path = self.port_path.clone();
        let baud_rate = self.baud_rate;
        let timeout_ms = self.timeout_ms;
        let connection = self.connection.clone();
        let device_id = self.device_id.clone();

        task::spawn_blocking(move || {
            let mut port = serialport::new(port_path.clone(), baud_rate)
                .timeout(Duration::from_millis(timeout_ms as u64))
                .open()
                .map_err(|e| {
                    error!(
                        "Failed to open serial port {} for device {}: {}",
                        port_path, device_id, e
                    );
                    BridgeError::ConnectionError(format!(
                        "Unable to open serial port {}: {}",
                        port_path, e
                    ))
                })?;

            if let Err(e) = port.set_timeout(Duration::from_millis(timeout_ms as u64)) {
                warn!("Unable to set timeout on serial port: {}", e);
            }

            let mut guard = connection.lock();
            *guard = Some(port);
            info!(
                "Serial port {} opened for Dini Argeo device {}",
                port_path, device_id
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

    async fn send_command_and_read_response(&self, command: &str) -> Result<String, BridgeError> {
        let formatted_command = self.format_command(command);
        if formatted_command.is_empty() {
            return Err(BridgeError::InvalidCommand(
                "ASCII command cannot be empty".to_string(),
            ));
        }

        let connection = self.connection.clone();
        let timeout_ms = self.timeout_ms;
        let device_id = self.device_id.clone();

        task::spawn_blocking(move || {
            let mut guard = connection.lock();
            let port = guard.as_mut().ok_or_else(|| {
                BridgeError::ConnectionError("Serial port not opened".to_string())
            })?;

            debug!(
                "Sending ASCII command to {}: {}",
                device_id,
                String::from_utf8_lossy(&formatted_command).trim()
            );

            port.write_all(&formatted_command)
                .map_err(|e| BridgeError::IoError(e))?;
            port.flush().map_err(|e| BridgeError::IoError(e))?;

            let mut buffer = [0u8; 256];
            let mut response = Vec::new();
            let timeout = Duration::from_millis(timeout_ms as u64);
            let start = Instant::now();

            loop {
                if start.elapsed() >= timeout {
                    return Err(BridgeError::Timeout(format!(
                        "Timed out waiting {} ms for Dini Argeo response",
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
                                "No response from Dini Argeo device in {} ms",
                                timeout_ms
                            )));
                        }
                        break;
                    }
                    Err(e) => return Err(BridgeError::IoError(e)),
                }
            }

            let resp = String::from_utf8_lossy(&response).trim().to_string();
            debug!("ASCII response from {}: {}", device_id, resp);
            Ok(resp)
        })
        .await
        .map_err(|e| {
            BridgeError::InternalServerError(format!(
                "Blocking task failed for ASCII command: {}",
                e
            ))
        })?
    }
}

#[async_trait]
impl DeviceAdapter for DiniArgeoAsciiAdapter {
    async fn connect(&self) -> Result<(), BridgeError> {
        self.open_serial_port().await
    }

    async fn disconnect(&self) -> Result<(), BridgeError> {
        let mut guard = self.connection.lock();
        if guard.take().is_some() {
            info!("Disconnected Dini Argeo device {}", self.device_id);
        } else {
            warn!(
                "Attempted to disconnect Dini Argeo device {} which was not connected",
                self.device_id
            );
        }
        Ok(())
    }

    fn is_connected(&self) -> bool {
        self.connection.lock().is_some()
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

    fn adapter_for_tests() -> DiniArgeoAsciiAdapter {
        let connection = Connection::Serial {
            port: "COM1".to_string(),
            baud_rate: 9600,
            timeout_ms: 1000,
        };
        let mut commands = HashMap::new();
        commands.insert("readGross".to_string(), "W".to_string());
        commands.insert("readNet".to_string(), "N".to_string());
        commands.insert("tare".to_string(), "T".to_string());
        commands.insert("zero".to_string(), "Z".to_string());

        DiniArgeoAsciiAdapter::new("test".to_string(), connection, commands).unwrap()
    }

    #[test]
    fn parses_standard_response() {
        let adapter = adapter_for_tests();
        let (value, unit, is_stable) = adapter
            .parse_weight_from_response("ST,GS,+00023.450kg")
            .unwrap();
        assert_eq!(value, 23.45);
        assert_eq!(unit, "kg");
        assert!(is_stable);
    }

    #[test]
    fn parses_unstable_negative_response() {
        let adapter = adapter_for_tests();
        let (value, unit, is_stable) = adapter.parse_weight_from_response("US,NT,-12.5kg").unwrap();
        assert_eq!(value, -12.5);
        assert_eq!(unit, "kg");
        assert!(!is_stable);
    }

    #[test]
    fn fails_on_empty_response() {
        let adapter = adapter_for_tests();
        assert!(adapter.parse_weight_from_response("   ").is_err());
    }
}
