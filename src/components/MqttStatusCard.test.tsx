/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MqttStatusCard from "./MqttStatusCard";
import type { MqttStatus } from "@/services/mqtt-api";

// Mock UI components
vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="card">
      {children}
    </div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: any) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button">
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  RefreshCw: () => <svg data-testid="refresh-icon" />,
  Loader2: () => <svg data-testid="loader2-icon" />,
  Wifi: () => <svg data-testid="wifi-icon" />,
  WifiOff: () => <svg data-testid="wifi-off-icon" />,
}));

// Mock MQTT API
vi.mock("@/services/mqtt-api", () => ({
  getMqttStatus: vi.fn(),
}));

import { getMqttStatus } from "@/services/mqtt-api";

const mockGetMqttStatus = vi.mocked(getMqttStatus);

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithQueryClient = (component: React.ReactElement) => {
  const testQueryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={testQueryClient}>
      {component}
    </QueryClientProvider>,
  );
};

describe("MqttStatusCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    mockGetMqttStatus.mockReturnValue(
      new Promise(() => {}), // Never resolves to show loading state
    );

    renderWithQueryClient(<MqttStatusCard />);
    expect(screen.getByTestId("loader2-icon")).toBeInTheDocument();
  });

  it("renders connected status when MQTT is connected", async () => {
    const mockStatus: MqttStatus = {
      connected: true,
      publisher_status: "connected",
      subscriber_status: "connected",
      last_connection: "2026-01-14T12:00:00Z",
    };

    mockGetMqttStatus.mockResolvedValue(mockStatus);

    renderWithQueryClient(<MqttStatusCard />);

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
      expect(screen.getByTestId("wifi-icon")).toBeInTheDocument();
    });
  });

  it("renders disconnected status when MQTT is disconnected", async () => {
    const mockStatus: MqttStatus = {
      connected: false,
      publisher_status: "disconnected",
      subscriber_status: "disconnected",
    };

    mockGetMqttStatus.mockResolvedValue(mockStatus);

    renderWithQueryClient(<MqttStatusCard />);

    await waitFor(() => {
      expect(screen.getByText("Disconnected")).toBeInTheDocument();
      expect(screen.getByTestId("wifi-off-icon")).toBeInTheDocument();
    });
  });

  it("displays publisher and subscriber status", async () => {
    const mockStatus: MqttStatus = {
      connected: true,
      publisher_status: "connected",
      subscriber_status: "connected",
    };

    mockGetMqttStatus.mockResolvedValue(mockStatus);

    renderWithQueryClient(<MqttStatusCard />);

    await waitFor(() => {
      expect(screen.getByText("Publisher:")).toBeInTheDocument();
      expect(screen.getByText("Subscriber:")).toBeInTheDocument();
      expect(screen.getAllByText("connected")).toHaveLength(2);
    });
  });

  it("displays error status when subscriber is in error", async () => {
    const mockStatus: MqttStatus = {
      connected: true,
      publisher_status: "connected",
      subscriber_status: "error",
    };

    mockGetMqttStatus.mockResolvedValue(mockStatus);

    renderWithQueryClient(<MqttStatusCard />);

    await waitFor(() => {
      expect(screen.getByText("error")).toBeInTheDocument();
    });
  });

  it("displays last connection timestamp", async () => {
    const mockStatus: MqttStatus = {
      connected: true,
      publisher_status: "connected",
      subscriber_status: "connected",
      last_connection: "2026-01-14T12:00:00Z",
    };

    mockGetMqttStatus.mockResolvedValue(mockStatus);

    renderWithQueryClient(<MqttStatusCard />);

    await waitFor(() => {
      expect(screen.getByText(/Last connection:/)).toBeInTheDocument();
    });
  });

  it("displays error message when present", async () => {
    const mockStatus: MqttStatus = {
      connected: false,
      publisher_status: "error",
      subscriber_status: "error",
      error: "Connection refused to broker",
    };

    mockGetMqttStatus.mockResolvedValue(mockStatus);

    renderWithQueryClient(<MqttStatusCard />);

    await waitFor(() => {
      expect(screen.getByText("Error:")).toBeInTheDocument();
      expect(screen.getByText("Connection refused to broker")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    mockGetMqttStatus.mockRejectedValue(new Error("Network error"));

    renderWithQueryClient(<MqttStatusCard />);

    await waitFor(() => {
      expect(screen.getByText(/Connection Error/)).toBeInTheDocument();
    });
  });

  it("displays error status with error icon", async () => {
    mockGetMqttStatus.mockRejectedValue(new Error("Failed to fetch"));

    renderWithQueryClient(<MqttStatusCard />);

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByTestId("wifi-off-icon")).toBeInTheDocument();
    });
  });

  it("calls refetch when refresh button is clicked", async () => {
    const mockStatus: MqttStatus = {
      connected: true,
      publisher_status: "connected",
      subscriber_status: "connected",
    };

    mockGetMqttStatus.mockResolvedValue(mockStatus);

    renderWithQueryClient(<MqttStatusCard />);

    await waitFor(() => {
      expect(screen.getByTestId("refresh-icon")).toBeInTheDocument();
    });

    const refreshButton = screen.getByTestId("refresh-icon").closest("button");
    fireEvent.click(refreshButton!);

    // Should trigger another call to getMqttStatus
    await waitFor(() => {
      expect(mockGetMqttStatus).toHaveBeenCalledTimes(2);
    });
  });

  it("disables refresh button while loading", () => {
    mockGetMqttStatus.mockReturnValue(new Promise(() => {}));

    renderWithQueryClient(<MqttStatusCard />);

    const refreshButton = screen.getByTestId("button");
    expect(refreshButton).toBeDisabled();
  });

  it("shows no data message when data is null", async () => {
    mockGetMqttStatus.mockResolvedValue(null as any);

    renderWithQueryClient(<MqttStatusCard />);

    await waitFor(() => {
      expect(screen.getByText(/No MQTT status available/)).toBeInTheDocument();
    });
  });

  it("displays publisher as disconnected", async () => {
    const mockStatus: MqttStatus = {
      connected: false,
      publisher_status: "disconnected",
      subscriber_status: "connected",
    };

    mockGetMqttStatus.mockResolvedValue(mockStatus);

    renderWithQueryClient(<MqttStatusCard />);

    await waitFor(() => {
      expect(screen.getByText("disconnected")).toBeInTheDocument();
    });
  });

  it("renders title correctly", () => {
    mockGetMqttStatus.mockReturnValue(new Promise(() => {}));

    renderWithQueryClient(<MqttStatusCard />);

    expect(screen.getByText("MQTT Status")).toBeInTheDocument();
  });

  it("auto-refreshes status every 5 seconds", async () => {
    const mockStatus: MqttStatus = {
      connected: true,
      publisher_status: "connected",
      subscriber_status: "connected",
    };

    mockGetMqttStatus.mockResolvedValue(mockStatus);

    renderWithQueryClient(<MqttStatusCard />);

    await waitFor(() => {
      expect(mockGetMqttStatus).toHaveBeenCalledTimes(1);
    });

    // Fast-forward time by 5 seconds
    vi.useFakeTimers();
    vi.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(mockGetMqttStatus).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });
});
