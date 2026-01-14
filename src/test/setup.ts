/* eslint-disable @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom'
import { expect, afterEach, beforeAll, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock API handlers for testing
export const handlers = [
  // Health check endpoint - handle any host/port
  http.get('*/health', () => {
    return HttpResponse.json({
      status: 'OK',
      service: 'ScaleIT Bridge',
      version: '0.1.0'
    })
  }),

  // Devices list endpoint - handle any host/port
  http.get('*/devices', () => {
    return HttpResponse.json({
      success: true,
      devices: [
        ['C320', 'C320 Rinstrum', 'C320'],
        ['DWF', 'DFW - Dini Argeo', 'DFW']
      ]
    })
  }),

  // Scale command endpoint - handle any host/port
  http.post('*/scalecmd', async ({ request }) => {
    const body = await request.json() as any

    if (body.device_id === 'NONEXISTENT') {
      return HttpResponse.json({
        success: false,
        device_id: body.device_id,
        command: body.command,
        result: null,
        error: 'Device not found: NONEXISTENT'
      }, { status: 404 })
    }

    if (body.device_id === 'DISABLED') {
      return HttpResponse.json({
        success: false,
        device_id: body.device_id,
        command: body.command,
        result: null,
        error: 'Device DISABLED is disabled'
      }, { status: 400 })
    }

    // Mock successful response
    return HttpResponse.json({
      success: true,
      device_id: body.device_id,
      command: body.command,
      result: {
        gross_weight: 42.5,
        net_weight: 40.0,
        unit: 'kg',
        is_stable: true,
        timestamp: new Date().toISOString(),
        tare_weight: 2.5
      },
      error: null
    })
  }),

  // Server info endpoint - handle any host/port
  http.get('*/api/server/info', () => {
    return HttpResponse.json({
      hostname: 'TEST-COMPUTER',
      ip_addresses: ['192.168.1.100', '127.0.0.1'],
      port: 8080,
      network_mode: 'lan',
      version: '0.1.5'
    })
  }),

  // Configuration endpoints - handle any host/port
  http.get('*/api/config', () => {
    return HttpResponse.json({
      'C320': {
        name: 'C320 Rinstrum',
        manufacturer: 'Rinstrum',
        model: 'C320',
        protocol: 'RINCMD',
        connection: {
          connection_type: 'Tcp',
          host: '192.168.1.254',
          port: 4001,
          timeout_ms: 3000
        },
        commands: {
          readGross: '20050026',
          readNet: '20050025',
          tare: '21120008:0C',
          zero: '21120008:0B'
        },
        enabled: true
      },
      'DWF': {
        name: 'DFW - Dini Argeo',
        manufacturer: 'Dini Argeo',
        model: 'DFW',
        protocol: 'DINI_ARGEO',
        connection: {
          connection_type: 'Serial',
          port: '/dev/ttyUSB0',
          baud_rate: 9600,
          timeout_ms: 1000
        },
        commands: {
          readGross: 'READ',
          readNet: 'REXT',
          tare: 'TARE',
          zero: 'ZERO'
        },
        enabled: true
      }
    })
  }),

  http.post('*/api/config/save', () => {
    return HttpResponse.json({
      success: true,
      message: 'Configuration saved successfully.'
    })
  }),

  http.delete('*/api/config/:deviceId', ({ params }) => {
    return HttpResponse.json({
      success: true,
      message: `Device ${params.deviceId} deleted successfully.`
    })
  }),

  // MQTT API handlers
  http.get('*/api/mqtt/status', () => {
    return HttpResponse.json({
      enabled: true,
      connected: true,
      broker_url: 'mqtt://localhost:1883',
      client_id: 'scaleit-bridge',
      topic_prefix: 'scaleit',
      devices_with_history: 2,
      total_weight_readings: 150,
      total_status_updates: 45
    })
  }),

  http.get('*/api/mqtt/devices', () => {
    return HttpResponse.json({
      devices: [
        {
          device_id: 'c320tcp',
          weight_readings_count: 100,
          status_updates_count: 30,
          last_weight_reading: {
            device_id: 'c320tcp',
            weight: 42.5,
            unit: 'kg',
            timestamp: 1705250400,
            is_stable: true,
            recorded_at: '2026-01-14T12:00:00Z'
          },
          last_status_update: {
            device_id: 'c320tcp',
            status: 'connected',
            timestamp: 1705250400,
            recorded_at: '2026-01-14T12:00:00Z'
          }
        },
        {
          device_id: 'dini01',
          weight_readings_count: 50,
          status_updates_count: 15,
          last_weight_reading: {
            device_id: 'dini01',
            weight: 125.3,
            unit: 'kg',
            timestamp: 1705250300,
            is_stable: true,
            recorded_at: '2026-01-14T11:58:20Z'
          },
          last_status_update: null
        }
      ],
      total_count: 2
    })
  }),

  http.get('*/api/mqtt/history/:deviceId', ({ params }) => {
    const deviceId = params.deviceId as string
    return HttpResponse.json({
      device_id: deviceId,
      weight_readings: [
        {
          device_id: deviceId,
          weight: 42.5,
          unit: 'kg',
          timestamp: 1705250400,
          is_stable: true,
          recorded_at: '2026-01-14T12:00:00Z'
        },
        {
          device_id: deviceId,
          weight: 41.2,
          unit: 'kg',
          timestamp: 1705250340,
          is_stable: true,
          recorded_at: '2026-01-14T11:59:00Z'
        }
      ],
      status_updates: [
        {
          device_id: deviceId,
          status: 'connected',
          timestamp: 1705250400,
          recorded_at: '2026-01-14T12:00:00Z'
        }
      ],
      total_weight_readings: 100,
      total_status_updates: 30
    })
  }),

  http.get('*/api/mqtt/history/:deviceId/latest', ({ params }) => {
    const deviceId = params.deviceId as string
    return HttpResponse.json({
      device_id: deviceId,
      latest_weight: {
        device_id: deviceId,
        weight: 42.5,
        unit: 'kg',
        timestamp: 1705250400,
        is_stable: true,
        recorded_at: '2026-01-14T12:00:00Z'
      },
      latest_status: {
        device_id: deviceId,
        status: 'connected',
        timestamp: 1705250400,
        recorded_at: '2026-01-14T12:00:00Z'
      }
    })
  }),

  http.get('*/api/mqtt/history/:deviceId/status', ({ params }) => {
    const deviceId = params.deviceId as string
    return HttpResponse.json({
      device_id: deviceId,
      status_updates: [
        {
          device_id: deviceId,
          status: 'connected',
          timestamp: 1705250400,
          recorded_at: '2026-01-14T12:00:00Z'
        },
        {
          device_id: deviceId,
          status: 'disconnected',
          timestamp: 1705250000,
          recorded_at: '2026-01-14T11:53:20Z'
        }
      ],
      total_count: 30
    })
  }),

  http.get('*/api/mqtt/history/:deviceId/stats', ({ params }) => {
    const deviceId = params.deviceId as string
    return HttpResponse.json({
      device_id: deviceId,
      weight_readings_count: 100,
      status_updates_count: 30,
      first_weight_reading: '2026-01-14T10:00:00Z',
      last_weight_reading: '2026-01-14T12:00:00Z',
      first_status_update: '2026-01-14T10:00:00Z',
      last_status_update: '2026-01-14T12:00:00Z'
    })
  }),

  http.delete('*/api/mqtt/history/:deviceId', ({ params }) => {
    const deviceId = params.deviceId as string
    return HttpResponse.json({
      success: true,
      message: `History for device ${deviceId} deleted successfully`
    })
  })
]

// Setup MSW server
export const server = setupServer(...handlers)

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

// Clean up after each test case
afterEach(() => {
  cleanup()
  server.resetHandlers()
})

// Clean up after all tests
afterAll(() => {
  server.close()
})

// Global test utilities
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock localStorage with proper storage
let localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => {
    return localStorageStore[key] || null;
  },
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
  }
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})

// Mock console.error to reduce noise in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
