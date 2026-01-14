// MQTT API Service
// Client-side API for MQTT configuration and monitoring

import { getMasterServerUrl } from "./master-discovery";

// Get the master server URL dynamically
const getBridgeUrl = (): string => {
  // Try environment variable first
  const envUrl = import.meta.env.VITE_BRIDGE_URL || import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  
  // If frontend is served from the same origin, use relative URL
  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin;
    const currentPort = window.location.port;
    
    // If we're on port 8080, use relative URL
    if (currentPort === '8080' || currentOrigin.includes(':8080')) {
      return '';
    }
  }
  
  // Use master discovery
  return getMasterServerUrl();
};

// MQTT Configuration Types
export interface MqttConfig {
  enabled: boolean;
  broker_url: string;
  client_id: string;
  topic_prefix: string;
  username?: string;
  password?: string;
  qos: number; // 0, 1, or 2
  retain: boolean;
}

export interface MqttStatus {
  connected: boolean;
  publisher_status: 'connected' | 'disconnected' | 'error';
  subscriber_status: 'connected' | 'disconnected' | 'error';
  last_connection?: string; // ISO timestamp
  error?: string;
}

export interface MqttMessage {
  topic: string;
  payload: string;
  timestamp: number;
  qos: number;
  retain: boolean;
}

export interface MqttWeightMessage {
  device_id: string;
  weight: number;
  unit: string;
  timestamp: number;
  is_stable: boolean;
}

export interface MqttCommandRequest {
  device_id: string;
  command: string;
  parameters?: Record<string, unknown>;
}

export interface MqttApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Error classes
export class MqttApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: Response,
  ) {
    super(message);
    this.name = "MqttApiError";
  }
}

export class MqttNetworkError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "MqttNetworkError";
  }
}

// Utility function to handle responses
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new MqttApiError(
      `HTTP ${response.status}: ${errorText}`,
      response.status,
      response,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new MqttApiError("Invalid JSON response", response.status, response);
  }
};

