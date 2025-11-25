import {
  ScaleCommandRequest,
  ScaleCommandResponse,
  DevicesResponse,
  HealthResponse,
  DeviceId,
  DeviceConfig,
} from "@/types/api";

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
  const response = await fetch(`${BRIDGE_URL}/devices`);
  if (!response.ok) {
    throw new Error(`Failed to fetch devices (${response.status})`);
  }
  return response.json();
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
  const response = await fetch(`${BRIDGE_URL}/api/config`);
  if (!response.ok) {
    throw new Error(`Failed to fetch device configs (${response.status})`);
  }
  return response.json();
}

/**
 * Dodaje lub aktualizuje konfigurację urządzenia.
 * W rzeczywistości: POST/PUT do Bridge API, które zapisuje do devices.json i przeładowuje konfigurację.
 */
export async function saveDeviceConfig(
  deviceId: DeviceId,
  config: DeviceConfig,
): Promise<void> {
  const response = await fetch(`${BRIDGE_URL}/api/config/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ device_id: deviceId, config }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to save configuration (${response.status})`);
  }
}

/**
 * Usuwa konfigurację urządzenia.
 * W rzeczywistości: DELETE do Bridge API, które usuwa z devices.json i przeładowuje konfigurację.
 */
export async function deleteDeviceConfig(deviceId: DeviceId): Promise<void> {
  const response = await fetch(`${BRIDGE_URL}/api/config/${deviceId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to delete configuration (${response.status})`);
  }
}