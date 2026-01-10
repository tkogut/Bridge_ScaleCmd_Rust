//! ScaleIT Host Library
//! 
//! Provides connection management, protocol handling, and command execution
//! for industrial scale communication (TCP/Serial).

pub mod connection;
pub mod protocol;
pub mod commands;
pub mod error;

pub use connection::{Connection, ConnectionType, TcpConnection, SerialConnection};
pub use protocol::Protocol;
pub use commands::CommandExecutor;
pub use error::HostError;

