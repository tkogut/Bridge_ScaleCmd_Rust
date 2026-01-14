//! MQTT History Module
//! 
//! This module provides in-memory storage for weight readings and device status
//! history received via MQTT. It supports:
//! - Storing weight readings with timestamps
//! - Storing device status changes
//! - Querying history by device ID with pagination
//! - Time-based filtering
//! - Automatic cleanup of old entries to prevent memory exhaustion

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;
use log::{debug, info};

/// Default maximum number of entries per device
const DEFAULT_MAX_ENTRIES_PER_DEVICE: usize = 1000;

/// Default maximum age for entries (in seconds) - 24 hours
const DEFAULT_MAX_AGE_SECONDS: i64 = 86400;

/// Weight reading entry stored in history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightReadingEntry {
    /// Device identifier
    pub device_id: String,
    /// Weight value
    pub weight: f64,
    /// Weight unit (e.g., "kg", "lb")
    pub unit: String,
    /// Whether the reading is stable
    pub is_stable: bool,
    /// Timestamp when the reading was recorded
    pub timestamp: DateTime<Utc>,
    /// Original MQTT timestamp (from message)
    pub mqtt_timestamp: Option<u64>,
}

/// Device status entry stored in history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceStatusEntry {
    /// Device identifier
    pub device_id: String,
    /// Status string (e.g., "connected", "disconnected", "error")
    pub status: String,
    /// Timestamp when the status was recorded
    pub timestamp: DateTime<Utc>,
    /// Original MQTT timestamp (from message)
    pub mqtt_timestamp: Option<u64>,
}

/// History configuration
#[derive(Debug, Clone)]
pub struct HistoryConfig {
    /// Maximum number of entries per device
    pub max_entries_per_device: usize,
    /// Maximum age for entries in seconds
    pub max_age_seconds: i64,
}

impl Default for HistoryConfig {
    fn default() -> Self {
        Self {
            max_entries_per_device: DEFAULT_MAX_ENTRIES_PER_DEVICE,
            max_age_seconds: DEFAULT_MAX_AGE_SECONDS,
        }
    }
}

/// Device history storage for a single device
#[derive(Debug)]
struct DeviceHistory {
    weight_readings: VecDeque<WeightReadingEntry>,
    status_entries: VecDeque<DeviceStatusEntry>,
}

impl DeviceHistory {
    fn new() -> Self {
        Self {
            weight_readings: VecDeque::new(),
            status_entries: VecDeque::new(),
        }
    }
}

/// MQTT History Store
/// 
/// Thread-safe storage for MQTT weight readings and device status history.
/// Uses RwLock for concurrent read access with exclusive write access.
pub struct MqttHistoryStore {
    /// Map of device_id -> DeviceHistory
    devices: Arc<RwLock<std::collections::HashMap<String, DeviceHistory>>>,
    /// Configuration
    config: HistoryConfig,
}

impl MqttHistoryStore {
    /// Create a new history store with default configuration
    pub fn new() -> Self {
        Self::with_config(HistoryConfig::default())
    }

    /// Create a new history store with custom configuration
    pub fn with_config(config: HistoryConfig) -> Self {
        info!(
            "Creating MQTT history store with max_entries_per_device={}, max_age_seconds={}",
            config.max_entries_per_device, config.max_age_seconds
        );
        Self {
            devices: Arc::new(RwLock::new(std::collections::HashMap::new())),
            config,
        }
    }

    /// Add a weight reading to history
    pub async fn add_weight_reading(&self, entry: WeightReadingEntry) {
        let device_id = entry.device_id.clone();
        debug!(
            "Adding weight reading for device {}: {} {}",
            device_id, entry.weight, entry.unit
        );

        let mut devices = self.devices.write().await;
        let device_history = devices
            .entry(device_id.clone())
            .or_insert_with(DeviceHistory::new);

        // Add new entry
        device_history.weight_readings.push_back(entry);

        // Enforce max entries limit
        while device_history.weight_readings.len() > self.config.max_entries_per_device {
            device_history.weight_readings.pop_front();
        }

        // Cleanup old entries
        self.cleanup_old_weight_readings(&mut device_history.weight_readings);
    }

    /// Add a device status entry to history
    pub async fn add_device_status(&self, entry: DeviceStatusEntry) {
        let device_id = entry.device_id.clone();
        debug!(
            "Adding device status for device {}: {}",
            device_id, entry.status
        );

        let mut devices = self.devices.write().await;
        let device_history = devices
            .entry(device_id.clone())
            .or_insert_with(DeviceHistory::new);

        // Add new entry
        device_history.status_entries.push_back(entry);

        // Enforce max entries limit (use smaller limit for status entries)
        let max_status_entries = self.config.max_entries_per_device / 10;
        while device_history.status_entries.len() > max_status_entries.max(100) {
            device_history.status_entries.pop_front();
        }

        // Cleanup old entries
        self.cleanup_old_status_entries(&mut device_history.status_entries);
    }

