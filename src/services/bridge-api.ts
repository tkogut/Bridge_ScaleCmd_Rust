import {
  ScaleCommandRequest,
  ScaleCommandResponse,
  DevicesResponse,
  HealthResponse,
  DeviceId,
  DeviceConfig,
} from "@/types/api";
import { mockDb } from "./mock-db";

const BRIDGE_URL = "http://localhost:8080";

/**
 * Wykonuje komendę na wadze.
 */
export async function executeScaleCommand(
  request: ScaleCommandRequest,
): Promise<ScaleCommandResponse> {
  const response = await fetch(`${BRIDGE_URL}/scalecmd`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Pobiera listę skonfigurowanych urządzeń.
 */
export async function getDevices(): Promise<DevicesResponse> {
  // W rzeczywistości: Bridge API zwraca listę urządzeń
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const configs = mockDb.getConfigs();
  const devices: [DeviceId, string, string][] = Object.entries(configs).map(([id, config]) => [
    id,
    config.name,
    config.model,
  ]);

  return {
    success: true,
    devices: devices,
  };
}

/**
 * Sprawdza stan zdrowia usługi Bridge.
 */
export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${BRIDGE_URL}/health`);

  if (!response.ok) {
    // Symulacja błędu połączenia, jeśli Bridge nie działa
    return {
      status: "ERROR",
      service: "ScaleIT Bridge",
      version: "3.1.0",
    };
  }

  return response.json();
}

// --- Konfiguracja Urządzeń (Symulowane API) ---

/**
 * Pobiera szczegółową konfigurację wszystkich urządzeń z symulowanego magazynu.
 */
export async function getAllDeviceConfigs(): Promise<Record<DeviceId, DeviceConfig>> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockDb.getConfigs();
}

/**
 * Dodaje lub aktualizuje konfigurację urządzenia.
 * W rzeczywistości: POST/PUT do Bridge API, które zapisuje do devices.json i przeładowuje konfigurację.
 */
export async function saveDeviceConfig(
  deviceId: DeviceId,
  config: DeviceConfig,
): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 500));
  mockDb.saveConfig(deviceId, config);
}

/**
 * Usuwa konfigurację urządzenia.
 * W rzeczywistości: DELETE do Bridge API, które usuwa z devices.json i przeładowuje konfigurację.
 */
export async function deleteDeviceConfig(deviceId: DeviceId): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 500));
  mockDb.deleteConfig(deviceId);
}