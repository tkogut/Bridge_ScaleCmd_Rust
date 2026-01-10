// Host and Miernik API functions

import { HostConfig, MiernikConfig } from "@/types/api";

const BRIDGE_URL = (() => {
  const envUrl = (import.meta as any).env?.VITE_BRIDGE_URL || 
                 (import.meta as any).env?.VITE_API_URL;
  if (envUrl) return envUrl;
  return "http://127.0.0.1:8080";
})();

// --- Host Management API ---

export async function getAllHosts(): Promise<Record<string, HostConfig>> {
  const response = await fetch(`${BRIDGE_URL}/api/hosts`);
  if (!response.ok) {
    throw new Error(`Failed to fetch hosts (${response.status})`);
  }
  return response.json();
}

export async function getHost(hostId: string): Promise<HostConfig> {
  const response = await fetch(`${BRIDGE_URL}/api/hosts/${hostId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch host (${response.status})`);
  }
  return response.json();
}

export async function saveHost(hostId: string, config: HostConfig): Promise<void> {
  const response = await fetch(`${BRIDGE_URL}/api/hosts/save`, {
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
  const response = await fetch(`${BRIDGE_URL}/api/hosts/${hostId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to delete host (${response.status})`);
  }
}

// --- Miernik Management API ---

export async function getAllMierniki(): Promise<Record<string, MiernikConfig>> {
  const response = await fetch(`${BRIDGE_URL}/api/mierniki`);
  if (!response.ok) {
    throw new Error(`Failed to fetch mierniki (${response.status})`);
  }
  return response.json();
}

export async function getMiernik(miernikId: string): Promise<MiernikConfig> {
  const response = await fetch(`${BRIDGE_URL}/api/mierniki/${miernikId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch miernik (${response.status})`);
  }
  return response.json();
}

export async function saveMiernik(miernikId: string, config: MiernikConfig): Promise<void> {
  const response = await fetch(`${BRIDGE_URL}/api/mierniki/save`, {
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
  const response = await fetch(`${BRIDGE_URL}/api/mierniki/${miernikId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to delete miernik (${response.status})`);
  }
}

