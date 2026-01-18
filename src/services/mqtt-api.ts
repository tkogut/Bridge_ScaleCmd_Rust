// MQTT API Service for ScaleIT Bridge
// Provides functions to interact with MQTT history and status endpoints

import { getMasterServerUrl } from "./master-discovery";

// Get the master server URL dynamically
const getBridgeUrl = (): string => {
  const envUrl = import.meta.env.VITE_BRIDGE_URL || import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;

  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin;
    const currentPort = window.location.port;

    if (currentPort === '8080' || currentOrigin.includes(':8080')) {
      return '';
    }
  }

  return getMasterServerUrl();
};

// Types for MQTT API responses

export interface MqttStatus {
  enabled: boolean;
  connected: boolean;
  broker_url: string;
  client_id: string;
  topic_prefix: string;
  devices_with_history: number | null;
  total_weight_readings: number | null;
  total_status_updates: number | null;
}

export interface MqttDeviceInfo {
  device_id: string;
  weight_readings_count: number;
  status_updates_count: number;
  last_weight_reading: WeightReadingEntry | null;
  last_status_update: DeviceStatusEntry | null;
}

export interface WeightReadingEntry {
  device_id: string;
  weight: number;
  unit: string;
  timestamp: number;
  is_stable: boolean;
  recorded_at: string;
}

export interface DeviceStatusEntry {
  device_id: string;
  status: string;
  timestamp: number;
  recorded_at: string;
}

export interface MqttHistoryResponse {
  device_id: string;
  weight_readings: WeightReadingEntry[];
  status_updates: DeviceStatusEntry[];
  total_weight_readings: number;
  total_status_updates: number;
}

export interface MqttLatestResponse {
  device_id: string;
  latest_weight: WeightReadingEntry | null;
  latest_status: DeviceStatusEntry | null;
}

export interface MqttDeviceStatusResponse {
  device_id: string;
  status_updates: DeviceStatusEntry[];
  total_count: number;
}

export interface MqttStatsResponse {
  device_id: string;
  weight_readings_count: number;
  status_updates_count: number;
  first_weight_reading: string | null;
  last_weight_reading: string | null;
  first_status_update: string | null;
  last_status_update: string | null;
}

export interface MqttDevicesResponse {
  devices: MqttDeviceInfo[];
  total_count: number;
}

export interface MqttConfig {
  enabled: boolean;
  broker_url: string;
  client_id: string;
  topic_prefix: string;
  username?: string;
  password?: string;
  qos: number;
  retain: boolean;
}

export interface SendMqttRequest {
  topic: string;
  payload: any;
  qos?: number;
  retain?: boolean;
}

/**
 * Get MQTT system status
 */
export async function getMqttStatus(): Promise<MqttStatus> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/mqtt/status`);

  if (!response.ok) {
    throw new Error(`Failed to fetch MQTT status (${response.status})`);
  }

  return response.json();
}

/**
 * Get all devices with MQTT history
 */
export async function getMqttDevices(): Promise<MqttDevicesResponse> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/mqtt/devices`);

  if (!response.ok) {
    throw new Error(`Failed to fetch MQTT devices (${response.status})`);
  }

  return response.json();
}

/**
 * Get MQTT history for a specific device
 * @param deviceId - Device ID
 * @param limit - Maximum number of entries to return (default: 100)
 * @param offset - Number of entries to skip (default: 0)
 * @param since - Only return entries after this timestamp (optional)
 * @param until - Only return entries before this timestamp (optional)
 */
export async function getMqttHistory(
  deviceId: string,
  options?: {
    limit?: number;
    offset?: number;
    since?: number;
    until?: number;
  }
): Promise<MqttHistoryResponse> {
  const bridgeUrl = getBridgeUrl();
  const params = new URLSearchParams();

  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.since) params.append('since', options.since.toString());
  if (options?.until) params.append('until', options.until.toString());

  const queryString = params.toString();
  const url = `${bridgeUrl}/api/mqtt/history/${encodeURIComponent(deviceId)}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch MQTT history for ${deviceId} (${response.status})`);
  }

  return response.json();
}

/**
 * Get latest MQTT readings for a device
 */
