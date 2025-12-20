use thiserror::Error;

#[derive(Error, Debug)]
pub enum HostError {
    #[error("Connection error: {0}")]
    ConnectionError(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Timeout error: {0}")]
    Timeout(String),
    
    #[error("Protocol error: {0}")]
    ProtocolError(String),
    
    #[error("Serial port error: {0}")]
    SerialPortError(String),
    
    #[error("Invalid configuration: {0}")]
    ConfigurationError(String),
}

