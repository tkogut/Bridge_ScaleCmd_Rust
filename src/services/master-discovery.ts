// Master Server Discovery Service
// Automatically detects and caches the master server (bridge) IP address
// Supports both automatic detection and manual configuration

const STORAGE_KEY_MANUAL = "MASTER_IP";
const STORAGE_KEY_AUTO = "MASTER_IP_AUTO";
const STORAGE_KEY_PORT = "MASTER_PORT";
const DEFAULT_PORT = 8080;

interface ServerInfo {
  hostname: string;
  ip_addresses: string[];
  port: number;
  network_mode: string;
  version: string;
}

/**
 * Get the master server URL with priority:
 * 1. Manual configuration (localStorage MASTER_IP)
 * 2. Auto-detected IP (localStorage MASTER_IP_AUTO)
 * 3. Current window.location.hostname (if already on master server)
 * 4. Fallback to localhost
 */
export function getMasterServerUrl(): string {
  // Check manual configuration first
  const manualIp = localStorage.getItem(STORAGE_KEY_MANUAL);
  const port = localStorage.getItem(STORAGE_KEY_PORT) || String(DEFAULT_PORT);

  if (manualIp && manualIp.trim()) {
    return `http://${manualIp.trim()}:${port}`;
  }

  // Check auto-detected IP
  const autoIp = localStorage.getItem(STORAGE_KEY_AUTO);
  if (autoIp && autoIp.trim()) {
    return `http://${autoIp.trim()}:${port}`;
  }

  // If we're already accessing via network (not localhost), use current hostname
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const currentPort = window.location.port || String(DEFAULT_PORT);

    // If hostname is not localhost/127.0.0.1, assume we're already on master
    if (
      hostname &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1" &&
      hostname !== "[::1]"
    ) {
      return `http://${hostname}:${currentPort}`;
    }
  }

  // Fallback to localhost
  return `http://127.0.0.1:${port}`;
}

/**
 * Set manual master server IP configuration
 */
export function setManualMasterIp(ip: string, port: number = DEFAULT_PORT): void {
  if (ip && ip.trim()) {
    localStorage.setItem(STORAGE_KEY_MANUAL, ip.trim());
    localStorage.setItem(STORAGE_KEY_PORT, String(port));
  } else {
    localStorage.removeItem(STORAGE_KEY_MANUAL);
  }
}

/**
 * Get manual master server IP configuration
 */
export function getManualMasterIp(): { ip: string | null; port: number } {
  const ip = localStorage.getItem(STORAGE_KEY_MANUAL);
  const port = parseInt(localStorage.getItem(STORAGE_KEY_PORT) || String(DEFAULT_PORT), 10);
  return { ip, port };
}

/**
 * Clear manual master server IP configuration
 */
export function clearManualMasterIp(): void {
  localStorage.removeItem(STORAGE_KEY_MANUAL);
}

/**
 * Set auto-detected master server IP
 */
function setAutoMasterIp(ip: string): void {
  if (ip && ip.trim()) {
    localStorage.setItem(STORAGE_KEY_AUTO, ip.trim());
  }
}

/**
 * Get auto-detected master server IP
 */
export function getAutoMasterIp(): string | null {
  return localStorage.getItem(STORAGE_KEY_AUTO);
}

/**
 * Test connection to a server URL
 */
async function testServerConnection(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${url}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Get server info from a URL
 */
async function getServerInfo(url: string): Promise<ServerInfo | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${url}/api/server/info`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    return null;
  }
}

/**
 * Automatically detect master server IP in local network
 * Tries common IP ranges: 192.168.0.x, 192.168.1.x, 10.0.0.x
 * 
 * @param onProgress Optional callback for progress updates
 * @returns Detected IP address or null if not found
 */
export async function autoDetectMasterIp(
  onProgress?: (progress: { current: number; total: number; ip: string }) => void
): Promise<string | null> {
  const port = localStorage.getItem(STORAGE_KEY_PORT) || String(DEFAULT_PORT);
  const ipRanges: string[] = [];

  // Generate IP ranges to scan
  // 192.168.0.1-254
  for (let i = 1; i <= 254; i++) {
    ipRanges.push(`192.168.0.${i}`);
  }
  // 192.168.1.1-254
  for (let i = 1; i <= 254; i++) {
    ipRanges.push(`192.168.1.${i}`);
  }
  // 10.0.0.1-254
  for (let i = 1; i <= 254; i++) {
    ipRanges.push(`10.0.0.${i}`);
  }

  const total = ipRanges.length;
  let current = 0;

  // Try localhost first (fast path)
  if (onProgress) {
    onProgress({ current: 0, total, ip: "127.0.0.1" });
  }

  const localhostUrl = `http://127.0.0.1:${port}`;
  const serverInfo = await getServerInfo(localhostUrl);
  if (serverInfo) {
    // If we're on the master server, use its IP addresses
    if (serverInfo.ip_addresses && serverInfo.ip_addresses.length > 0) {
      // Find first non-localhost IP
      const nonLocalhostIp = serverInfo.ip_addresses.find(
        (ip) => ip !== "127.0.0.1" && ip !== "localhost"
      );
      if (nonLocalhostIp) {
        setAutoMasterIp(nonLocalhostIp);
        return nonLocalhostIp;
      }
    }
  }

  // Scan IP ranges (with concurrency limit to avoid overwhelming network)
  const CONCURRENT_LIMIT = 10;
  const results: Promise<string | null>[] = [];

  for (let i = 0; i < ipRanges.length; i += CONCURRENT_LIMIT) {
    const batch = ipRanges.slice(i, i + CONCURRENT_LIMIT);

    const batchPromises = batch.map(async (ip) => {
      current++;
      if (onProgress) {
        onProgress({ current, total, ip });
      }

      const url = `http://${ip}:${port}`;
      const serverInfo = await getServerInfo(url);
      
      if (serverInfo) {
        return ip;
      }
      return null;
    });

    const batchResults = await Promise.all(batchPromises);
    const found = batchResults.find((result) => result !== null);

    if (found) {
      setAutoMasterIp(found);
      return found;
    }
  }

  return null;
}

/**
 * Test connection to master server
 */
export async function testMasterConnection(): Promise<{
  success: boolean;
  message: string;
  serverInfo?: ServerInfo;
}> {
  const url = getMasterServerUrl();

  try {
    const serverInfo = await getServerInfo(url);
    if (serverInfo) {
      return {
        success: true,
        message: `Successfully connected to ${url}`,
        serverInfo,
      };
    } else {
      return {
        success: false,
        message: `Failed to connect to ${url}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Connection error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get current master server configuration
 */
export function getMasterServerConfig(): {
  url: string;
  manualIp: string | null;
  autoIp: string | null;
  port: number;
} {
  return {
    url: getMasterServerUrl(),
    manualIp: localStorage.getItem(STORAGE_KEY_MANUAL),
    autoIp: localStorage.getItem(STORAGE_KEY_AUTO),
    port: parseInt(
      localStorage.getItem(STORAGE_KEY_PORT) || String(DEFAULT_PORT),
      10
    ),
  };
}