export async function getMqttLatest(deviceId: string): Promise<MqttLatestResponse> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/mqtt/history/${encodeURIComponent(deviceId)}/latest`);

  if (!response.ok) {
    throw new Error(`Failed to fetch latest MQTT data for ${deviceId} (${response.status})`);
  }

  return response.json();
}

/**
 * Get MQTT status updates for a device
 */
export async function getMqttDeviceStatus(
  deviceId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<MqttDeviceStatusResponse> {
  const bridgeUrl = getBridgeUrl();
  const params = new URLSearchParams();

  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());

  const queryString = params.toString();
  const url = `${bridgeUrl}/api/mqtt/history/${encodeURIComponent(deviceId)}/status${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch MQTT status for ${deviceId} (${response.status})`);
  }

  return response.json();
}

/**
 * Get MQTT statistics for a device
 */
export async function getMqttStats(deviceId: string): Promise<MqttStatsResponse> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/mqtt/history/${encodeURIComponent(deviceId)}/stats`);

  if (!response.ok) {
    throw new Error(`Failed to fetch MQTT stats for ${deviceId} (${response.status})`);
  }

  return response.json();
}

/**
 * Delete MQTT history for a device
 */
export async function deleteMqttHistory(deviceId: string): Promise<void> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/mqtt/history/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete MQTT history for ${deviceId} (${response.status})`);
  }
}

/**
 * Get MQTT configuration
 */
export async function getMqttConfig(): Promise<MqttConfig> {
  const bridgeUrl = getBridgeUrl();
  try {
    const response = await fetch(`${bridgeUrl}/api/mqtt/config`);

    if (!response.ok) {
      // If the endpoint doesn't exist yet (404), return default config
      if (response.status === 404) {
        return {
          enabled: false,
          broker_url: "mqtt://localhost:1883",
          client_id: "scaleit-bridge",
          topic_prefix: "scaleit",
          qos: 1,
          retain: false,
        };
      }
      throw new Error(`Failed to fetch MQTT config (${response.status})`);
    }

    return response.json();
  } catch (error) {
    // If network error or endpoint doesn't exist, return default config
    console.warn('MQTT config API not available, using defaults:', error);
    return {
      enabled: false,
      broker_url: "mqtt://localhost:1883",
      client_id: "scaleit-bridge",
      topic_prefix: "scaleit",
      qos: 1,
      retain: false,
    };
  }
}

/**
 * Save MQTT configuration
 */
export async function saveMqttConfig(config: MqttConfig): Promise<{ success: boolean; message: string }> {
  const bridgeUrl = getBridgeUrl();
  try {
    const response = await fetch(`${bridgeUrl}/api/mqtt/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ config }),
    });

    if (!response.ok) {
      // If the endpoint doesn't exist yet (404), show appropriate message
      if (response.status === 404) {
        throw new Error('MQTT configuration API not available. Please rebuild the backend first.');
      }
      throw new Error(`Failed to save MQTT config (${response.status})`);
    }

    return response.json();
  } catch (error) {
    // If network error, provide helpful message
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Please check if the backend is running.');
    }
    throw error;
  }
}

/**
 * Send custom MQTT message
 */
export async function sendMqttCommand(request: SendMqttRequest): Promise<{ success: boolean; message: string }> {
  const bridgeUrl = getBridgeUrl();
  try {
    const response = await fetch(`${bridgeUrl}/api/mqtt/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('MQTT send API not available. Please rebuild the backend first.');
      }
      if (response.status === 503) {
        throw new Error('MQTT is not enabled or not connected');
      }
      throw new Error(`Failed to send MQTT message (${response.status})`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Please check if the backend is running.');
    }
    throw error;
  }
}

/**
 * Run Mosquitto Broker (Windows only)
 */
export async function runMqttBroker(): Promise<{ success: boolean; message: string }> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/mqtt/run-broker`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Failed to run Mosquitto Broker (${response.status})`);
  }
  return response.json();
}

/**
 * Run MQTT Telemetry (mosquitto_sub) in a new window (Windows only)
 */
export async function runMqttSub(): Promise<{ success: boolean; message: string }> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/mqtt/run-sub`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Failed to run MQTT Telemetry (${response.status})`);
  }
  return response.json();
}

// Default export for convenience
export default {
  getMqttStatus,
  getMqttDevices,
  getMqttHistory,
  getMqttLatest,
  getMqttDeviceStatus,
  getMqttStats,
  deleteMqttHistory,
  getMqttConfig,
  saveMqttConfig,
  sendMqttCommand,
  runMqttBroker,
  runMqttSub,
};