    /// Get weight readings history for a device
    /// 
    /// # Arguments
    /// * `device_id` - Device identifier
    /// * `limit` - Maximum number of entries to return (default: 100)
    /// * `offset` - Number of entries to skip (for pagination)
    /// * `since` - Only return entries after this timestamp
    pub async fn get_weight_readings(
        &self,
        device_id: &str,
        limit: Option<usize>,
        offset: Option<usize>,
        since: Option<DateTime<Utc>>,
    ) -> Vec<WeightReadingEntry> {
        let devices = self.devices.read().await;
        
        let Some(device_history) = devices.get(device_id) else {
            return Vec::new();
        };

        let limit = limit.unwrap_or(100);
        let offset = offset.unwrap_or(0);

        // Filter by time if `since` is provided
        let filtered: Vec<_> = if let Some(since_time) = since {
            device_history
                .weight_readings
                .iter()
                .filter(|e| e.timestamp >= since_time)
                .cloned()
                .collect()
        } else {
            device_history.weight_readings.iter().cloned().collect()
        };

        // Apply pagination (return most recent first)
        filtered
            .into_iter()
            .rev()
            .skip(offset)
            .take(limit)
            .collect()
    }

    /// Get device status history for a device
    /// 
    /// # Arguments
    /// * `device_id` - Device identifier
    /// * `limit` - Maximum number of entries to return (default: 50)
    pub async fn get_device_status_history(
        &self,
        device_id: &str,
        limit: Option<usize>,
    ) -> Vec<DeviceStatusEntry> {
        let devices = self.devices.read().await;
        
        let Some(device_history) = devices.get(device_id) else {
            return Vec::new();
        };

        let limit = limit.unwrap_or(50);

        // Return most recent first
        device_history
            .status_entries
            .iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }

    /// Get the latest weight reading for a device
    pub async fn get_latest_weight_reading(&self, device_id: &str) -> Option<WeightReadingEntry> {
        let devices = self.devices.read().await;
        devices
            .get(device_id)
            .and_then(|h| h.weight_readings.back().cloned())
    }

    /// Get the latest device status for a device
    pub async fn get_latest_device_status(&self, device_id: &str) -> Option<DeviceStatusEntry> {
        let devices = self.devices.read().await;
        devices
            .get(device_id)
            .and_then(|h| h.status_entries.back().cloned())
    }

    /// Get all device IDs that have history
    pub async fn get_device_ids(&self) -> Vec<String> {
        let devices = self.devices.read().await;
        devices.keys().cloned().collect()
    }

    /// Get statistics for a device
    pub async fn get_device_stats(&self, device_id: &str) -> Option<DeviceHistoryStats> {
        let devices = self.devices.read().await;
        let device_history = devices.get(device_id)?;

        let weight_count = device_history.weight_readings.len();
        let status_count = device_history.status_entries.len();

        let oldest_reading = device_history.weight_readings.front().map(|e| e.timestamp);
        let newest_reading = device_history.weight_readings.back().map(|e| e.timestamp);

        Some(DeviceHistoryStats {
            device_id: device_id.to_string(),
            weight_readings_count: weight_count,
            status_entries_count: status_count,
            oldest_reading,
            newest_reading,
        })
    }

    /// Clear all history for a device
    pub async fn clear_device_history(&self, device_id: &str) {
        let mut devices = self.devices.write().await;
        devices.remove(device_id);
        info!("Cleared history for device {}", device_id);
    }

    /// Clear all history
    pub async fn clear_all(&self) {
        let mut devices = self.devices.write().await;
        devices.clear();
        info!("Cleared all MQTT history");
    }

    /// Cleanup old weight readings based on max age
    fn cleanup_old_weight_readings(&self, readings: &mut VecDeque<WeightReadingEntry>) {
        let cutoff = Utc::now() - chrono::Duration::seconds(self.config.max_age_seconds);
        while let Some(front) = readings.front() {
            if front.timestamp < cutoff {
                readings.pop_front();
            } else {
                break;
            }
        }
    }

    /// Cleanup old status entries based on max age
    fn cleanup_old_status_entries(&self, entries: &mut VecDeque<DeviceStatusEntry>) {
        let cutoff = Utc::now() - chrono::Duration::seconds(self.config.max_age_seconds);
        while let Some(front) = entries.front() {
            if front.timestamp < cutoff {
                entries.pop_front();
            } else {
                break;
            }
        }
    }
}

impl Default for MqttHistoryStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Statistics for device history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceHistoryStats {
    /// Device identifier
    pub device_id: String,
    /// Number of weight readings in history
    pub weight_readings_count: usize,
    /// Number of status entries in history
    pub status_entries_count: usize,
    /// Timestamp of oldest weight reading
    pub oldest_reading: Option<DateTime<Utc>>,
    /// Timestamp of newest weight reading
    pub newest_reading: Option<DateTime<Utc>>,
}

