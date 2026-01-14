/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MqttConfigPanel from "./MqttConfigPanel";
import type { MqttConfig } from "@/services/mqtt-api";

// Mock UI components
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button">
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ id, value, onChange, disabled, type, placeholder }: any) => (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      data-testid={`input-${id}`}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: any) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({ id, checked, onCheckedChange, disabled }: any) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      data-testid={`switch-${id}`}
    />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, disabled }: any) => (
    <select
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      disabled={disabled}
      data-testid="select"
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: () => null,
}));

vi.mock("lucide-react", () => ({
  Loader2: () => <svg data-testid="loader2-icon" />,
  Save: () => <svg data-testid="save-icon" />,
  TestTube2: () => <svg data-testid="test-icon" />,
}));

vi.mock("@/utils/toast", () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

// Mock MQTT API
vi.mock("@/services/mqtt-api", () => ({
  getMqttConfig: vi.fn(),
  updateMqttConfig: vi.fn(),
  testMqttConnection: vi.fn(),
  validateMqttConfig: vi.fn(() => []),
}));

import { getMqttConfig, updateMqttConfig, testMqttConnection, validateMqttConfig } from "@/services/mqtt-api";
import { showSuccess, showError } from "@/utils/toast";

const mockGetMqttConfig = vi.mocked(getMqttConfig);
const mockUpdateMqttConfig = vi.mocked(updateMqttConfig);
const mockTestMqttConnection = vi.mocked(testMqttConnection);
const mockValidateMqttConfig = vi.mocked(validateMqttConfig);
const mockShowSuccess = vi.mocked(showSuccess);
const mockShowError = vi.mocked(showError);

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
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

describe("MqttConfigPanel Component", () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateMqttConfig.mockReturnValue([]);
  });

  it("renders loading state initially", () => {
    mockGetMqttConfig.mockReturnValue(new Promise(() => {}));

    renderWithQueryClient(<MqttConfigPanel />);
    expect(screen.getByTestId("loader2-icon")).toBeInTheDocument();
  });

  it("renders configuration form when data is loaded", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("MQTT Configuration")).toBeInTheDocument();
      expect(screen.getByTestId("switch-mqtt-enabled")).toBeInTheDocument();
    });
  });

  it("displays all form fields", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText("Enable MQTT")).toBeInTheDocument();
      expect(screen.getByText("Broker URL")).toBeInTheDocument();
      expect(screen.getByText("Client ID")).toBeInTheDocument();
      expect(screen.getByText("Topic Prefix")).toBeInTheDocument();
      expect(screen.getByText("Username (optional)")).toBeInTheDocument();
      expect(screen.getByText("Password (optional)")).toBeInTheDocument();
      expect(screen.getByText("Quality of Service (QoS)")).toBeInTheDocument();
      expect(screen.getByText("Retain Messages")).toBeInTheDocument();
    });
  });

  it("populates form fields with current config", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      const brokerUrlInput = screen.getByTestId("input-broker-url");
      expect(brokerUrlInput).toHaveValue(mockConfig.broker_url);

      const clientIdInput = screen.getByTestId("input-client-id");
      expect(clientIdInput).toHaveValue(mockConfig.client_id);

      const topicPrefixInput = screen.getByTestId("input-topic-prefix");
      expect(topicPrefixInput).toHaveValue(mockConfig.topic_prefix);
    });
  });

  it("toggles MQTT enabled state", async () => {
    mockGetMqttConfig.mockResolvedValue({ ...mockConfig, enabled: false });

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      const enableSwitch = screen.getByTestId("switch-mqtt-enabled");
      expect(enableSwitch).not.toBeChecked();
    });

    const enableSwitch = screen.getByTestId("switch-mqtt-enabled");
    fireEvent.click(enableSwitch);

    expect(enableSwitch).toBeChecked();
  });

  it("disables form fields when MQTT is disabled", async () => {
    mockGetMqttConfig.mockResolvedValue({ ...mockConfig, enabled: false });

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      const brokerUrlInput = screen.getByTestId("input-broker-url");
      expect(brokerUrlInput).toBeDisabled();

      const clientIdInput = screen.getByTestId("input-client-id");
      expect(clientIdInput).toBeDisabled();
    });
  });

  it("updates broker URL on input change", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      const brokerUrlInput = screen.getByTestId("input-broker-url");
      expect(brokerUrlInput).toBeInTheDocument();
    });

    const brokerUrlInput = screen.getByTestId("input-broker-url");
    fireEvent.change(brokerUrlInput, {
      target: { value: "mqtt://192.168.1.100:1883" },
    });

    expect(brokerUrlInput).toHaveValue("mqtt://192.168.1.100:1883");
  });

  it("saves configuration successfully", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);
    mockUpdateMqttConfig.mockResolvedValue({
      success: true,
      message: "Configuration updated",
    });

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("save-icon")).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId("save-icon").closest("button");
    fireEvent.click(saveButton!);

    await waitFor(() => {
      expect(mockUpdateMqttConfig).toHaveBeenCalled();
      expect(mockShowSuccess).toHaveBeenCalledWith(
        "MQTT configuration updated successfully",
      );
    });
  });

  it("validates configuration before saving", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);
    mockValidateMqttConfig.mockReturnValue(["Broker URL is required"]);

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("save-icon")).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId("save-icon").closest("button");
    fireEvent.click(saveButton!);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining("Validation errors"),
      );
      expect(mockUpdateMqttConfig).not.toHaveBeenCalled();
    });
  });

  it("handles save error", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);
    mockUpdateMqttConfig.mockRejectedValue(new Error("Network error"));

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("save-icon")).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId("save-icon").closest("button");
    fireEvent.click(saveButton!);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining("Network error"),
      );
    });
  });

  it("tests MQTT connection successfully", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);
    mockTestMqttConnection.mockResolvedValue({
      connected: true,
      broker_url: "mqtt://localhost:1883",
      response_time: 50,
    });

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    });

    const testButton = screen.getByTestId("test-icon").closest("button");
    fireEvent.click(testButton!);

    await waitFor(() => {
      expect(mockTestMqttConnection).toHaveBeenCalled();
      expect(mockShowSuccess).toHaveBeenCalledWith(
        expect.stringContaining("successful"),
      );
    });
  });

  it("handles test connection failure", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);
    mockTestMqttConnection.mockResolvedValue({
      connected: false,
      broker_url: "mqtt://localhost:1883",
      error: "Connection refused",
    });

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    });

    const testButton = screen.getByTestId("test-icon").closest("button");
    fireEvent.click(testButton!);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining("Connection refused"),
      );
    });
  });

  it("changes QoS selection", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      const qosSelect = screen.getByTestId("select");
      expect(qosSelect).toBeInTheDocument();
    });

    const qosSelect = screen.getByTestId("select");
    fireEvent.change(qosSelect, { target: { value: "2" } });

    expect(qosSelect).toHaveValue("2");
  });

  it("toggles retain flag", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      const retainSwitch = screen.getByTestId("switch-retain");
      expect(retainSwitch).toBeInTheDocument();
    });

    const retainSwitch = screen.getByTestId("switch-retain");
    fireEvent.click(retainSwitch);

    expect(retainSwitch).toBeChecked();
  });

  it("disables save button when MQTT is disabled", async () => {
    mockGetMqttConfig.mockResolvedValue({ ...mockConfig, enabled: false });

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      const saveButton = screen.getByTestId("save-icon").closest("button");
      expect(saveButton).toBeDisabled();
    });
  });

  it("disables test button when MQTT is disabled", async () => {
    mockGetMqttConfig.mockResolvedValue({ ...mockConfig, enabled: false });

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      const testButton = screen.getByTestId("test-icon").closest("button");
      expect(testButton).toBeDisabled();
    });
  });

  it("updates username and password fields", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      const usernameInput = screen.getByTestId("input-username");
      expect(usernameInput).toBeInTheDocument();
    });

    const usernameInput = screen.getByTestId("input-username");
    fireEvent.change(usernameInput, { target: { value: "new_user" } });

    expect(usernameInput).toHaveValue("new_user");

    const passwordInput = screen.getByTestId("input-password");
    fireEvent.change(passwordInput, { target: { value: "new_pass" } });

    expect(passwordInput).toHaveValue("new_pass");
  });

  it("displays description text", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      expect(
        screen.getByText(/Configure MQTT broker connection/),
      ).toBeInTheDocument();
    });
  });

  it("shows helper text for form fields", async () => {
    mockGetMqttConfig.mockResolvedValue(mockConfig);

    renderWithQueryClient(<MqttConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Format: mqtt:\/\/host:port/)).toBeInTheDocument();
      expect(screen.getByText(/Unique identifier/)).toBeInTheDocument();
      expect(screen.getByText(/Prefix for all MQTT topics/)).toBeInTheDocument();
    });
  });
});
