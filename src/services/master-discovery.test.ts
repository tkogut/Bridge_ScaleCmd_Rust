import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getMasterServerUrl,
  setManualMasterIp,
  getManualMasterIp,
  clearManualMasterIp,
  getAutoMasterIp,
  autoDetectMasterIp,
  testMasterConnection,
  getMasterServerConfig,
} from './master-discovery';
import type { ServerInfo } from './master-discovery';

// Mock localStorage properly
let localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => localStorageStore[key] || null,
  setItem: (key: string, value: string) => {
    localStorageStore[key] = value;
  },
  removeItem: (key: string) => {
    delete localStorageStore[key];
  },
  clear: () => {
    localStorageStore = {};
  },
  get length() {
    return Object.keys(localStorageStore).length;
  },
  key: (index: number) => {
    const keys = Object.keys(localStorageStore);
    return keys[index] || null;
  },
};

// Mock window.location
const mockLocation = (hostname: string, port: string = '8080') => {
  Object.defineProperty(window, 'location', {
    value: {
      hostname,
      port,
      origin: `http://${hostname}:${port}`,
      href: `http://${hostname}:${port}/`,
    },
    writable: true,
  });
};

// Mock fetch
let fetchMock: ReturnType<typeof vi.fn>;

describe('master-discovery', () => {
  beforeEach(() => {
    localStorageStore = {};
    vi.clearAllMocks();
    mockLocation('localhost', '8080');
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;
    
    // Replace window.localStorage with our mock
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    localStorageStore = {};
    vi.clearAllMocks();
  });

  describe('getMasterServerUrl', () => {
    it('should return localhost when no configuration is set', () => {
      const url = getMasterServerUrl();
      expect(url).toBe('http://127.0.0.1:8080');
    });

    it('should return manual IP when set', () => {
      setManualMasterIp('192.168.1.100');
      const url = getMasterServerUrl();
      expect(url).toBe('http://192.168.1.100:8080');
    });

    it('should prioritize manual IP over auto-detected', () => {
      // Set auto IP manually in localStorage (since setAutoMasterIp is private)
      localStorageMock.setItem('MASTER_IP_AUTO', '192.168.1.50');
      setManualMasterIp('192.168.1.100');
      const url = getMasterServerUrl();
      expect(url).toBe('http://192.168.1.100:8080');
    });

    it('should use auto-detected IP when manual is not set', () => {
      localStorageMock.setItem('MASTER_IP_AUTO', '192.168.1.50');
      const url = getMasterServerUrl();
      expect(url).toBe('http://192.168.1.50:8080');
    });

    it('should use window.location.hostname when not localhost', () => {
      mockLocation('192.168.1.200', '8080');
      const url = getMasterServerUrl();
      expect(url).toBe('http://192.168.1.200:8080');
    });

    it('should use custom port when set', () => {
      setManualMasterIp('192.168.1.100', 3000);
      const url = getMasterServerUrl();
      expect(url).toBe('http://192.168.1.100:3000');
    });
  });

  describe('manual IP configuration', () => {
    it('should save and retrieve manual IP', () => {
      setManualMasterIp('192.168.1.100');
      const config = getManualMasterIp();
      expect(config.ip).toBe('192.168.1.100');
      expect(config.port).toBe(8080);
    });

    it('should save custom port', () => {
      setManualMasterIp('192.168.1.100', 3000);
      const config = getManualMasterIp();
      expect(config.ip).toBe('192.168.1.100');
      expect(config.port).toBe(3000);
    });

    it('should clear manual IP when set to empty string', () => {
      setManualMasterIp('192.168.1.100');
      setManualMasterIp('');
      const config = getManualMasterIp();
      expect(config.ip).toBeNull();
    });

    it('should clear manual IP when calling clearManualMasterIp', () => {
      setManualMasterIp('192.168.1.100');
      clearManualMasterIp();
      const config = getManualMasterIp();
      expect(config.ip).toBeNull();
    });
  });

  describe('auto-detected IP configuration', () => {
    it('should retrieve auto-detected IP', () => {
      localStorageMock.setItem('MASTER_IP_AUTO', '192.168.1.50');
      const autoIp = getAutoMasterIp();
      expect(autoIp).toBe('192.168.1.50');
    });

    it('should return null when no auto-detected IP is set', () => {
      const autoIp = getAutoMasterIp();
      expect(autoIp).toBeNull();
    });
  });

  describe('testMasterConnection', () => {
    it('should return success when server responds correctly', async () => {
      const mockServerInfo: ServerInfo = {
        hostname: 'COMPUTER-NAME',
        ip_addresses: ['192.168.1.100', '127.0.0.1'],
        port: 8080,
        network_mode: 'lan',
        version: '0.1.5',
      };

      // Mock getServerInfo internal call - first call to /health, then to /api/server/info
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockServerInfo,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockServerInfo,
        });

      setManualMasterIp('192.168.1.100');
      const result = await testMasterConnection();

      expect(result.success).toBe(true);
      expect(result.serverInfo).toEqual(mockServerInfo);
      expect(result.message).toContain('Successfully connected');
    });

    it('should return failure when server does not respond', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => null,
      });

      setManualMasterIp('192.168.1.100');
      const result = await testMasterConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to connect');
    });

    it('should return failure when fetch throws error', async () => {
      // getServerInfo catches errors and returns null, so testMasterConnection returns "Failed to connect"
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      setManualMasterIp('192.168.1.100');
      const result = await testMasterConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to connect');
    });
  });

  describe('autoDetectMasterIp', () => {
    it('should detect server from localhost first', async () => {
      const mockServerInfo: ServerInfo = {
        hostname: 'COMPUTER-NAME',
        ip_addresses: ['192.168.1.100', '127.0.0.1'],
        port: 8080,
        network_mode: 'lan',
        version: '0.1.5',
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockServerInfo,
      });

      const progressCallback = vi.fn();
      const result = await autoDetectMasterIp(progressCallback);

      expect(result).toBe('192.168.1.100');
      expect(getAutoMasterIp()).toBe('192.168.1.100');
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should return null when no server is found', async () => {
      // Mock localhost check - no server
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => null,
      });

      // Mock IP range scan - no servers found (limit to first batch for test)
      for (let i = 0; i < 10; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          json: async () => null,
        });
      }

      const result = await autoDetectMasterIp();
      // Note: This will timeout in real scenario, but we mock it to return null quickly
      expect(result).toBeNull();
    }, 10000); // Longer timeout for this test
  });

  describe('getMasterServerConfig', () => {
    it('should return complete configuration', () => {
      setManualMasterIp('192.168.1.100', 3000);
      localStorageMock.setItem('MASTER_IP_AUTO', '192.168.1.50');

      const config = getMasterServerConfig();

      expect(config.url).toBe('http://192.168.1.100:3000');
      expect(config.manualIp).toBe('192.168.1.100');
      expect(config.autoIp).toBe('192.168.1.50');
      expect(config.port).toBe(3000);
    });

    it('should return default values when nothing is configured', () => {
      const config = getMasterServerConfig();

      expect(config.url).toBe('http://127.0.0.1:8080');
      expect(config.manualIp).toBeNull();
      expect(config.autoIp).toBeNull();
      expect(config.port).toBe(8080);
    });
  });
});
