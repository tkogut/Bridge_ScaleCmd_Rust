import { api } from "@/utils/api";

export interface ScaleCommand {
  device_id: string;
  command: "readGross" | "readNet" | "tare" | "zero";
}

export interface ScaleResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  protocol: string;
  enabled: boolean;
  status: "connected" | "disconnected" | "unknown";
}

export const scaleService = {
  // Health check endpoint
  healthCheck: async (): Promise<{ status: string; service: string }> => {
    return api.get("/health");
  },
  
  // Send command to scale device
  sendCommand: async (command: ScaleCommand): Promise<ScaleResponse> => {
    return api.post("/scalecmd", command);
  },
  
  // Get list of available devices
  getDevices: async (): Promise<DeviceInfo[]> => {
    const response = await api.get("/devices");
    // Transform the response to match our DeviceInfo interface
    return Object.entries(response.devices || {}).map(([id, device]: [string, any]) => ({
      id,
      name: device.name,
      manufacturer: device.manufacturer,
      model: device.model,
      protocol: device.protocol,
      enabled: device.enabled,
      status: device.status || "unknown"
    }));
  },
  
  // Read gross weight
  readGross: async (deviceId: string): Promise<ScaleResponse> => {
    return scaleService.sendCommand({
      device_id: deviceId,
      command: "readGross"
    });
  },
  
  // Read net weight
  readNet: async (deviceId: string): Promise<ScaleResponse> => {
    return scaleService.sendCommand({
      device_id: deviceId,
      command: "readNet"
    });
  },
  
  // Set tare
  setTare: async (deviceId: string): Promise<ScaleResponse> => {
    return scaleService.sendCommand({
      device_id: deviceId,
      command: "tare"
    });
  },
  
  // Zero scale
  zeroScale: async (deviceId: string): Promise<ScaleResponse> => {
    return scaleService.sendCommand({
      device_id: deviceId,
      command: "zero"
    });
  }
};