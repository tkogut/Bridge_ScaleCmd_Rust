use async_trait::async_trait;
use chrono::Utc;
use log::{debug, error, info, warn};
use parking_lot::RwLock;
use regex::Regex;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};

use super::adapter::DeviceAdapter;
use crate::error::BridgeError;
use crate::models::device::Connection;
use crate::models::weight::WeightReading;

struct TcpConnectionDetails {
    host: String,
    port: u16,
    timeout_ms: u32,
}

pub struct RinstrumC320Adapter {
    device_id: String,
    connection: Arc<RwLock<Option<TcpStream>>>,
    tcp: TcpConnectionDetails,
    commands: HashMap<String, String>,
}

impl RinstrumC320Adapter {
    pub fn new(
        device_id: String,
        connection: Connection,
        commands: HashMap<String, String>,
    ) -> Result<Self, BridgeError> {
        let tcp = match connection {
            Connection::Tcp {
                host,
                port,
                timeout_ms,
            } => TcpConnectionDetails {
                host,
                port,
                timeout_ms,
            },
            other => {
                return Err(BridgeError::ConfigurationError(format!(
                    "RinstrumC320Adapter only supports TCP connections, got {:?}",
                    other
                )))
            }
        };

        Ok(Self {
            device_id,
            connection: Arc::new(RwLock::new(None)),
            tcp,
            commands,
        })
    }

    async fn send_command_and_read_response(
        &self,
        command_str: &str,
    ) -> Result<String, BridgeError> {
        // Take the TcpStream out of the RwLock-protected Option so we don't hold
        // a non-Send lock guard across .await points. Put it back after I/O.
        let conn_opt = {
            let mut conn_guard = self.connection.write();
            conn_guard.take()
        };

        let mut conn = conn_opt.ok_or_else(|| {
            error!(
                "Attempted to send command without an active connection for device {}",
                self.device_id
            );
            BridgeError::ConnectionError("No active connection".to_string())
        })?;

        let full_command = format!("{}\r\n", command_str); // RINCMD typically uses CR+LF
        debug!(
            "Sending command to {}: {}",
            self.device_id,
            full_command.trim()
        );

        let timeout_duration = Duration::from_millis(self.tcp.timeout_ms as u64);

        timeout(timeout_duration, conn.write_all(full_command.as_bytes()))
            .await
            .map_err(|_| {
                warn!("Write timeout for device {}", self.device_id);
                BridgeError::Timeout(format!("Write timeout after {}ms", self.tcp.timeout_ms))
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
                BridgeError::Timeout(format!("Read timeout after {}ms", self.tcp.timeout_ms))
            })?
            .map_err(|e| {
                error!("Failed to read from device {}: {}", self.device_id, e);
                BridgeError::IoError(e)
            })?;

        let response = String::from_utf8_lossy(&buffer[..bytes_read])
            .trim()
            .to_string();
        debug!("Received response from {}: {}", self.device_id, response);

        // Put the stream back into the shared slot.
        {
            let mut conn_guard = self.connection.write();
            *conn_guard = Some(conn);
        }

        Ok(response)
    }

