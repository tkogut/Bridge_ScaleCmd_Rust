use thiserror::Error;

#[derive(Error, Debug)]
pub enum BridgeError {
    #[error("Device not found: {0}")]
    DeviceNotFound(String),
    #[error("Connection error: {0}")]
    ConnectionError(String),
    #[error("Command execution error: {0}")]
    CommandError(String),
    #[error("Configuration error: {0}")]
    ConfigurationError(String),
    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    #[error("Timeout error: {0}")]
    Timeout(String),
    #[error("Protocol error: {0}")]
    ProtocolError(String),
    #[error("Invalid command: {0}")]
    InvalidCommand(String),
    #[error("Internal server error: {0}")]
    InternalServerError(String),
    #[error("Unknown error: {0}")]
    Unknown(String),
}
