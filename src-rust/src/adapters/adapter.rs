use async_trait::async_trait;
use crate::error::BridgeError;
use crate::models::weight::WeightReading;

#[async_trait]
pub trait DeviceAdapter: Send + Sync {
    /// Tworzy nowe połączenie z urządzeniem.
    async fn connect(&self) -> Result<(), BridgeError>;

    /// Rozłącza się z urządzeniem.
    async fn disconnect(&self) -> Result<(), BridgeError>;

    /// Sprawdza, czy połączenie jest aktywne.
    fn is_connected(&self) -> bool;

    /// Wykonuje komendę na urządzeniu i zwraca odczyt wagi.
    async fn execute_command(&self, command: &str) -> Result<WeightReading, BridgeError>;
}