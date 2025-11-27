export type DeviceId = string;

export type Command = "readGross" | "readNet" | "tare" | "zero";

export interface WeightReading {
  gross_weight: number;
  net_weight: number;
  unit: string;
  is_stable: boolean;
  timestamp: string;
}

export interface ScaleCommandRequest {
  device_id: DeviceId;
  command: Command;
}

export interface ScaleCommandResponse {
  success: boolean;
  device_id: DeviceId;
  command: Command;
  result?: WeightReading | { message: string };
  error?: string;
}

export interface DeviceConfig {
  name: string;
  manufacturer: string;
  model: string;
  protocol: string;
  connection: TcpConnection | SerialConnection;
  commands: Record<string, string>;
  enabled: boolean;
}

export interface TcpConnection {
  connection_type: "Tcp";
  host: string;
  port: number;
  timeout_ms: number;
}

export interface SerialConnection {
  connection_type: "Serial";
  port: string;
  baud_rate: number;
  timeout_ms: number;
}

export interface DevicesResponse {
  success: boolean;
  devices: [DeviceId, string, string][]; // [id, name, model]
}

export interface HealthResponse {
  status: "OK" | "ERROR";
  service: string;
  version: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  deviceId: DeviceId;
  command: Command;
  status: "Success" | "Error";
  message: string;
}