// Generic request function
const makeRequest = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  const baseUrl = getBridgeUrl();
  const url = `${baseUrl}${endpoint}`;

  const defaultOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);
    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof MqttApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new MqttNetworkError(
        "Network connection failed. Please check your internet connection and ensure the backend service is running.",
      );
    }

    throw new MqttNetworkError(
      `Request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Get MQTT configuration from the backend
 */
export const getMqttConfig = async (): Promise<MqttConfig> => {
  return makeRequest<MqttConfig>("/api/mqtt/config");
};

/**
 * Update MQTT configuration
 */
export const updateMqttConfig = async (
  config: Partial<MqttConfig>,
): Promise<MqttApiResponse> => {
  return makeRequest<MqttApiResponse>("/api/mqtt/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
};

/**
 * Get MQTT connection status
 */
export const getMqttStatus = async (): Promise<MqttStatus> => {
  return makeRequest<MqttStatus>("/api/mqtt/status");
};

/**
 * Publish a test message to MQTT
 */
export const publishTestMessage = async (
  topic: string,
  payload: string,
): Promise<MqttApiResponse> => {
  return makeRequest<MqttApiResponse>("/api/mqtt/publish", {
    method: "POST",
    body: JSON.stringify({ topic, payload }),
  });
};

/**
 * Subscribe to MQTT topic (for testing)
 */
export const subscribeTopic = async (
  topic: string,
): Promise<MqttApiResponse> => {
  return makeRequest<MqttApiResponse>("/api/mqtt/subscribe", {
    method: "POST",
    body: JSON.stringify({ topic }),
  });
};

/**
 * Unsubscribe from MQTT topic
 */
export const unsubscribeTopic = async (
  topic: string,
): Promise<MqttApiResponse> => {
  return makeRequest<MqttApiResponse>("/api/mqtt/unsubscribe", {
    method: "POST",
    body: JSON.stringify({ topic }),
  });
};

/**
 * Get recent MQTT messages (for debugging)
 */
export const getRecentMessages = async (
  limit: number = 50,
): Promise<MqttMessage[]> => {
  return makeRequest<MqttMessage[]>(`/api/mqtt/messages?limit=${limit}`);
};

/**
 * Send MQTT command to device
 */
export const sendMqttCommand = async (
  command: MqttCommandRequest,
): Promise<MqttApiResponse> => {
  return makeRequest<MqttApiResponse>("/api/mqtt/command", {
    method: "POST",
    body: JSON.stringify(command),
  });
};

/**
 * Test MQTT broker connectivity
 */
export const testMqttConnection = async (): Promise<{
  connected: boolean;
  broker_url: string;
  error?: string;
  response_time?: number;
}> => {
  const startTime = Date.now();

  try {
    const status = await getMqttStatus();
    const responseTime = Date.now() - startTime;

    return {
      connected: status.connected,
      broker_url: "", // Backend will provide this
      response_time: responseTime,
    };
  } catch (error) {
    return {
      connected: false,
      broker_url: "",
      error: error instanceof Error ? error.message : "Connection test failed",
      response_time: Date.now() - startTime,
    };
  }
};

/**
 * Validate MQTT configuration
 */
export const validateMqttConfig = (config: Partial<MqttConfig>): string[] => {
  const errors: string[] = [];

  if (config.enabled && !config.broker_url) {
    errors.push("Broker URL is required when MQTT is enabled");
  }

  if (config.broker_url && !isValidBrokerUrl(config.broker_url)) {
    errors.push("Invalid broker URL format. Expected: mqtt://host:port or mqtts://host:port");
  }

  if (config.qos !== undefined && (config.qos < 0 || config.qos > 2)) {
    errors.push("QoS must be 0, 1, or 2");
  }

  if (config.client_id && config.client_id.length > 128) {
    errors.push("Client ID must be less than 128 characters");
  }

  if (config.username && !config.password) {
    errors.push("Password is required when username is provided");
  }

  return errors;
};

/**
 * Validate MQTT broker URL format
 */
export const isValidBrokerUrl = (url: string): boolean => {
  const mqttPattern = /^(mqtt|mqtts|tcp|ssl):\/\/.+/i;
  return mqttPattern.test(url);
};

/**
 * Parse broker URL to extract host and port
 */
export const parseBrokerUrl = (
  url: string,
): { protocol: string; host: string; port: number } | null => {
  try {
    const match = url.match(/^(mqtt|mqtts|tcp|ssl):\/\/([^:]+)(?::(\d+))?/i);
    if (!match) return null;

    const protocol = match[1].toLowerCase();
    const host = match[2];
    const port = match[3] ? parseInt(match[3], 10) : (protocol === 'mqtts' || protocol === 'ssl' ? 8883 : 1883);

    return { protocol, host, port };
  } catch {
    return null;
  }
};

/**
 * Format MQTT topic with device ID
 */
export const formatTopic = (
  prefix: string,
  type: 'weight' | 'status' | 'command',
  deviceId: string,
): string => {
  return `${prefix}/${type}/${deviceId}`;
};

/**
 * Parse weight message from MQTT payload
 */
export const parseWeightMessage = (payload: string): MqttWeightMessage | null => {
  try {
    const data = JSON.parse(payload);
    
    // Validate required fields
    if (!data.device_id || typeof data.weight !== 'number' || !data.unit) {
      return null;
    }

    return {
      device_id: data.device_id,
      weight: data.weight,
      unit: data.unit,
      timestamp: data.timestamp || Date.now(),
      is_stable: data.is_stable ?? false,
    };
  } catch {
    return null;
  }
};

// Default export
export default {
  getMqttConfig,
  updateMqttConfig,
  getMqttStatus,
  publishTestMessage,
  subscribeTopic,
  unsubscribeTopic,
  getRecentMessages,
  sendMqttCommand,
  testMqttConnection,
  validateMqttConfig,
  isValidBrokerUrl,
  parseBrokerUrl,
  formatTopic,
  parseWeightMessage,
  MqttApiError,
  MqttNetworkError,
};
