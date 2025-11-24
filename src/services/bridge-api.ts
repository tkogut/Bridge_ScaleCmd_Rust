import {
  ScaleCommandRequest,
  ScaleCommandResponse,
  DevicesResponse,
  HealthResponse,
  DeviceId,
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