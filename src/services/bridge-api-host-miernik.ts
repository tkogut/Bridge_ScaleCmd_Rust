// Host and Miernik API functions

import { HostConfig, MiernikConfig } from "@/types/api";
import { getMasterServerUrl } from "./master-discovery";

const getBridgeUrl = (): string => {
  // Try environment variable first (for Vercel deployment)
  const envUrl = import.meta.env.VITE_BRIDGE_URL || import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  
  // If frontend is served from the same origin (backend on port 8080), use relative URL
  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin;
    const currentPort = window.location.port;
    
    // If we're on port 8080, use relative URL (same origin)
    if (currentPort === '8080' || currentOrigin.includes(':8080')) {
      return ''; // Relative URL - same origin, no CORS needed
    }
  }
  
  // Use master discovery to get the configured server URL
  return getMasterServerUrl();
};

// --- Host Management API ---

export async function getAllHosts(): Promise<Record<string, HostConfig>> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/hosts`);
  if (!response.ok) {
    throw new Error(`Failed to fetch hosts (${response.status})`);
  }
  return response.json();
}

export async function getHost(hostId: string): Promise<HostConfig> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/hosts/${hostId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch host (${response.status})`);
  }
  return response.json();
}

export async function saveHost(hostId: string, config: HostConfig): Promise<void> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/hosts/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ host_id: hostId, config }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save host (${response.status})`);
  }
}

export async function deleteHost(hostId: string): Promise<void> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/hosts/${hostId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to delete host (${response.status})`);
  }
}

// --- Miernik Management API ---

export async function getAllMierniki(): Promise<Record<string, MiernikConfig>> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/mierniki`);
  if (!response.ok) {
    throw new Error(`Failed to fetch mierniki (${response.status})`);
  }
  return response.json();
}

export async function getMiernik(miernikId: string): Promise<MiernikConfig> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/mierniki/${miernikId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch miernik (${response.status})`);
  }
  return response.json();
}

export async function saveMiernik(miernikId: string, config: MiernikConfig): Promise<void> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/mierniki/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ miernik_id: miernikId, config }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save miernik (${response.status})`);
  }
}

export async function deleteMiernik(miernikId: string): Promise<void> {
  const bridgeUrl = getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/api/mierniki/${miernikId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to delete miernik (${response.status})`);
  }
}

