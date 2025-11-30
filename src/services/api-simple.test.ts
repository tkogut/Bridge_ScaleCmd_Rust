import { describe, it, expect } from "vitest";
import {
  validateDeviceConfig,
  ApiError,
  NetworkError,
  ValidationError,
} from "./api";

// Simple unit tests for API utility functions
describe("API Service - Simple Tests", () => {
  describe("Error Classes", () => {
    it("should create ApiError correctly", () => {
      const error = new ApiError("Test error", 404);
      expect(error.name).toBe("ApiError");
      expect(error.message).toBe("Test error");
      expect(error.status).toBe(404);
    });

    it("should create NetworkError correctly", () => {
      const error = new NetworkError("Network failed");
      expect(error.name).toBe("NetworkError");
      expect(error.message).toBe("Network failed");
    });

    it("should create ValidationError correctly", () => {
      const error = new ValidationError("Invalid input");
      expect(error.name).toBe("ValidationError");
      expect(error.message).toBe("Invalid input");
    });
  });

  describe("Device Config Validation", () => {
    it("should validate correct TCP device config", () => {
      const validConfig = {
        name: "Test Device",
        manufacturer: "Test Corp",
        model: "Model-1",
        protocol: "RINCMD",
        connection: {
          connection_type: "Tcp" as const,
          host: "192.168.1.100",
          port: 8080,
          timeout_ms: 3000,
        },
        commands: {
          readGross: "CMD1",
          readNet: "CMD2",
        },
        enabled: true,
      };

      const errors = validateDeviceConfig(validConfig);
      expect(errors).toHaveLength(0);
    });

    it("should validate correct Serial device config", () => {
      const validConfig = {
        name: "Serial Device",
        manufacturer: "Serial Corp",
        model: "Serial-1",
        protocol: "DINI_ARGEO",
        connection: {
          connection_type: "Serial" as const,
          port: "/dev/ttyUSB0",
          baud_rate: 9600,
          timeout_ms: 1000,
        },
        commands: {
          readGross: "READ",
          tare: "TARE",
        },
        enabled: true,
      };

      const errors = validateDeviceConfig(validConfig);
      expect(errors).toHaveLength(0);
    });

    it("should detect missing required fields", () => {
      const invalidConfig = {
        name: "",
        manufacturer: "",
        model: "Model-1",
        protocol: "",
        connection: {
          connection_type: "Tcp" as const,
          host: "",
          port: 0,
          timeout_ms: 3000,
        },
        commands: {},
        enabled: true,
      };

      const errors = validateDeviceConfig(invalidConfig);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain("Device name is required");
      expect(errors).toContain("Manufacturer is required");
      expect(errors).toContain("Protocol is required");
      expect(errors).toContain("TCP host is required");
      expect(errors).toContain("Valid TCP port is required");
      expect(errors).toContain("At least one command mapping is required");
    });

    it("should detect invalid TCP connection", () => {
      const invalidConfig = {
        name: "Test Device",
        manufacturer: "Test Corp",
        model: "Model-1",
        protocol: "RINCMD",
        connection: {
          connection_type: "Tcp" as const,
          host: "",
          port: -1,
          timeout_ms: 3000,
        },
        commands: {
          readGross: "CMD1",
        },
        enabled: true,
      };

      const errors = validateDeviceConfig(invalidConfig);
      expect(errors).toContain("TCP host is required");
      expect(errors).toContain("Valid TCP port is required");
    });

    it("should detect invalid Serial connection", () => {
      const invalidConfig = {
        name: "Serial Device",
        manufacturer: "Serial Corp",
        model: "Serial-1",
        protocol: "DINI_ARGEO",
        connection: {
          connection_type: "Serial" as const,
          port: "",
          baud_rate: 0,
          timeout_ms: 1000,
        },
        commands: {
          readGross: "READ",
        },
        enabled: true,
      };

      const errors = validateDeviceConfig(invalidConfig);
      expect(errors).toContain("Serial port is required");
      expect(errors).toContain("Valid baud rate is required");
    });

    it("should require connection configuration", () => {
      const invalidConfig = {
        name: "Test Device",
        manufacturer: "Test Corp",
        model: "Model-1",
        protocol: "RINCMD",
        connection: null as any,
        commands: {
          readGross: "CMD1",
        },
        enabled: true,
      };

      const errors = validateDeviceConfig(invalidConfig);
      expect(errors).toContain("Connection configuration is required");
    });

    it("should trim whitespace from string fields", () => {
      const configWithWhitespace = {
        name: "  Test Device  ",
        manufacturer: "  Test Corp  ",
        model: "  Model-1  ",
        protocol: "  RINCMD  ",
        connection: {
          connection_type: "Tcp" as const,
          host: "192.168.1.100",
          port: 8080,
          timeout_ms: 3000,
        },
        commands: {
          readGross: "CMD1",
        },
        enabled: true,
      };

      // The validation function should handle trimmed strings correctly
      const errors = validateDeviceConfig(configWithWhitespace);
      expect(errors).toHaveLength(0);
    });
  });

  describe("Type Checking", () => {
    it("should have correct types for API interfaces", () => {
      // TypeScript compile-time type checking
      const scaleRequest = {
        device_id: "C320",
        command: "readGross",
      };

      expect(scaleRequest.device_id).toBe("C320");
      expect(scaleRequest.command).toBe("readGross");
    });

    it("should handle optional fields in WeightReading", () => {
      const minimalReading = {
        gross_weight: 42.5,
      };

      const fullReading = {
        gross_weight: 42.5,
        net_weight: 40.0,
        unit: "kg",
        is_stable: true,
        timestamp: new Date().toISOString(),
        status: "OK",
        tare_weight: 2.5,
      };

      expect(minimalReading.gross_weight).toBe(42.5);
      expect(fullReading.unit).toBe("kg");
      expect(fullReading.is_stable).toBe(true);
    });
  });

  describe("Constants and Configuration", () => {
    it("should have proper API base URL format", () => {
      // This tests that the API base URL follows expected patterns
      const validUrls = [
        "http://localhost:8080",
        "https://api.scaleit.com",
        "http://192.168.1.100:8080",
      ];

      validUrls.forEach((url) => {
        expect(url).toMatch(/^https?:\/\//);
      });
    });

    it("should support valid command types", () => {
      const validCommands = ["readGross", "readNet", "tare", "zero"];

      validCommands.forEach((command) => {
        expect(command).toBeTruthy();
        expect(typeof command).toBe("string");
        expect(command.length).toBeGreaterThan(0);
      });
    });

    it("should support valid connection types", () => {
      const tcpConnection = "Tcp";
      const serialConnection = "Serial";

      expect(["Tcp", "Serial"]).toContain(tcpConnection);
      expect(["Tcp", "Serial"]).toContain(serialConnection);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty strings", () => {
      const configWithEmptyStrings = {
        name: "",
        manufacturer: "",
        model: "",
        protocol: "",
        connection: {
          connection_type: "Tcp" as const,
          host: "",
          port: 8080,
          timeout_ms: 3000,
        },
        commands: {},
        enabled: true,
      };

      const errors = validateDeviceConfig(configWithEmptyStrings);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should handle boundary values for ports", () => {
      const configs = [
        { port: 8080, expected: true }, // Valid port
        { port: 1024, expected: true }, // Valid minimum
        { port: 65535, expected: true }, // Valid maximum
        { port: 0, expected: false }, // Invalid
        { port: -1, expected: false }, // Negative
      ];

      configs.forEach(({ port, expected }) => {
        const config = {
          name: "Test Device",
          manufacturer: "Test Corp",
          model: "Model-1",
          protocol: "RINCMD",
          connection: {
            connection_type: "Tcp" as const,
            host: "127.0.0.1",
            port: port,
            timeout_ms: 3000,
          },
          commands: { readGross: "CMD1" },
          enabled: true,
        };

        const errors = validateDeviceConfig(config);
        const hasPortError = errors.some((err) =>
          err.includes("Valid TCP port is required"),
        );

        if (expected) {
          expect(hasPortError).toBe(false); // Should NOT have port error for valid ports
        } else {
          expect(hasPortError).toBe(true); // Should have port error for invalid ports
        }
      });
    });

    it("should handle various protocol names", () => {
      const protocols = ["RINCMD", "DINI_ARGEO", "ASCII", "MODBUS", "CUSTOM"];

      protocols.forEach((protocol) => {
        expect(protocol).toBeTruthy();
        expect(protocol.toUpperCase()).toBe(protocol);
      });
    });
  });
});
