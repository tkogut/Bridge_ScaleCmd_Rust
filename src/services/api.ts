// ScaleIT Bridge API Service
// Comprehensive API client for ScaleIT Bridge backend

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";

// Types
export interface ScaleCommandRequest {
  device_id: string;
  command: string;
}

export interface WeightReading {
  gross_weight?: number;
  net_weight?: number;
  unit?: string;
  is_stable?: boolean;
  timestamp?: string;
  status?: string;
  tare_weight?: number;
}

export interface ScaleCommandResponse {
  success: boolean;
  device_id: string;
  command: string;
  result?: WeightReading;
  error?: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

export interface DeviceListResponse {
  success: boolean;
  devices: [string, string, string][]; // [id, name, model]
}

export interface ConnectionConfig {
  connection_type: "Tcp" | "Serial";
  host?: string;
  port?: number;
  baud_rate?: number;
  data_bits?: number;
  stop_bits?: "one" | "two";
  parity?: "none" | "even" | "odd";
  flow_control?: "none" | "software" | "hardware";
}

export interface DeviceConfig {
  name: string;
  manufacturer: string;
  model: string;
  protocol: string;
  connection: ConnectionConfig;
  timeout_ms: number;
  commands: Record<string, string>;
  enabled: boolean;
}

export interface SaveConfigRequest {
  device_id: string;
  config: DeviceConfig;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Error classes
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: Response,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "NetworkError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Utility functions
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new ApiError(
      `HTTP ${response.status}: ${errorText}`,
      response.status,
      response,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new ApiError("Invalid JSON response", response.status, response);
  }
};

const validateRequest = (request: any, requiredFields: string[]) => {
  for (const field of requiredFields) {
    if (
      !request[field] ||
      (typeof request[field] === "string" && request[field].trim() === "")
    ) {
      throw new ValidationError(`Missing required field: ${field}`);
    }
  }
};

const makeRequest = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;

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
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new NetworkError(
        "Network connection failed. Please check your internet connection and ensure the backend service is running.",
      );
    }

    throw new NetworkError(
      `Request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

// API Functions

/**
 * Check the health status of the ScaleIT Bridge service
 */
export const fetchHealthStatus = async (): Promise<HealthResponse> => {
  return makeRequest<HealthResponse>("/health");
};

/**
 * Fetch the list of configured devices
 */
export const fetchDevices = async (): Promise<DeviceListResponse> => {
  const response = await makeRequest<DeviceListResponse>("/devices");

  if (!response.success) {
    throw new ApiError("Failed to fetch devices");
  }

  return response;
};

/**
 * Execute a scale command on a specific device
 */
export const executeScaleCommand = async (
  request: ScaleCommandRequest,
): Promise<ScaleCommandResponse> => {
  validateRequest(request, ["device_id", "command"]);

  const response = await makeRequest<ScaleCommandResponse>("/scalecmd", {
    method: "POST",
    body: JSON.stringify(request),
  });

  return response;
};

/**
 * Fetch device configurations
 */
export const fetchDeviceConfigs = async (): Promise<
  Record<string, DeviceConfig>
> => {
  return makeRequest<Record<string, DeviceConfig>>("/api/config");
};

/**
 * Save device configuration
 */
export const saveDeviceConfig = async (
  deviceId: string,
  config: DeviceConfig,
): Promise<ApiResponse> => {
  validateRequest({ device_id: deviceId }, ["device_id"]);
  validateRequest(config, ["name", "manufacturer", "model", "protocol"]);

  const request: SaveConfigRequest = {
    device_id: deviceId,
    config,
  };

  return makeRequest<ApiResponse>("/api/config/save", {
    method: "POST",
    body: JSON.stringify(request),
  });
};

/**
 * Delete device configuration
 */
export const deleteDeviceConfig = async (
  deviceId: string,
): Promise<ApiResponse> => {
  validateRequest({ device_id: deviceId }, ["device_id"]);

  return makeRequest<ApiResponse>(
    `/api/config/${encodeURIComponent(deviceId)}`,
    {
      method: "DELETE",
    },
  );
};

// Batch operations
/**
 * Execute multiple scale commands in sequence
 */
export const executeMultipleCommands = async (
  requests: ScaleCommandRequest[],
): Promise<ScaleCommandResponse[]> => {
  const results: ScaleCommandResponse[] = [];

  for (const request of requests) {
    try {
      const result = await executeScaleCommand(request);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        device_id: request.device_id,
        command: request.command,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
};

/**
 * Get health status with retry logic
 */
export const fetchHealthStatusWithRetry = async (
  maxRetries: number = 3,
  retryDelay: number = 1000,
): Promise<HealthResponse> => {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchHealthStatus();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");

      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff
      }
    }
  }

  throw lastError!;
};

/**
 * Test device connectivity
 */
export const testDeviceConnectivity = async (
  deviceId: string,
): Promise<{
  connected: boolean;
  error?: string;
  responseTime?: number;
}> => {
  const startTime = Date.now();

  try {
    const response = await executeScaleCommand({
      device_id: deviceId,
      command: "readGross",
    });

    const responseTime = Date.now() - startTime;

    return {
      connected: response.success,
      error: response.error,
      responseTime,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Connection test failed",
      responseTime: Date.now() - startTime,
    };
  }
};

// Configuration validation
export const validateDeviceConfig = (config: DeviceConfig): string[] => {
  const errors: string[] = [];

  if (!config.name || config.name.trim() === "") {
    errors.push("Device name is required");
  }

  if (!config.manufacturer || config.manufacturer.trim() === "") {
    errors.push("Manufacturer is required");
  }

  if (!config.model || config.model.trim() === "") {
    errors.push("Model is required");
  }

  if (!config.protocol || config.protocol.trim() === "") {
    errors.push("Protocol is required");
  }

  if (!config.connection) {
    errors.push("Connection configuration is required");
  } else {
    if (config.connection.connection_type === "Tcp") {
      if (!config.connection.host) {
        errors.push("TCP host is required");
      }
      if (!config.connection.port || config.connection.port <= 0) {
        errors.push("Valid TCP port is required");
      }
    } else if (config.connection.connection_type === "Serial") {
      if (!config.connection.port) {
        errors.push("Serial port is required");
      }
      if (!config.connection.baud_rate || config.connection.baud_rate <= 0) {
        errors.push("Valid baud rate is required");
      }
    }
  }

  if (!config.commands || Object.keys(config.commands).length === 0) {
    errors.push("At least one command mapping is required");
  }

  return errors;
};

// Default export for backward compatibility
export default {
  fetchHealthStatus,
  fetchDevices,
  executeScaleCommand,
  fetchDeviceConfigs,
  saveDeviceConfig,
  deleteDeviceConfig,
  executeMultipleCommands,
  fetchHealthStatusWithRetry,
  testDeviceConnectivity,
  validateDeviceConfig,
  ApiError,
  NetworkError,
  ValidationError,
};
