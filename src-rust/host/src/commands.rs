//! Command execution and communication

use crate::connection::{Connection, ConnectionType};
use crate::error::HostError;
use crate::protocol::Protocol;
use log::{debug, warn};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration as TokioDuration};

/// Command executor for sending commands and receiving responses
#[derive(Debug)]
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
        stream: &Arc<tokio::sync::RwLock<Option<TcpStream>>>,
        command: &str,
    ) -> Result<String, HostError> {
        // Always reconnect before use - some devices close connection after first use
        // This ensures we have a fresh connection for each command
        if let ConnectionType::Tcp { host, port, .. } = &self.connection.connection_type {
            debug!("Ensuring TCP connection to {}:{}...", host, port);
            // Clear any existing connection first
            {
                let mut guard = stream.write().await;
                *guard = None;
            }
            // Connect fresh
            if let Err(e) = self.connection.connect_tcp().await {
                return Err(HostError::ConnectionError(format!(
                    "Failed to connect to {}:{}: {}",
                    host, port, e
                )));
            }
        } else {
            return Err(HostError::ConnectionError(
                "No active TCP connection".to_string()
            ));
        }

        let conn_opt = {
            let mut guard = stream.write().await;
            guard.take()
        };

        let mut conn = conn_opt.ok_or_else(|| {
            HostError::ConnectionError("No active TCP connection".to_string())
        })?;

        let timeout_duration = TokioDuration::from_millis(self.connection.timeout_ms as u64);

        // Write command with flush to ensure data is sent immediately
        let write_result = timeout(timeout_duration, async {
            conn.write_all(command.as_bytes()).await?;
            conn.flush().await?;
            Ok::<(), std::io::Error>(())
        })
        .await;

        // Handle write result
        let write_error = match write_result {
            Ok(Ok(())) => None,
            Ok(Err(e)) => {
                warn!("TCP write IO error: {}", e);
                Some(HostError::IoError(e))
            }
            Err(_) => {
                Some(HostError::Timeout(format!(
                    "Write timeout after {}ms",
                    self.connection.timeout_ms
                )))
            }
        };

        // If write failed, return connection and error
        if let Some(err) = write_error {
            // Check if it's an IO error - connection may be broken
            let is_io_error = matches!(err, HostError::IoError(_));
            {
                let mut guard = stream.write().await;
                if is_io_error {
                    // Clear broken connection
                    *guard = None;
                    drop(conn);
                } else {
                    // Return connection for timeout (may still be good)
                    *guard = Some(conn);
                }
            }
            return Err(err);
        }

        // Read response
        let mut buffer = vec![0; 1024];
        let read_result = timeout(timeout_duration, conn.read(&mut buffer))
            .await;

        // Handle read result and always return connection
        match read_result {
            Ok(Ok(bytes_read)) => {
                let response = String::from_utf8_lossy(&buffer[..bytes_read])
                    .trim()
                    .to_string();
                
                // Return connection on success
                {
                    let mut guard = stream.write().await;
                    *guard = Some(conn);
                }
                
                Ok(response)
            }
            Ok(Err(e)) => {
                // IO error during read - connection is likely broken
                warn!("TCP read IO error, clearing connection for reconnect: {}", e);
                {
                    let mut guard = stream.write().await;
                    *guard = None;
                }
                drop(conn);
                Err(HostError::IoError(e))
            }
            Err(_) => {
                // Read timeout - connection may still be good
                {
                    let mut guard = stream.write().await;
                    *guard = Some(conn);
                }
                Err(HostError::Timeout(format!(
                    "Read timeout after {}ms",
                    self.connection.timeout_ms
                )))
            }
        }
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