    fn parse_rincmd_response(&self, response: &str) -> Result<WeightReading, BridgeError> {
        // Example RINCMD response: "S 00000.000 kg" (Stable, 0.000 kg)
        // Or "U 00000.000 kg" (Unstable)
        // Or "E" (Error)
        // This is a simplified parser. Real RINCMD might be more complex.

        if response.is_empty() {
            return Err(BridgeError::ProtocolError(
                "Empty response from device".to_string(),
            ));
        }

        // Normalize common unicode minus/dash characters and non-breaking spaces
        let mut cleaned = response.trim().to_string();
        let replacements = [
            ('\t', ' '), // TAB -> space
            ('\n', ' '), // LF -> space
            ('\x0B', ' '),
            ('\x0C', ' '),
            ('\r', ' '),
            ('\u{00A0}', ' '), // NBSP
        ];
        for (from, to) in replacements.iter() {
            cleaned = cleaned.replace(*from, &to.to_string());
        }
        // Various dash/minus characters -> ASCII hyphen-minus
        let dash_chars = ['−', '–', '—', '―', '‑', '−', '－'];
        for d in dash_chars.iter() {
            if cleaned.contains(*d) {
                cleaned = cleaned.replace(*d, "-");
            }
        }

        if cleaned != response {
            debug!(
                "Normalized device response from '{}' to '{}'",
                response, cleaned
            );
        }

        let parts: Vec<&str> = cleaned.split_whitespace().collect();
        if parts.is_empty() {
            return Err(BridgeError::ProtocolError(
                "Empty response from device".to_string(),
            ));
        }

        if cleaned == "E" || response == "E" {
            return Err(BridgeError::ProtocolError(
                "Device returned error 'E'".to_string(),
            ));
        }

        // Stability marker is usually the first token (e.g., "S" or "U")
        let is_stable = parts[0] == "S";

        // If there's a colon, prefer parsing the substring after it (this avoids matching
        // command echoes like "81050026" before the colon). Otherwise, search the whole string.
        let search_space = if let Some(pos) = cleaned.find(':') {
            cleaned[(pos + 1)..].trim().to_string()
        } else {
            cleaned.clone()
        };

        // Try to detect a hex value at the start of the search space (e.g. "FFFFFFE9")
        let hex_match = Regex::new(r"^[0-9A-Fa-f]{2,8}").unwrap();
        if let Some(mh) = hex_match.find(&search_space) {
            let token = &search_space[mh.start()..mh.end()];
            // If token contains alphabetic hex digits (A-F) it's likely a hex two's-complement value.
            if token.chars().any(|c| matches!(c, 'A'..='F' | 'a'..='f')) {
                if let Ok(u) = u32::from_str_radix(token, 16) {
                    let signed = u as i32 as f64;
                    // try to infer unit from the rest of the search space
                    let mut unit = String::new();
                    if let Some(parts_after) = search_space.split_whitespace().nth(1) {
                        if parts_after.chars().all(|c| c.is_alphabetic()) {
                            unit = parts_after.to_string();
                        }
                    }
                    return Ok(WeightReading {
                        gross_weight: signed,
                        net_weight: signed,
                        unit,
                        is_stable,
                        timestamp: Utc::now(),
                    });
                }
            } else {
                // Token contains only digits; treat as a decimal integer (not hex)
                if let Ok(dec) = i64::from_str_radix(token, 10) {
                    let val = dec as f64;
                    let mut unit = String::new();
                    if let Some(parts_after) = search_space.split_whitespace().nth(1) {
                        if parts_after.chars().all(|c| c.is_alphabetic()) {
                            unit = parts_after.to_string();
                        }
                    }
                    return Ok(WeightReading {
                        gross_weight: val,
                        net_weight: val,
                        unit,
                        is_stable,
                        timestamp: Utc::now(),
                    });
                }
            }
        }

        // Use regex to find a signed or unsigned numeric token in the search space,
        // allowing spaces between sign and digits
        let num_re = Regex::new(r"(?P<num>[+-]?\s*\d+(?:\.\d+)?)").unwrap();
        if let Some(m) = num_re.find(&search_space) {
            let mut num_str = m.as_str().to_string();
            num_str.retain(|c| c != ' '); // remove spaces between sign and digits
            let weight_val = num_str.parse::<f64>().map_err(|e| {
                BridgeError::ProtocolError(format!("Failed to parse weight '{}': {}", num_str, e))
            })?;

            // find unit after the number within the search space
            let after = &search_space[m.end()..];
            let unit_re = Regex::new(r"[A-Za-z%]+").unwrap();
            let unit = unit_re
                .find(after)
                .map(|u| u.as_str().to_string())
                .unwrap_or_default();

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
        // Fast path: check without taking a write lock (use read guard), and avoid
        // holding any parking_lot guard across await points.
        {
            let conn_guard = self.connection.read();
            if conn_guard.is_some() {
                info!("Device {} already connected.", self.device_id);
                return Ok(());
            }
        }

        let addr = format!("{}:{}", self.tcp.host, self.tcp.port);
        info!("Attempting to connect to Rinstrum C320 at {}", addr);

        let connect_future = TcpStream::connect(&addr);
        let timeout_duration = Duration::from_millis(self.tcp.timeout_ms as u64);

        let stream = timeout(timeout_duration, connect_future)
            .await
            .map_err(|_| {
                error!(
                    "Connection timeout to {} for device {}",
                    addr, self.device_id
                );
                BridgeError::Timeout(format!(
                    "Connection timeout after {}ms",
                    self.tcp.timeout_ms
                ))
            })?
            .map_err(|e| {
                error!("Failed to connect to Rinstrum C320 at {}: {}", addr, e);
                BridgeError::ConnectionError(format!("Failed to connect: {}", e))
            })?;

        info!(
            "Successfully connected to Rinstrum C320 at {} for device {}",
            addr, self.device_id
        );
        {
            let mut conn_guard = self.connection.write();
            *conn_guard = Some(stream);
        }
        Ok(())
    }

    async fn disconnect(&self) -> Result<(), BridgeError> {
        let mut conn_guard = self.connection.write();
        if let Some(_stream) = conn_guard.take() {
            // TcpStream doesn't have an explicit close method, dropping it closes the connection.
            // However, we might want to ensure all data is flushed before dropping.
            // For simplicity, we just drop it here.
            info!("Disconnected from device {}", self.device_id);
        } else {
            warn!(
                "Attempted to disconnect device {} which was not connected.",
                self.device_id
            );
        }
        Ok(())
    }

    fn is_connected(&self) -> bool {
        self.connection.read().is_some()
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

    fn make_adapter() -> RinstrumC320Adapter {
        let conn = Connection::Tcp {
            host: "127.0.0.1".to_string(),
            port: 4001,
            timeout_ms: 1000,
        };
        let mut cmd = HashMap::new();
        cmd.insert("readGross".to_string(), "".to_string());
        cmd.insert("readNet".to_string(), "".to_string());
        cmd.insert("tare".to_string(), "".to_string());
        cmd.insert("zero".to_string(), "".to_string());
        RinstrumC320Adapter::new("test_device".to_string(), conn, cmd).unwrap()
    }

    #[test]
    fn parses_negative_with_space_and_unit() {
        let a = make_adapter();
        let parsed = a.parse_rincmd_response("S -32.000 kg").unwrap();
        assert!(parsed.is_stable);
        assert_eq!(parsed.unit, "kg");
        assert_eq!(parsed.gross_weight, -32.0);
    }

    #[test]
    fn parses_negative_attached_unit() {
        let a = make_adapter();
        let parsed = a.parse_rincmd_response("S -00032.000kg").unwrap();
        assert!(parsed.is_stable);
        assert_eq!(parsed.unit, "kg");
        assert_eq!(parsed.gross_weight, -32.0);
    }

    #[test]
    fn parses_unstable_positive() {
        let a = make_adapter();
        let parsed = a.parse_rincmd_response("U 00032.000 kg").unwrap();
        assert!(!parsed.is_stable);
        assert_eq!(parsed.unit, "kg");
        assert_eq!(parsed.gross_weight, 32.0);
    }

    #[test]
    fn returns_error_on_e() {
        let a = make_adapter();
        assert!(a.parse_rincmd_response("E").is_err());
    }

    #[test]
    fn parses_negative_spaced_sign_and_flags() {
        let a = make_adapter();
        // Exact raw response provided: command echo + colon + sign with spaces + number + unit + flag
        let raw = "81050026:-     23 kg G";
        let parsed = a.parse_rincmd_response(raw).unwrap();
        assert_eq!(parsed.gross_weight, -23.0);
        assert_eq!(parsed.unit, "kg");
    }
}
