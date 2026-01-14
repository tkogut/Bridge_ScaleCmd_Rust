/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { server } from "../test/setup";
import { http, HttpResponse } from "msw";
import {
  getMqttConfig,
  updateMqttConfig,
  getMqttStatus,
  publishTestMessage,
  subscribeTopic,
  unsubscribeTopic,
  getRecentMessages,
  sendMqttCommand,
  testMqttConnection,
  validateMqttConfig,
  isValidBrokerUrl,
  parseBrokerUrl,
  formatTopic,
  parseWeightMessage,
  MqttApiError,
  MqttNetworkError,
  MqttConfig,
  MqttStatus,
  MqttMessage,
  MqttCommandRequest,
} from "./mqtt-api";

describe("MQTT API Service", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getMqttConfig", () => {
    it("fetches MQTT configuration successfully", async () => {
      const mockConfig: MqttConfig = {
        enabled: true,
        broker_url: "mqtt://localhost:1883",
        client_id: "scaleit-bridge",
        topic_prefix: "scaleit",
        username: "test_user",
        password: "test_pass",
        qos: 1,
        retain: false,
      };

      server.use(
        http.get("http://localhost:8080/api/mqtt/config", () => {
          return HttpResponse.json(mockConfig);
        }),
      );

      const result = await getMqttConfig();

      expect(result).toEqual(mockConfig);
      expect(result.enabled).toBe(true);
      expect(result.broker_url).toBe("mqtt://localhost:1883");
    });

    it("handles config fetch error", async () => {
      server.use(
        http.get("http://localhost:8080/api/mqtt/config", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      await expect(getMqttConfig()).rejects.toThrow(MqttApiError);
    });

    it("handles network error", async () => {
      server.use(
        http.get("http://localhost:8080/api/mqtt/config", () => {
          return HttpResponse.error();
        }),
      );

      await expect(getMqttConfig()).rejects.toThrow(MqttNetworkError);
    });
  });

  describe("updateMqttConfig", () => {
    it("updates MQTT configuration successfully", async () => {
      const configUpdate: Partial<MqttConfig> = {
        enabled: true,
        broker_url: "mqtt://192.168.1.100:1883",
      };

      server.use(
        http.put("http://localhost:8080/api/mqtt/config", () => {
          return HttpResponse.json({
            success: true,
            message: "Configuration updated successfully",
          });
        }),
      );

      const result = await updateMqttConfig(configUpdate);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Configuration updated successfully");
    });

    it("handles update failure", async () => {
      server.use(
        http.put("http://localhost:8080/api/mqtt/config", () => {
          return HttpResponse.json(
            { success: false, error: "Invalid configuration" },
            { status: 400 },
          );
        }),
      );

      await expect(updateMqttConfig({ enabled: true })).rejects.toThrow(
        MqttApiError,
      );
    });
  });

  describe("getMqttStatus", () => {
    it("fetches MQTT status successfully", async () => {
      const mockStatus: MqttStatus = {
        connected: true,
        publisher_status: "connected",
        subscriber_status: "connected",
        last_connection: "2026-01-14T12:00:00Z",
      };

      server.use(
        http.get("http://localhost:8080/api/mqtt/status", () => {
          return HttpResponse.json(mockStatus);
        }),
      );

      const result = await getMqttStatus();

      expect(result.connected).toBe(true);
      expect(result.publisher_status).toBe("connected");
      expect(result.subscriber_status).toBe("connected");
    });

    it("handles disconnected status", async () => {
      const mockStatus: MqttStatus = {
        connected: false,
        publisher_status: "disconnected",
        subscriber_status: "error",
        error: "Connection refused",
      };

      server.use(
        http.get("http://localhost:8080/api/mqtt/status", () => {
          return HttpResponse.json(mockStatus);
        }),
      );

      const result = await getMqttStatus();

      expect(result.connected).toBe(false);
      expect(result.error).toBe("Connection refused");
    });
  });

  describe("publishTestMessage", () => {
    it("publishes test message successfully", async () => {
      server.use(
        http.post("http://localhost:8080/api/mqtt/publish", () => {
          return HttpResponse.json({
            success: true,
            message: "Message published",
          });
        }),
      );

      const result = await publishTestMessage("test/topic", "test payload");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Message published");
    });

    it("handles publish failure", async () => {
      server.use(
        http.post("http://localhost:8080/api/mqtt/publish", () => {
          return HttpResponse.json(
            { success: false, error: "MQTT not enabled" },
            { status: 400 },
          );
        }),
      );

      await expect(
        publishTestMessage("test/topic", "test payload"),
      ).rejects.toThrow(MqttApiError);
    });
  });

  describe("subscribeTopic and unsubscribeTopic", () => {
    it("subscribes to topic successfully", async () => {
      server.use(
        http.post("http://localhost:8080/api/mqtt/subscribe", () => {
          return HttpResponse.json({
            success: true,
            message: "Subscribed to topic",
          });
        }),
      );

      const result = await subscribeTopic("scaleit/weight/+");

      expect(result.success).toBe(true);
    });

    it("unsubscribes from topic successfully", async () => {
      server.use(
        http.post("http://localhost:8080/api/mqtt/unsubscribe", () => {
          return HttpResponse.json({
            success: true,
            message: "Unsubscribed from topic",
          });
        }),
      );

      const result = await unsubscribeTopic("scaleit/weight/+");

      expect(result.success).toBe(true);
    });
  });

  describe("getRecentMessages", () => {
    it("fetches recent messages successfully", async () => {
      const mockMessages: MqttMessage[] = [
        {
          topic: "scaleit/weight/c320tcp",
          payload: '{"device_id":"c320tcp","weight":42.5,"unit":"kg"}',
          timestamp: 1704067200,
          qos: 1,
          retain: false,
        },
        {
          topic: "scaleit/status/c320tcp",
          payload: '{"device_id":"c320tcp","status":"connected"}',
          timestamp: 1704067100,
          qos: 1,
          retain: false,
        },
      ];

      server.use(
        http.get("http://localhost:8080/api/mqtt/messages", () => {
          return HttpResponse.json(mockMessages);
        }),
      );

      const result = await getRecentMessages(50);

      expect(result).toHaveLength(2);
      expect(result[0].topic).toBe("scaleit/weight/c320tcp");
    });

    it("fetches with custom limit", async () => {
      server.use(
        http.get("http://localhost:8080/api/mqtt/messages", ({ request }) => {
          const url = new URL(request.url);
          const limit = url.searchParams.get("limit");
          expect(limit).toBe("10");
          return HttpResponse.json([]);
        }),
      );

      await getRecentMessages(10);
    });
  });

  describe("sendMqttCommand", () => {
    it("sends MQTT command successfully", async () => {
      const command: MqttCommandRequest = {
        device_id: "c320tcp",
        command: "readGross",
      };

      server.use(
        http.post("http://localhost:8080/api/mqtt/command", () => {
          return HttpResponse.json({
            success: true,
            message: "Command sent",
          });
        }),
      );

      const result = await sendMqttCommand(command);

      expect(result.success).toBe(true);
    });

    it("sends command with parameters", async () => {
      const command: MqttCommandRequest = {
        device_id: "c320tcp",
        command: "tare",
        parameters: { value: 10.5 },
      };

      server.use(
        http.post("http://localhost:8080/api/mqtt/command", async ({ request }) => {
          const body = await request.json() as MqttCommandRequest;
          expect(body.parameters).toEqual({ value: 10.5 });
          return HttpResponse.json({ success: true });
        }),
      );

      await sendMqttCommand(command);
    });
  });

  describe("testMqttConnection", () => {
    it("tests connection successfully", async () => {
      server.use(
        http.get("http://localhost:8080/api/mqtt/status", () => {
          return HttpResponse.json({
            connected: true,
            publisher_status: "connected",
            subscriber_status: "connected",
          });
        }),
      );

      const result = await testMqttConnection();

      expect(result.connected).toBe(true);
      expect(result.response_time).toBeGreaterThan(0);
    });

    it("handles connection failure", async () => {
      server.use(
        http.get("http://localhost:8080/api/mqtt/status", () => {
          return HttpResponse.error();
        }),
      );

      const result = await testMqttConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("validateMqttConfig", () => {
    it("validates valid configuration", () => {
      const config: Partial<MqttConfig> = {
        enabled: true,
        broker_url: "mqtt://localhost:1883",
        client_id: "test-client",
        topic_prefix: "scaleit",
        qos: 1,
        retain: false,
      };

      const errors = validateMqttConfig(config);

      expect(errors).toHaveLength(0);
    });

    it("requires broker URL when enabled", () => {
      const config: Partial<MqttConfig> = {
        enabled: true,
      };

      const errors = validateMqttConfig(config);

      expect(errors).toContain("Broker URL is required when MQTT is enabled");
    });

    it("validates broker URL format", () => {
      const config: Partial<MqttConfig> = {
        broker_url: "invalid-url",
      };

      const errors = validateMqttConfig(config);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("Invalid broker URL format");
    });

    it("validates QoS range", () => {
      const config: Partial<MqttConfig> = {
        qos: 5,
      };

      const errors = validateMqttConfig(config);

      expect(errors).toContain("QoS must be 0, 1, or 2");
    });

    it("validates client ID length", () => {
      const config: Partial<MqttConfig> = {
        client_id: "a".repeat(150),
      };

      const errors = validateMqttConfig(config);

      expect(errors).toContain("Client ID must be less than 128 characters");
    });

    it("requires password when username is provided", () => {
      const config: Partial<MqttConfig> = {
        username: "test_user",
      };

      const errors = validateMqttConfig(config);

      expect(errors).toContain("Password is required when username is provided");
    });

    it("allows username and password together", () => {
      const config: Partial<MqttConfig> = {
        username: "test_user",
        password: "test_pass",
      };

      const errors = validateMqttConfig(config);

      expect(errors).toHaveLength(0);
    });
  });

  describe("isValidBrokerUrl", () => {
    it("validates mqtt:// URLs", () => {
      expect(isValidBrokerUrl("mqtt://localhost:1883")).toBe(true);
      expect(isValidBrokerUrl("mqtt://192.168.1.100:1883")).toBe(true);
      expect(isValidBrokerUrl("mqtt://broker.example.com:1883")).toBe(true);
    });

    it("validates mqtts:// URLs", () => {
      expect(isValidBrokerUrl("mqtts://localhost:8883")).toBe(true);
      expect(isValidBrokerUrl("mqtts://secure-broker.com:8883")).toBe(true);
    });

    it("validates tcp:// and ssl:// URLs", () => {
      expect(isValidBrokerUrl("tcp://localhost:1883")).toBe(true);
      expect(isValidBrokerUrl("ssl://localhost:8883")).toBe(true);
    });

    it("rejects invalid URLs", () => {
      expect(isValidBrokerUrl("http://localhost:8080")).toBe(false);
      expect(isValidBrokerUrl("localhost:1883")).toBe(false);
      expect(isValidBrokerUrl("invalid")).toBe(false);
      expect(isValidBrokerUrl("")).toBe(false);
    });
  });

  describe("parseBrokerUrl", () => {
    it("parses mqtt:// URL with port", () => {
      const result = parseBrokerUrl("mqtt://localhost:1883");

      expect(result).toEqual({
        protocol: "mqtt",
        host: "localhost",
        port: 1883,
      });
    });

    it("parses mqtt:// URL without port (uses default 1883)", () => {
      const result = parseBrokerUrl("mqtt://localhost");

      expect(result).toEqual({
        protocol: "mqtt",
        host: "localhost",
        port: 1883,
      });
    });

    it("parses mqtts:// URL without port (uses default 8883)", () => {
      const result = parseBrokerUrl("mqtts://secure-broker.com");

      expect(result).toEqual({
        protocol: "mqtts",
        host: "secure-broker.com",
        port: 8883,
      });
    });

    it("parses tcp:// URL", () => {
      const result = parseBrokerUrl("tcp://192.168.1.100:1883");

      expect(result).toEqual({
        protocol: "tcp",
        host: "192.168.1.100",
        port: 1883,
      });
    });

    it("parses ssl:// URL", () => {
      const result = parseBrokerUrl("ssl://broker.example.com:8883");

      expect(result).toEqual({
        protocol: "ssl",
        host: "broker.example.com",
        port: 8883,
      });
    });

    it("returns null for invalid URLs", () => {
      expect(parseBrokerUrl("http://localhost:8080")).toBeNull();
      expect(parseBrokerUrl("invalid-url")).toBeNull();
      expect(parseBrokerUrl("")).toBeNull();
    });
  });

  describe("formatTopic", () => {
    it("formats weight topic", () => {
      const topic = formatTopic("scaleit", "weight", "c320tcp");
      expect(topic).toBe("scaleit/weight/c320tcp");
    });

    it("formats status topic", () => {
      const topic = formatTopic("scaleit", "status", "c320tcp");
      expect(topic).toBe("scaleit/status/c320tcp");
    });

    it("formats command topic", () => {
      const topic = formatTopic("scaleit", "command", "c320tcp");
      expect(topic).toBe("scaleit/command/c320tcp");
    });

    it("handles custom prefix", () => {
      const topic = formatTopic("custom_prefix", "weight", "device1");
      expect(topic).toBe("custom_prefix/weight/device1");
    });
  });

  describe("parseWeightMessage", () => {
    it("parses valid weight message", () => {
      const payload =
        '{"device_id":"c320tcp","weight":42.5,"unit":"kg","timestamp":1704067200,"is_stable":true}';

      const result = parseWeightMessage(payload);

      expect(result).toEqual({
        device_id: "c320tcp",
        weight: 42.5,
        unit: "kg",
        timestamp: 1704067200,
        is_stable: true,
      });
    });

    it("parses weight message without optional fields", () => {
      const payload = '{"device_id":"c320tcp","weight":42.5,"unit":"kg"}';

      const result = parseWeightMessage(payload);

      expect(result).not.toBeNull();
      expect(result?.device_id).toBe("c320tcp");
      expect(result?.weight).toBe(42.5);
      expect(result?.is_stable).toBe(false); // default
    });

    it("returns null for invalid JSON", () => {
      const payload = "invalid json";

      const result = parseWeightMessage(payload);

      expect(result).toBeNull();
    });

    it("returns null for missing required fields", () => {
      const payload = '{"device_id":"c320tcp"}'; // missing weight and unit

      const result = parseWeightMessage(payload);

      expect(result).toBeNull();
    });

    it("returns null for invalid weight type", () => {
      const payload = '{"device_id":"c320tcp","weight":"not a number","unit":"kg"}';

      const result = parseWeightMessage(payload);

      expect(result).toBeNull();
    });

    it("handles negative weight values", () => {
      const payload = '{"device_id":"c320tcp","weight":-10.5,"unit":"kg"}';

      const result = parseWeightMessage(payload);

      expect(result).not.toBeNull();
      expect(result?.weight).toBe(-10.5);
    });

    it("handles zero weight", () => {
      const payload = '{"device_id":"c320tcp","weight":0,"unit":"kg"}';

      const result = parseWeightMessage(payload);

      expect(result).not.toBeNull();
      expect(result?.weight).toBe(0);
    });
  });

  describe("Error handling", () => {
    it("throws MqttApiError with status code", async () => {
      server.use(
        http.get("http://localhost:8080/api/mqtt/config", () => {
          return HttpResponse.json(
            { error: "Configuration not found" },
            { status: 404 },
          );
        }),
      );

      try {
        await getMqttConfig();
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(MqttApiError);
        expect((error as MqttApiError).status).toBe(404);
      }
    });

    it("throws MqttNetworkError on network failure", async () => {
      server.use(
        http.get("http://localhost:8080/api/mqtt/config", () => {
          return HttpResponse.error();
        }),
      );

      try {
        await getMqttConfig();
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(MqttNetworkError);
      }
    });
  });

  describe("Edge cases", () => {
    it("handles empty response body", async () => {
      server.use(
        http.get("http://localhost:8080/api/mqtt/config", () => {
          return new HttpResponse("", { status: 200 });
        }),
      );

      await expect(getMqttConfig()).rejects.toThrow(MqttApiError);
    });

    it("handles malformed JSON response", async () => {
      server.use(
        http.get("http://localhost:8080/api/mqtt/config", () => {
          return new HttpResponse("not json", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }),
      );

      await expect(getMqttConfig()).rejects.toThrow(MqttApiError);
    });
  });
});
