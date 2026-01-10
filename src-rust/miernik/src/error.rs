use thiserror::Error;

#[derive(Error, Debug)]
pub enum MiernikError {
    #[error("Device error: {0}")]
    DeviceError(String),
    
    #[error("Invalid command: {0}")]
    InvalidCommand(String),
    
    #[error("Protocol error: {0}")]
    ProtocolError(String),
    
    #[error("Configuration error: {0}")]
    ConfigurationError(String),
    
    #[error("Host error: {0}")]
    HostError(String),
}