/// Response structure for history API endpoints
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightHistoryResponse {
    /// Device identifier
    pub device_id: String,
    /// Weight readings
    pub readings: Vec<WeightReadingEntry>,
    /// Total count of readings (before pagination)
    pub total_count: usize,
    /// Pagination offset used
    pub offset: usize,
    /// Pagination limit used
    pub limit: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_add_and_get_weight_reading() {
        let store = MqttHistoryStore::new();
        
        let entry = WeightReadingEntry {
            device_id: "test-device".to_string(),
            weight: 100.5,
            unit: "kg".to_string(),
            is_stable: true,
            timestamp: Utc::now(),
            mqtt_timestamp: Some(1234567890),
        };

        store.add_weight_reading(entry.clone()).await;

        let readings = store.get_weight_readings("test-device", None, None, None).await;
        assert_eq!(readings.len(), 1);
        assert_eq!(readings[0].weight, 100.5);
        assert_eq!(readings[0].unit, "kg");
    }

    #[tokio::test]
    async fn test_add_and_get_device_status() {
        let store = MqttHistoryStore::new();
        
        let entry = DeviceStatusEntry {
            device_id: "test-device".to_string(),
            status: "connected".to_string(),
            timestamp: Utc::now(),
            mqtt_timestamp: Some(1234567890),
        };

        store.add_device_status(entry.clone()).await;

        let statuses = store.get_device_status_history("test-device", None).await;
        assert_eq!(statuses.len(), 1);
        assert_eq!(statuses[0].status, "connected");
    }

    #[tokio::test]
    async fn test_max_entries_limit() {
        let config = HistoryConfig {
            max_entries_per_device: 5,
            max_age_seconds: 86400,
        };
        let store = MqttHistoryStore::with_config(config);

        // Add 10 entries
        for i in 0..10 {
            let entry = WeightReadingEntry {
                device_id: "test-device".to_string(),
                weight: i as f64,
                unit: "kg".to_string(),
                is_stable: true,
                timestamp: Utc::now(),
                mqtt_timestamp: None,
            };
            store.add_weight_reading(entry).await;
        }

        let readings = store.get_weight_readings("test-device", Some(100), None, None).await;
        assert_eq!(readings.len(), 5);
        // Should have entries 5-9 (most recent)
        assert_eq!(readings[0].weight, 9.0);
    }

    #[tokio::test]
    async fn test_get_latest_weight_reading() {
        let store = MqttHistoryStore::new();

        // Add multiple readings
        for i in 0..5 {
            let entry = WeightReadingEntry {
                device_id: "test-device".to_string(),
                weight: i as f64 * 10.0,
                unit: "kg".to_string(),
                is_stable: true,
                timestamp: Utc::now(),
                mqtt_timestamp: None,
            };
            store.add_weight_reading(entry).await;
        }

        let latest = store.get_latest_weight_reading("test-device").await;
        assert!(latest.is_some());
        assert_eq!(latest.unwrap().weight, 40.0);
    }

    #[tokio::test]
    async fn test_get_device_ids() {
        let store = MqttHistoryStore::new();

        let devices = vec!["device-1", "device-2", "device-3"];
        for device_id in &devices {
            let entry = WeightReadingEntry {
                device_id: device_id.to_string(),
                weight: 100.0,
                unit: "kg".to_string(),
                is_stable: true,
                timestamp: Utc::now(),
                mqtt_timestamp: None,
            };
            store.add_weight_reading(entry).await;
        }

        let stored_ids = store.get_device_ids().await;
        assert_eq!(stored_ids.len(), 3);
        for device_id in &devices {
            assert!(stored_ids.contains(&device_id.to_string()));
        }
    }

    #[tokio::test]
    async fn test_clear_device_history() {
        let store = MqttHistoryStore::new();

        let entry = WeightReadingEntry {
            device_id: "test-device".to_string(),
            weight: 100.0,
            unit: "kg".to_string(),
            is_stable: true,
            timestamp: Utc::now(),
            mqtt_timestamp: None,
        };
        store.add_weight_reading(entry).await;

        store.clear_device_history("test-device").await;

        let readings = store.get_weight_readings("test-device", None, None, None).await;
        assert!(readings.is_empty());
    }

    #[tokio::test]
    async fn test_pagination() {
        let store = MqttHistoryStore::new();

        // Add 20 readings
        for i in 0..20 {
            let entry = WeightReadingEntry {
                device_id: "test-device".to_string(),
                weight: i as f64,
                unit: "kg".to_string(),
                is_stable: true,
                timestamp: Utc::now(),
                mqtt_timestamp: None,
            };
            store.add_weight_reading(entry).await;
        }

        // Get first page (limit 5)
        let page1 = store.get_weight_readings("test-device", Some(5), Some(0), None).await;
        assert_eq!(page1.len(), 5);
        assert_eq!(page1[0].weight, 19.0); // Most recent first

        // Get second page
        let page2 = store.get_weight_readings("test-device", Some(5), Some(5), None).await;
        assert_eq!(page2.len(), 5);
        assert_eq!(page2[0].weight, 14.0);
    }
}
