//! Command execution and communication

use crate::connection::Connection;
use crate::error::HostError;
use crate::protocol::Protocol;
use log::debug;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration as TokioDuration};

/// Command executor for sending commands and receiving responses
pub struct CommandExecutor {
    connection: Arc<Connection>,
    protocol: Protocol,
}

impl CommandExecutor {
    pub fn new(connection: Arc<Connection>, protocol: Protocol) -> Self {
        Self {
            connection,
            protocol,
        }
    }

    /// Send command and read response
    pub async fn execute(&self, command: &str) -> Result<String, HostError> {
        let full_command = format!("{}{}", command, self.protocol.command_terminator());
        debug!("Sending command: {}", full_command.trim());

        match &self.connection.connection_type {
            crate::connection::ConnectionType::Tcp { stream, .. } => {
                self.send_tcp(stream, &full_command).await
            }
            crate::connection::ConnectionType::Serial { connection, .. } => {
                self.send_serial(connection, &full_command).await
            }
        }
    }

    async fn send_tcp(
        &self,
        stream: &Arc<parking_lot::RwLock<Option<TcpStream>>>,
        command: &str,
    ) -> Result<String, HostError> {
        let mut conn_opt = {
            let mut guard = stream.write();
            guard.take()
        };

        let mut conn = conn_opt.ok_or_else(|| {
            HostError::ConnectionError("No active TCP connection".to_string())
        })?;

        let timeout_duration = TokioDuration::from_millis(self.connection.timeout_ms as u64);

        // Write command
        timeout(timeout_duration, conn.write_all(command.as_bytes()))
            .await
            .map_err(|_| {
                HostError::Timeout(format!(
                    "Write timeout after {}ms",
                    self.connection.timeout_ms
                ))
            })?
            .map_err(|e| HostError::IoError(e))?;

        // Read response
        let mut buffer = vec![0; 1024];
        let bytes_read = timeout(timeout_duration, conn.read(&mut buffer))
            .await
            .map_err(|_| {
                HostError::Timeout(format!(
                    "Read timeout after {}ms",
                    self.connection.timeout_ms
                ))
            })?
            .map_err(|e| HostError::IoError(e))?;

        let response = String::from_utf8_lossy(&buffer[..bytes_read])
            .trim()
            .to_string();

        // Return connection
        {
            let mut guard = stream.write();
            *guard = Some(conn);
        }

        Ok(response)
    }

    async fn send_serial(
        &self,
        connection: &Arc<parking_lot::Mutex<Option<Box<dyn serialport::SerialPort + Send>>>>,
        command: &str,
    ) -> Result<String, HostError> {
        use std::io::{Read, Write};
        use std::time::Instant;
        use tokio::task;

        let connection_clone = connection.clone();
        let timeout_ms = self.connection.timeout_ms;
        let command_bytes = command.as_bytes().to_vec();

        task::spawn_blocking(move || {
            let mut guard = connection_clone.lock();
            let port = guard.as_mut().ok_or_else(|| {
                HostError::ConnectionError("Serial port not opened".to_string())
            })?;

            debug!(
                "Sending Serial command: {}",
                String::from_utf8_lossy(&command_bytes).trim()
            );

            port.write_all(&command_bytes)
                .map_err(|e| HostError::IoError(e))?;
            port.flush().map_err(|e| HostError::IoError(e))?;

            let mut buffer = [0u8; 256];
            let mut response = Vec::new();
            let timeout = Duration::from_millis(timeout_ms as u64);
            let start = Instant::now();

            loop {
                if start.elapsed() >= timeout {
                    return Err(HostError::Timeout(format!(
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
                            return Err(HostError::Timeout(format!(
                                "No response from device in {} ms",
                                timeout_ms
                            )));
                        }
                        break;
                    }
                    Err(e) => return Err(HostError::IoError(e)),
                }
            }

            let resp = String::from_utf8_lossy(&response).trim().to_string();
            debug!("Received Serial response: {}", resp);
            Ok(resp)
        })
        .await
        .map_err(|e| {
            HostError::ConnectionError(format!("Blocking task failed: {}", e))
        })?
    }
}

