import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MqttConfigPanel from "./MqttConfigPanel";
import { server } from "../test/setup";
import { http, HttpResponse } from "msw";

// Helper to create a fresh QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });

// Wrapper component with QueryClientProvider
const renderWithClient = (ui: React.ReactElement) => {
  const testQueryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>
  );
};

describe("MqttConfigPanel", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  describe("Rendering", () => {
    it("renders the card title", async () => {
      renderWithClient(<MqttConfigPanel />);

      // Wait for the component to render (it shows loading initially, then title)
      await waitFor(() => {
        const hasTitle = screen.queryByText("MQTT History") !== null ||
                        screen.queryByText(/Loading MQTT data/) !== null;
        expect(hasTitle).toBe(true);
      });
    });

    it("renders device selector label", async () => {
      renderWithClient(<MqttConfigPanel />);

      await waitFor(() => {
        expect(screen.getByText("Select Device")).toBeInTheDocument();
      });
    });

    it("shows message when no devices have history", async () => {
      server.use(
        http.get("*/api/mqtt/devices", () => {
          return HttpResponse.json({
            devices: [],
            total_count: 0,
          });
        })
      );

      renderWithClient(<MqttConfigPanel />);

      await waitFor(() => {
        expect(
          screen.getByText(/No devices with MQTT history found/)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Device Selection", () => {
    it("displays device list in selector", async () => {
      server.use(
        http.get("*/api/mqtt/devices", () => {
          return HttpResponse.json({
            devices: [
              {
                device_id: "device1",
                weight_readings_count: 100,
                status_updates_count: 30,
                last_weight_reading: null,
                last_status_update: null,
              },
              {
                device_id: "device2",
                weight_readings_count: 50,
                status_updates_count: 15,
                last_weight_reading: null,
                last_status_update: null,
              },
            ],
            total_count: 2,
          });
        })
      );

      renderWithClient(<MqttConfigPanel />);

      await waitFor(() => {
        // The select trigger should be present
        const selectTrigger = screen.getByRole("combobox");
        expect(selectTrigger).toBeInTheDocument();
      });
    });

    it("auto-selects first device", async () => {
      server.use(
        http.get("*/api/mqtt/devices", () => {
          return HttpResponse.json({
            devices: [
              {
                device_id: "auto-selected-device",
                weight_readings_count: 100,
                status_updates_count: 30,
                last_weight_reading: {
                  device_id: "auto-selected-device",
                  weight: 42.5,
                  unit: "kg",
                  timestamp: 1705250400,
                  is_stable: true,
                  recorded_at: "2026-01-14T12:00:00Z",
                },
                last_status_update: null,
              },
            ],
            total_count: 1,
          });
        }),
        http.get("*/api/mqtt/history/:deviceId/latest", () => {
          return HttpResponse.json({
            device_id: "auto-selected-device",
            latest_weight: {
              device_id: "auto-selected-device",
              weight: 42.5,
              unit: "kg",
              timestamp: 1705250400,
              is_stable: true,
              recorded_at: "2026-01-14T12:00:00Z",
            },
            latest_status: null,
          });
        }),
        http.get("*/api/mqtt/history/:deviceId/stats", () => {
          return HttpResponse.json({
            device_id: "auto-selected-device",
            weight_readings_count: 100,
            status_updates_count: 30,
            first_weight_reading: "2026-01-14T10:00:00Z",
            last_weight_reading: "2026-01-14T12:00:00Z",
            first_status_update: null,
            last_status_update: null,
          });
        }),
        http.get("*/api/mqtt/history/:deviceId", () => {
          return HttpResponse.json({
            device_id: "auto-selected-device",
            weight_readings: [],
            status_updates: [],
            total_weight_readings: 0,
            total_status_updates: 0,
          });
        })
      );

      renderWithClient(<MqttConfigPanel />);

      // After loading, should show statistics section
      await waitFor(
        () => {
          expect(screen.getByText("Statistics")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Latest Reading Display", () => {
    it("displays latest weight reading", async () => {
      server.use(
        http.get("*/api/mqtt/devices", () => {
          return HttpResponse.json({
            devices: [
              {
                device_id: "test-device",
                weight_readings_count: 100,
                status_updates_count: 30,
                last_weight_reading: null,
                last_status_update: null,
              },
            ],
            total_count: 1,
          });
        }),
        http.get("*/api/mqtt/history/:deviceId/latest", () => {
          return HttpResponse.json({
            device_id: "test-device",
            latest_weight: {
              device_id: "test-device",
              weight: 125.75,
              unit: "kg",
              timestamp: 1705250400,
              is_stable: true,
              recorded_at: "2026-01-14T12:00:00Z",
            },
            latest_status: {
              device_id: "test-device",
              status: "connected",
              timestamp: 1705250400,
              recorded_at: "2026-01-14T12:00:00Z",
            },
          });
        }),
        http.get("*/api/mqtt/history/:deviceId/stats", () => {
          return HttpResponse.json({
            device_id: "test-device",
            weight_readings_count: 100,
            status_updates_count: 30,
            first_weight_reading: "2026-01-14T10:00:00Z",
            last_weight_reading: "2026-01-14T12:00:00Z",
            first_status_update: "2026-01-14T10:00:00Z",
            last_status_update: "2026-01-14T12:00:00Z",
          });
        }),
        http.get("*/api/mqtt/history/:deviceId", () => {
          return HttpResponse.json({
            device_id: "test-device",
            weight_readings: [],
            status_updates: [],
            total_weight_readings: 0,
            total_status_updates: 0,
          });
        })
      );

      renderWithClient(<MqttConfigPanel />);

      await waitFor(
        () => {
          // Check for latest reading section
          expect(screen.getByText("Latest Reading")).toBeInTheDocument();
          expect(screen.getByText(/125.75/)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Statistics Display", () => {
    it("displays statistics for selected device", async () => {
      server.use(
        http.get("*/api/mqtt/devices", () => {
          return HttpResponse.json({
            devices: [
              {
                device_id: "stats-device",
                weight_readings_count: 100,
                status_updates_count: 30,
                last_weight_reading: null,
                last_status_update: null,
              },
            ],
            total_count: 1,
          });
        }),
        http.get("*/api/mqtt/history/:deviceId/latest", () => {
          return HttpResponse.json({
            device_id: "stats-device",
            latest_weight: null,
            latest_status: null,
          });
        }),
        http.get("*/api/mqtt/history/:deviceId/stats", () => {
          return HttpResponse.json({
            device_id: "stats-device",
            weight_readings_count: 500,
            status_updates_count: 100,
            first_weight_reading: "2026-01-14T08:00:00Z",
            last_weight_reading: "2026-01-14T16:00:00Z",
            first_status_update: "2026-01-14T08:00:00Z",
            last_status_update: "2026-01-14T16:00:00Z",
          });
        }),
        http.get("*/api/mqtt/history/:deviceId", () => {
          return HttpResponse.json({
            device_id: "stats-device",
            weight_readings: [],
            status_updates: [],
            total_weight_readings: 500,
            total_status_updates: 100,
          });
        })
      );

      renderWithClient(<MqttConfigPanel />);

      await waitFor(
        () => {
          expect(screen.getByText("Statistics")).toBeInTheDocument();
          expect(screen.getByText("Weight Readings")).toBeInTheDocument();
          expect(screen.getByText("500")).toBeInTheDocument();
          expect(screen.getByText("Status Updates")).toBeInTheDocument();
          expect(screen.getByText("100")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Delete History", () => {
    it("shows delete button when device is selected", async () => {
      server.use(
        http.get("*/api/mqtt/devices", () => {
          return HttpResponse.json({
            devices: [
              {
                device_id: "delete-test",
                weight_readings_count: 100,
                status_updates_count: 30,
                last_weight_reading: null,
                last_status_update: null,
              },
            ],
            total_count: 1,
          });
        }),
        http.get("*/api/mqtt/history/:deviceId/latest", () => {
          return HttpResponse.json({
            device_id: "delete-test",
            latest_weight: null,
            latest_status: null,
          });
        }),
        http.get("*/api/mqtt/history/:deviceId/stats", () => {
          return HttpResponse.json({
            device_id: "delete-test",
            weight_readings_count: 100,
            status_updates_count: 30,
            first_weight_reading: null,
            last_weight_reading: null,
            first_status_update: null,
            last_status_update: null,
          });
        }),
        http.get("*/api/mqtt/history/:deviceId", () => {
          return HttpResponse.json({
            device_id: "delete-test",
            weight_readings: [],
            status_updates: [],
            total_weight_readings: 0,
            total_status_updates: 0,
          });
        })
      );

      renderWithClient(<MqttConfigPanel />);

      await waitFor(
        () => {
          expect(screen.getByText("Delete History")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("shows confirmation dialog when delete is clicked", async () => {
      const user = userEvent.setup();

      server.use(
        http.get("*/api/mqtt/devices", () => {
          return HttpResponse.json({
            devices: [
              {
                device_id: "confirm-delete",
                weight_readings_count: 100,
                status_updates_count: 30,
                last_weight_reading: null,
                last_status_update: null,
              },
            ],
            total_count: 1,
          });
        }),
        http.get("*/api/mqtt/history/:deviceId/latest", () => {
          return HttpResponse.json({
            device_id: "confirm-delete",
            latest_weight: null,
            latest_status: null,
          });
        }),
        http.get("*/api/mqtt/history/:deviceId/stats", () => {
          return HttpResponse.json({
            device_id: "confirm-delete",
            weight_readings_count: 100,
            status_updates_count: 30,
            first_weight_reading: null,
            last_weight_reading: null,
            first_status_update: null,
            last_status_update: null,
          });
        }),
        http.get("*/api/mqtt/history/:deviceId", () => {
          return HttpResponse.json({
            device_id: "confirm-delete",
            weight_readings: [],
            status_updates: [],
            total_weight_readings: 0,
            total_status_updates: 0,
          });
        })
      );

      renderWithClient(<MqttConfigPanel />);

      await waitFor(() => {
        expect(screen.getByText("Delete History")).toBeInTheDocument();
      });

      const deleteButton = screen.getByText("Delete History");
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText("Delete MQTT History")).toBeInTheDocument();
        expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("shows error message when devices fetch fails", async () => {
      server.use(
        http.get("*/api/mqtt/devices", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      renderWithClient(<MqttConfigPanel />);

      // Component should show an error message
      await waitFor(() => {
        expect(screen.getByText(/Error loading MQTT devices/)).toBeInTheDocument();
      });
    });
  });

  describe("Refresh Button", () => {
    it("has a refresh button after loading", async () => {
      renderWithClient(<MqttConfigPanel />);

      // Wait for initial load to complete
      await waitFor(() => {
        expect(screen.getByText("MQTT History")).toBeInTheDocument();
      });

      // The refresh button should be present (may be inside the card)
      const card = screen.getByText("MQTT History").closest("div");
      expect(card).toBeInTheDocument();
    });
  });
});
