import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MqttStatusCard from "./MqttStatusCard";
import DiagnosticsPanel from "./DiagnosticsPanel";
import MqttConfigPanel from "./MqttConfigPanel";
vi.mock("lucide-react", () => ({
    AlertCircle: () => <svg data-testid="alert-icon" />,
    CheckCircle2: () => <svg data-testid="check-icon" />,
    Info: () => <svg data-testid="info-icon" />,
    Activity: () => <svg data-testid="activity-icon" />,
    Database: () => <svg data-testid="database-icon" />,
    Clock: () => <svg data-testid="clock-icon" />,
    History: () => <svg data-testid="history-icon" />,
    TrendingUp: () => <svg data-testid="trending-icon" />,
    Loader2: () => <svg data-testid="loader-icon" />,
    Scale: () => <svg data-testid="scale-icon" />,
    Wifi: () => <svg data-testid="wifi-icon" />,
    RefreshCw: () => <svg data-testid="refresh-icon" />,
}));

import { server } from "../test/setup";
import { http, HttpResponse } from "msw";
import React from "react";

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

describe("Component Stability Tests", () => {
    beforeEach(() => {
        server.resetHandlers();
    });

    describe("MqttStatusCard Stability", () => {
        it("renders without crashing when mqttDevices.devices is null", async () => {
            server.use(
                http.get("*/api/mqtt/devices", () => {
                    return HttpResponse.json({
                        devices: null,
                        total_count: 0,
                    });
                })
            );

            renderWithClient(<MqttStatusCard />);

            await waitFor(() => {
                expect(screen.getByText("MQTT Status")).toBeInTheDocument();
            });
        });

        it("renders without crashing when mqttDevices is an empty object", async () => {
            server.use(
                http.get("*/api/mqtt/devices", () => {
                    return HttpResponse.json({});
                })
            );

            renderWithClient(<MqttStatusCard />);

            await waitFor(() => {
                expect(screen.getByText("MQTT Status")).toBeInTheDocument();
            });
        });
    });

    describe("DiagnosticsPanel Stability", () => {
        it("renders without crashing when devices response has no devices array", async () => {
            server.use(
                http.get("*/devices", () => {
                    return HttpResponse.json({
                        success: true,
                        // devices missing
                    });
                })
            );

            renderWithClient(<DiagnosticsPanel />);

            await waitFor(() => {
                expect(screen.getByText("Device Selector")).toBeInTheDocument();
            });
        });

        it("renders without crashing when config response is empty", async () => {
            server.use(
                http.get("*/api/config", () => {
                    return HttpResponse.json({});
                })
            );

            renderWithClient(<DiagnosticsPanel />);

            await waitFor(() => {
                expect(screen.getByText("Device Selector")).toBeInTheDocument();
            });
        });
    });

    describe("MqttConfigPanel Stability", () => {
        it("renders without crashing when history data has null weight_readings", async () => {
            server.use(
                http.get("*/api/mqtt/history/:deviceId", () => {
                    return HttpResponse.json({
                        device_id: "test",
                        weight_readings: null,
                        status_updates: [],
                        total_weight_readings: 0,
                        total_status_updates: 0,
                    });
                })
            );

            renderWithClient(<MqttConfigPanel />);

            await waitFor(() => {
                expect(screen.getByText(/MQTT History & Statistics/)).toBeInTheDocument();
            });
        });
    });
});
