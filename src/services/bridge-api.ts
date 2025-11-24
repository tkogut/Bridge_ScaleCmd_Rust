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
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Sprawdza stan zdrowia usługi Bridge.
 */
export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${BRIDGE_URL}/health`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// --- Konfiguracja Urządzeń (Symulowane API) ---

/**
 * Pobiera szczegółową konfigurację wszystkich urządzeń.
 * W rzeczywistości Bridge API może wymagać osobnego endpointu.
 * Tutaj symulujemy, że Bridge zwraca pełną konfigurację.
 */
export async function getAllDeviceConfigs(): Promise<Record<DeviceId, DeviceConfig>> {
  // Symulacja odpowiedzi z Bridge API
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Zwracamy przykładową konfigurację z devices.json (z backendu Rust)
  return {
    "c320_line1": {
      "name": "C320 - Production Line 1",
      "manufacturer": "Rinstrum",
      "model": "C320",
      "protocol": "RINCMD",
      "connection": {
        "connection_type": "Tcp",
        "host": "192.168.1.254",
        "port": 4001,
        "timeout_ms": 3000
      },
      "commands": {
        "read_gross": "20050026",
        "read_net": "20050025",
        "tare": "21120008:0C",
        "zero": "21120008:0B"
      }
    },
    "dini_argeo_lab": {
      "name": "Dini Argeo - Lab Scale",
      "manufacturer": "Dini Argeo",
      "model": "DGTQ",
      "protocol": "ASCII",
      "connection": {
        "connection_type": "Serial",
        "port": "/dev/ttyUSB0",
        "baud_rate": 9600,
        "timeout_ms": 1000
      },
      "commands": {
        "read_gross": "W",
        "read_net": "N",
        "tare": "T",
        "zero": "Z"
      }
    }
  };
}

/**
 * Dodaje lub aktualizuje konfigurację urządzenia.
 */
export async function saveDeviceConfig(
  deviceId: DeviceId,
  config: DeviceConfig,
): Promise<void> {
  // W rzeczywistości: POST /api/config/add lub PUT /api/config/update
  console.log(`[API] Saving configuration for ${deviceId}:`, config);
  await new Promise(resolve => setTimeout(resolve, 500));
  // Symulacja sukcesu
}

/**
 * Usuwa konfigurację urządzenia.
 */
export async function deleteDeviceConfig(deviceId: DeviceId): Promise<void> {
  // W rzeczywistości: DELETE /api/config/delete/{deviceId}
  console.log(`[API] Deleting configuration for ${deviceId}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  // Symulacja sukcesu
}