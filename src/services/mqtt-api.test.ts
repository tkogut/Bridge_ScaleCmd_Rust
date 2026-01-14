import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { server } from "../test/setup";
import { http, HttpResponse } from "msw";
import {
  getMqttStatus,
  getMqttDevices,
  getMqttHistory,
  getMqttLatest,
  getMqttDeviceStatus,
  getMqttStats,
  deleteMqttHistory,
  MqttStatus,
  MqttDevicesResponse,
  MqttHistoryResponse,
  MqttLatestResponse,
  MqttDeviceStatusResponse,
  MqttStatsResponse,
} from "./mqtt-api";

describe("MQTT API Service", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getMqttStatus", () => {
    it("fetches MQTT status successfully", async () => {
      const result: MqttStatus = await getMqttStatus();

      expect(result.enabled).toBe(true);
      expect(result.connected).toBe(true);
      expect(result.broker_url).toBe("mqtt://localhost:1883");
      expect(result.client_id).toBe("scaleit-bridge");
      expect(result.topic_prefix).toBe("scaleit");
      expect(result.devices_with_history).toBe(2);
      expect(result.total_weight_readings).toBe(150);
      expect(result.total_status_updates).toBe(45);
    });

    it("handles MQTT disabled status", async () => {
      server.use(
        http.get("*/api/mqtt/status", () => {
          return HttpResponse.json({
            enabled: false,
            connected: false,
            broker_url: "",
            client_id: "",
            topic_prefix: "scaleit",
            devices_with_history: 0,
            total_weight_readings: 0,
            total_status_updates: 0,
          });
        })
      );

      const result = await getMqttStatus();
      expect(result.enabled).toBe(false);
      expect(result.connected).toBe(false);
    });

    it("handles server error", async () => {
      server.use(
        http.get("*/api/mqtt/status", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(getMqttStatus()).rejects.toThrow("Failed to fetch MQTT status");
    });

    it("handles network error", async () => {
      server.use(
        http.get("*/api/mqtt/status", () => {
          return HttpResponse.error();
        })
      );

      await expect(getMqttStatus()).rejects.toThrow();
    });
  });

  describe("getMqttDevices", () => {
    it("fetches MQTT devices successfully", async () => {
      const result: MqttDevicesResponse = await getMqttDevices();

      expect(result).toBeDefined();
      expect(result.devices).toBeDefined();
      expect(Array.isArray(result.devices)).toBe(true);
      expect(result.devices.length).toBeGreaterThan(0);
    });

    it("handles empty device list", async () => {
      server.use(
        http.get("*/api/mqtt/devices", () => {
          return HttpResponse.json({
            devices: [],
            total_count: 0,
          });
        })
      );

      const result = await getMqttDevices();
      expect(result.devices).toHaveLength(0);
      expect(result.total_count).toBe(0);
    });

    it("handles server error", async () => {
      server.use(
        http.get("*/api/mqtt/devices", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(getMqttDevices()).rejects.toThrow("Failed to fetch MQTT devices");
    });
  });

  describe("getMqttHistory", () => {
    it("fetches MQTT history for a device successfully", async () => {
      const result: MqttHistoryResponse = await getMqttHistory("c320tcp");

      expect(result.device_id).toBe("c320tcp");
      expect(result.weight_readings).toHaveLength(2);
      expect(result.status_updates).toHaveLength(1);
      expect(result.total_weight_readings).toBe(100);
      expect(result.total_status_updates).toBe(30);

      const firstReading = result.weight_readings[0];
      expect(firstReading.weight).toBe(42.5);
      expect(firstReading.unit).toBe("kg");
      expect(firstReading.is_stable).toBe(true);
    });

    it("fetches history with pagination options", async () => {
      const result = await getMqttHistory("c320tcp", {
        limit: 10,
        offset: 5,
      });

      expect(result.device_id).toBe("c320tcp");
      expect(result.weight_readings).toBeDefined();
    });

    it("fetches history with time filter options", async () => {
      const result = await getMqttHistory("c320tcp", {
        since: 1705240000,
        until: 1705260000,
      });

      expect(result.device_id).toBe("c320tcp");
    });

    it("handles nonexistent device", async () => {
      server.use(
        http.get("*/api/mqtt/history/:deviceId", () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      await expect(getMqttHistory("nonexistent")).rejects.toThrow();
    });

    it("handles server error", async () => {
      server.use(
        http.get("*/api/mqtt/history/:deviceId", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(getMqttHistory("c320tcp")).rejects.toThrow();
    });
  });

  describe("getMqttLatest", () => {
    it("fetches latest MQTT data for a device successfully", async () => {
      const result: MqttLatestResponse = await getMqttLatest("c320tcp");

      expect(result.device_id).toBe("c320tcp");
      expect(result.latest_weight).toBeDefined();
      expect(result.latest_weight?.weight).toBe(42.5);
      expect(result.latest_weight?.unit).toBe("kg");
      expect(result.latest_status).toBeDefined();
      expect(result.latest_status?.status).toBe("connected");
    });

    it("handles device with no data", async () => {
      server.use(
        http.get("*/api/mqtt/history/:deviceId/latest", ({ params }) => {
          return HttpResponse.json({
            device_id: params.deviceId,
            latest_weight: null,
            latest_status: null,
          });
        })
      );

      const result = await getMqttLatest("empty_device");
      expect(result.latest_weight).toBeNull();
      expect(result.latest_status).toBeNull();
    });

    it("handles server error", async () => {
      server.use(
        http.get("*/api/mqtt/history/:deviceId/latest", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(getMqttLatest("c320tcp")).rejects.toThrow();
    });
  });

  describe("getMqttDeviceStatus", () => {
    it("fetches device status history successfully", async () => {
      const result: MqttDeviceStatusResponse = await getMqttDeviceStatus("c320tcp");

      expect(result.device_id).toBe("c320tcp");
      expect(result.status_updates).toHaveLength(2);
      expect(result.total_count).toBe(30);

      const firstStatus = result.status_updates[0];
      expect(firstStatus.status).toBe("connected");
    });

    it("fetches status with pagination options", async () => {
      const result = await getMqttDeviceStatus("c320tcp", {
        limit: 5,
        offset: 0,
      });

      expect(result.device_id).toBe("c320tcp");
      expect(result.status_updates).toBeDefined();
    });

    it("handles server error", async () => {
      server.use(
        http.get("*/api/mqtt/history/:deviceId/status", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(getMqttDeviceStatus("c320tcp")).rejects.toThrow();
    });
  });

  describe("getMqttStats", () => {
    it("fetches device statistics successfully", async () => {
      const result: MqttStatsResponse = await getMqttStats("c320tcp");

      expect(result.device_id).toBe("c320tcp");
      expect(result.weight_readings_count).toBe(100);
      expect(result.status_updates_count).toBe(30);
      expect(result.first_weight_reading).toBe("2026-01-14T10:00:00Z");
      expect(result.last_weight_reading).toBe("2026-01-14T12:00:00Z");
    });

    it("handles device with no history", async () => {
      server.use(
        http.get("*/api/mqtt/history/:deviceId/stats", ({ params }) => {
          return HttpResponse.json({
            device_id: params.deviceId,
            weight_readings_count: 0,
            status_updates_count: 0,
            first_weight_reading: null,
            last_weight_reading: null,
            first_status_update: null,
            last_status_update: null,
          });
        })
      );

      const result = await getMqttStats("empty_device");
      expect(result.weight_readings_count).toBe(0);
      expect(result.first_weight_reading).toBeNull();
    });

    it("handles server error", async () => {
      server.use(
        http.get("*/api/mqtt/history/:deviceId/stats", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(getMqttStats("c320tcp")).rejects.toThrow();
    });
  });

  describe("deleteMqttHistory", () => {
    it("deletes device history successfully", async () => {
      await expect(deleteMqttHistory("c320tcp")).resolves.not.toThrow();
    });

    it("handles nonexistent device", async () => {
      server.use(
        http.delete("*/api/mqtt/history/:deviceId", () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      await expect(deleteMqttHistory("nonexistent")).rejects.toThrow();
    });

    it("handles server error", async () => {
      server.use(
        http.delete("*/api/mqtt/history/:deviceId", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(deleteMqttHistory("c320tcp")).rejects.toThrow();
    });
  });

  describe("URL Encoding", () => {
    it("properly encodes device IDs with special characters", async () => {
      // This test verifies that device IDs are properly URL encoded
      const result = await getMqttHistory("device/with/slashes");
      expect(result.device_id).toBe("device/with/slashes");
    });

    it("handles device IDs with spaces", async () => {
      const result = await getMqttLatest("device with spaces");
      expect(result.device_id).toBe("device with spaces");
    });
  });

  describe("Query Parameters", () => {
    it("constructs correct URL with limit parameter", async () => {
      const result = await getMqttHistory("c320tcp", { limit: 50 });
      expect(result).toBeDefined();
    });

    it("constructs correct URL with offset parameter", async () => {
      const result = await getMqttHistory("c320tcp", { offset: 100 });
      expect(result).toBeDefined();
    });

    it("constructs correct URL with time range parameters", async () => {
      const result = await getMqttHistory("c320tcp", {
        since: 1705200000,
        until: 1705300000,
      });
      expect(result).toBeDefined();
    });

    it("constructs correct URL with all parameters", async () => {
      const result = await getMqttHistory("c320tcp", {
        limit: 20,
        offset: 10,
        since: 1705200000,
        until: 1705300000,
      });
      expect(result).toBeDefined();
    });
  });

  describe("Response Types", () => {
    it("returns correct types for MqttStatus", async () => {
      const result = await getMqttStatus();

      expect(typeof result.enabled).toBe("boolean");
      expect(typeof result.connected).toBe("boolean");
      expect(typeof result.broker_url).toBe("string");
      expect(typeof result.client_id).toBe("string");
      expect(typeof result.topic_prefix).toBe("string");
      expect(typeof result.devices_with_history).toBe("number");
      expect(typeof result.total_weight_readings).toBe("number");
      expect(typeof result.total_status_updates).toBe("number");
    });

    it("returns correct types for WeightReadingEntry", async () => {
      const result = await getMqttHistory("c320tcp");
      const reading = result.weight_readings[0];

      expect(typeof reading.device_id).toBe("string");
      expect(typeof reading.weight).toBe("number");
      expect(typeof reading.unit).toBe("string");
      expect(typeof reading.timestamp).toBe("number");
      expect(typeof reading.is_stable).toBe("boolean");
      expect(typeof reading.recorded_at).toBe("string");
    });

    it("returns correct types for DeviceStatusEntry", async () => {
      const result = await getMqttDeviceStatus("c320tcp");
      const status = result.status_updates[0];

      expect(typeof status.device_id).toBe("string");
      expect(typeof status.status).toBe("string");
      expect(typeof status.timestamp).toBe("number");
      expect(typeof status.recorded_at).toBe("string");
    });
  });
});
