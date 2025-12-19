import {
  ScaleCommandRequest,
  ScaleCommandResponse,
  DevicesResponse,
  HealthResponse,
  DeviceId,
  DeviceConfig,
} from "@/types/api";

// Use IP address or environment variable to avoid ERR_BLOCKED_BY_CLIENT
// when accessing from Vercel (HTTPS) or other external sources
// For local development: use 127.0.0.1 or localhost
// For Vercel/external: use your computer's IP (e.g., http://192.168.1.100:8080)
// Set VITE_BRIDGE_URL environment variable in Vercel to override
const getBridgeUrl = () => {
  // Try environment variable first (for Vercel deployment)
  const envUrl = (import.meta as any).env?.VITE_BRIDGE_URL || 
                 (import.meta as any).env?.VITE_API_URL;
  if (envUrl) return envUrl;
  
  // Use 127.0.0.1 instead of localhost to avoid some browser blocking issues
  // For Vercel/external access, set VITE_BRIDGE_URL=http://YOUR_IP:8080
  // Your IP addresses: 192.168.1.100 or 192.168.1.50
  return "http://127.0.0.1:8080";
};

const BRIDGE_URL = getBridgeUrl();

/**
 * Wykonuje komendę na wadze.
 */
export async function executeScaleCommand(
  request: ScaleCommandRequest,
): Promise<ScaleCommandResponse> {
  // Create AbortController for timeout (30 seconds total timeout)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${BRIDGE_URL}/scalecmd`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response body first to get error details
    let responseData: ScaleCommandResponse;
    try {
      responseData = await response.json();
    } catch (parseError) {
      // If JSON parsing fails, create error response
      responseData = {
        success: false,
        device_id: request.device_id,
        command: request.command,
        result: null,
        error: `Failed to parse response (status: ${response.status})`,
      };
    }

    if (!response.ok) {
      // If response has error details, use them
      const errorMessage = responseData.error || 
                           (typeof responseData.result === 'object' && responseData.result !== null && 'message' in responseData.result 
                             ? (responseData.result as { message: string }).message 
                             : null) ||
                           `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    return responseData;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Bridge did not respond within 30 seconds');
      }
      throw error;
    }
    throw new Error(`Unknown error: ${String(error)}`);
  }
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
  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${BRIDGE_URL}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Server responded but with error status
      return {
        status: "ERROR",
        service: "ScaleIT Bridge",
        version: "N/A",
      };
    }

    return response.json();
  } catch (error) {
    // Network error or timeout - server is likely stopped or blocked
    if (
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError") ||
        error.message.includes("Network request failed") ||
        error.message.includes("ERR_BLOCKED_BY_CLIENT") ||
        error.message.includes("ERR_CONNECTION_REFUSED"))
    ) {
      // Check if it's a Mixed Content issue (HTTPS trying to connect to HTTP)
      const isMixedContent = window.location.protocol === "https:" && 
                            (error.message.includes("Failed to fetch") || 
                             error.message.includes("ERR_BLOCKED_BY_CLIENT"));
      
      return {
        status: isMixedContent ? "BLOCKED" : "STOPPED",
        service: "ScaleIT Bridge",
        version: "N/A",
      };
    }
    // Other errors
    return {
      status: "ERROR",
      service: "ScaleIT Bridge",
      version: "N/A",
    };
  }
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
  try {
    const response = await fetch(`${BRIDGE_URL}/api/config/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_id: deviceId, config }),
    });

    if (!response.ok) {
      let errorMessage = `Failed to save configuration (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // If JSON parsing fails, try text
        const text = await response.text();
        if (text) {
          errorMessage = text;
        }
      }
      throw new Error(errorMessage);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Network error: ${String(error)}`);
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

/**
 * Zatrzymuje serwer Bridge (graceful shutdown).
 */
export async function shutdownServer(): Promise<void> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/shutdown`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Failed to shutdown server (${response.status})`);
    }

    // Server will shutdown, so we don't wait for response
    // Give it a moment to process
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    // If server is already shutting down, connection will fail
    // This is expected, so we don't throw
    if (error instanceof Error && !error.message.includes("Failed to fetch")) {
      throw error;
    }
  }
}

/**
 * Uruchamia serwer Bridge (tylko jeśli serwer już działa - paradoks, ale próbuje uruchomić w tle).
 * Uwaga: Jeśli serwer jest zatrzymany, ten endpoint nie zadziała. Użyj ręcznego uruchomienia.
 */
export async function startServer(): Promise<void> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      let errorMessage = `Failed to start server (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        const text = await response.text();
        if (text) {
          errorMessage = text;
        }
      }
      throw new Error(errorMessage);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Network error: ${String(error)}`);
  }
}