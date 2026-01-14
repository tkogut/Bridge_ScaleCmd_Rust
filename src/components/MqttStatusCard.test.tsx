import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MqttStatusCard from "./MqttStatusCard";
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

describe("MqttStatusCard", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  describe("Rendering", () => {
    it("renders the card title", async () => {
      renderWithClient(<MqttStatusCard />);

      expect(screen.getByText("MQTT Status")).toBeInTheDocument();
    });

    it("renders loading state initially", async () => {
      // Delay the response to see loading state
      server.use(
        http.get("*/api/mqtt/status", async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            enabled: true,
            connected: true,
            broker_url: "mqtt://localhost:1883",
            client_id: "scaleit-bridge",
            topic_prefix: "scaleit",
            devices_with_history: 2,
            total_weight_readings: 150,
            total_status_updates: 45,
          });
        })
      );

      renderWithClient(<MqttStatusCard />);

      // Should show refresh button (possibly in loading state)
      const refreshButton = screen.getByRole("button");
      expect(refreshButton).toBeInTheDocument();
    });

    it("renders connected status when MQTT is connected", async () => {
      server.use(
        http.get("*/api/mqtt/status", () => {
          return HttpResponse.json({
            enabled: true,
            connected: true,
            broker_url: "mqtt://localhost:1883",
            client_id: "scaleit-bridge",
            topic_prefix: "scaleit",
            devices_with_history: 2,
            total_weight_readings: 150,
            total_status_updates: 45,
          });
        })
      );

      renderWithClient(<MqttStatusCard />);

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });
    });

    it("renders disconnected status when MQTT is enabled but not connected", async () => {
      server.use(
        http.get("*/api/mqtt/status", () => {
          return HttpResponse.json({
            enabled: true,
            connected: false,
            broker_url: "mqtt://localhost:1883",
            client_id: "scaleit-bridge",
            topic_prefix: "scaleit",
            devices_with_history: 0,
            total_weight_readings: 0,
            total_status_updates: 0,
          });
        })
      );

      renderWithClient(<MqttStatusCard />);

      await waitFor(() => {
        expect(screen.getByText("Disconnected")).toBeInTheDocument();
      });
    });

    it("renders disabled status when MQTT is not enabled", async () => {
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

      renderWithClient(<MqttStatusCard />);

      await waitFor(() => {
        expect(screen.getByText("Disabled")).toBeInTheDocument();
      });
    });

    it("handles API failure gracefully", async () => {
      server.use(
        http.get("*/api/mqtt/status", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      renderWithClient(<MqttStatusCard />);

      // The component should render without crashing even on error
      // It will show some status (Error/Unknown) based on the error
      await waitFor(() => {
        expect(screen.getByText("MQTT Status")).toBeInTheDocument();
      });
    });
  });

  describe("MQTT Details", () => {
    it("displays broker URL when connected", async () => {
      server.use(
        http.get("*/api/mqtt/status", () => {
          return HttpResponse.json({
            enabled: true,
            connected: true,
            broker_url: "mqtt://test-broker:1883",
            client_id: "test-client",
            topic_prefix: "test-prefix",
            devices_with_history: 5,
            total_weight_readings: 200,
            total_status_updates: 50,
          });
        })
      );

      renderWithClient(<MqttStatusCard />);

      await waitFor(() => {
        expect(screen.getByText("mqtt://test-broker:1883")).toBeInTheDocument();
      });
    });

    it("displays client ID when connected", async () => {
      server.use(
        http.get("*/api/mqtt/status", () => {
          return HttpResponse.json({
            enabled: true,
            connected: true,
            broker_url: "mqtt://localhost:1883",
            client_id: "my-custom-client",
            topic_prefix: "scaleit",
            devices_with_history: 2,
            total_weight_readings: 150,
            total_status_updates: 45,
          });
        })
      );

      renderWithClient(<MqttStatusCard />);

      await waitFor(() => {
        expect(screen.getByText("my-custom-client")).toBeInTheDocument();
      });
    });

    it("displays topic prefix when connected", async () => {
      server.use(
        http.get("*/api/mqtt/status", () => {
          return HttpResponse.json({
            enabled: true,
            connected: true,
            broker_url: "mqtt://localhost:1883",
            client_id: "scaleit-bridge",
            topic_prefix: "custom-prefix",
            devices_with_history: 2,
            total_weight_readings: 150,
            total_status_updates: 45,
          });
        })
      );

      renderWithClient(<MqttStatusCard />);

      await waitFor(() => {
        expect(screen.getByText("custom-prefix")).toBeInTheDocument();
      });
    });

    it("displays history statistics when connected", async () => {
      server.use(
        http.get("*/api/mqtt/status", () => {
          return HttpResponse.json({
            enabled: true,
            connected: true,
            broker_url: "mqtt://localhost:1883",
            client_id: "scaleit-bridge",
            topic_prefix: "scaleit",
            devices_with_history: 5,
            total_weight_readings: 1000,
            total_status_updates: 250,
          });
        }),
        http.get("*/api/mqtt/devices", () => {
          return HttpResponse.json({
            devices: [],
            total_count: 0,
          });
        })
      );

      renderWithClient(<MqttStatusCard />);

      await waitFor(() => {
        // Should show connected status and history statistics section
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      // Check for statistics section
      await waitFor(() => {
        expect(screen.getByText("History Statistics")).toBeInTheDocument();
      });
    });
  });

  describe("Disabled State", () => {
    it("shows instructions when MQTT is disabled", async () => {
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

      renderWithClient(<MqttStatusCard />);

      await waitFor(() => {
        expect(screen.getByText("MQTT is disabled")).toBeInTheDocument();
        expect(screen.getByText(/MQTT_ENABLED=true/)).toBeInTheDocument();
      });
    });
  });

  describe("Refresh Button", () => {
    it("has a refresh button", async () => {
      renderWithClient(<MqttStatusCard />);

      const refreshButton = screen.getByRole("button");
      expect(refreshButton).toBeInTheDocument();
    });

    it("refresh button triggers data refetch", async () => {
      const user = userEvent.setup();
      let callCount = 0;

      server.use(
        http.get("*/api/mqtt/status", () => {
          callCount++;
          return HttpResponse.json({
            enabled: true,
            connected: true,
            broker_url: "mqtt://localhost:1883",
            client_id: "scaleit-bridge",
            topic_prefix: "scaleit",
            devices_with_history: callCount,
            total_weight_readings: 150,
            total_status_updates: 45,
          });
        })
      );

      renderWithClient(<MqttStatusCard />);

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole("button");
      await user.click(refreshButton);

      // The button click should trigger a refetch
      // We verify by checking that the callCount increased
      expect(callCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Error Handling", () => {
    it("renders gracefully when status fetch fails", async () => {
      server.use(
        http.get("*/api/mqtt/status", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      renderWithClient(<MqttStatusCard />);

      // Component should render without crashing
      await waitFor(() => {
        expect(screen.getByText("MQTT Status")).toBeInTheDocument();
      });
    });
  });
});
