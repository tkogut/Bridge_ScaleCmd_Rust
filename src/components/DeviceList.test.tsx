import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DeviceList from "./DeviceList";

// Mock the UI components
vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="card">
      {children}
    </div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, variant }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid="button"
      data-variant={variant}
    >
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Scale: () => <svg data-testid="scale-icon" />,
  Wifi: () => <svg data-testid="wifi-icon" />,
  WifiOff: () => <svg data-testid="wifi-off-icon" />,
  RefreshCw: () => <svg data-testid="refresh-icon" />,
  Loader2: () => <svg data-testid="loader2-icon" />,
  Edit: () => <svg data-testid="edit-icon" />,
  Trash2: () => <svg data-testid="trash2-icon" />,
  PlusCircle: () => <svg data-testid="plus-circle-icon" />,
  CheckCircle: () => <svg data-testid="check-circle-icon" />,
  XCircle: () => <svg data-testid="x-circle-icon" />,
  Clock: () => <svg data-testid="clock-icon" />,
  Settings: () => <svg data-testid="settings-icon" />,
  Cable: () => <svg data-testid="cable-icon" />,
  Zap: () => <svg data-testid="zap-icon" />,
}));

// Mock the API service
vi.mock("@/services/bridge-api", () => ({
  getAllDeviceConfigs: vi.fn(),
  deleteDeviceConfig: vi.fn(),
  saveDeviceConfig: vi.fn(),
}));

// Mock missing UI components
vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: any) => <table data-testid="table">{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children, className, colSpan }: any) => (
    <td className={className} colSpan={colSpan}>
      {children}
    </td>
  ),
  TableHead: ({ children, className }: any) => (
    <th className={className}>{children}</th>
  ),
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, disabled }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      data-testid="switch"
    />
  ),
}));

vi.mock("@/utils/toast", () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

import {
  getAllDeviceConfigs,
  deleteDeviceConfig,
  saveDeviceConfig,
} from "@/services/bridge-api";

const mockGetAllDeviceConfigs = vi.mocked(getAllDeviceConfigs);
const mockDeleteDeviceConfig = vi.mocked(deleteDeviceConfig);
const mockSaveDeviceConfig = vi.mocked(saveDeviceConfig);

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

describe("DeviceList Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    mockGetAllDeviceConfigs.mockReturnValue(
      new Promise(() => {}), // Never resolves to show loading state
    );

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={() => {}} />);
    expect(
      screen.getByText("Loading device configurations..."),
    ).toBeInTheDocument();
  });

  it("renders device list when data is loaded", async () => {
    const mockConfigs = {
      C320: {
        name: "C320 Rinstrum",
        manufacturer: "Rinstrum",
        model: "C320",
        protocol: "RINCMD",
        connection: {
          connection_type: "Tcp" as const,
          host: "192.168.1.100",
          port: 4001,
          timeout_ms: 5000,
        },
        commands: {
          readGross: "readGross",
          readNet: "readNet",
          tare: "tare",
          zero: "zero",
        },
        enabled: true,
      },
      DWF: {
        name: "DFW - Dini Argeo",
        manufacturer: "Dini Argeo",
        model: "DFW",
        protocol: "ASCII",
        connection: {
          connection_type: "Serial" as const,
          port: "COM1",
          baud_rate: 9600,
          timeout_ms: 1000,
        },
        commands: {
          readGross: "W",
          readNet: "N",
          tare: "T",
          zero: "Z",
        },
        enabled: true,
      },
    };

    mockGetAllDeviceConfigs.mockResolvedValue(mockConfigs);

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("C320 Rinstrum")).toBeInTheDocument();
      expect(screen.getByText("DFW - Dini Argeo")).toBeInTheDocument();
    });
  });

  it("displays device information correctly", async () => {
    const mockConfigs = {
      C320: {
        name: "C320 Rinstrum Scale",
        manufacturer: "Rinstrum",
        model: "Rinstrum C320",
        protocol: "RINCMD",
        connection: {
          connection_type: "Tcp" as const,
          host: "192.168.1.100",
          port: 4001,
          timeout_ms: 5000,
        },
        commands: {},
        enabled: true,
      },
    };

    mockGetAllDeviceConfigs.mockResolvedValue(mockConfigs);

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("C320 Rinstrum Scale")).toBeInTheDocument();
      expect(screen.getByText("Rinstrum C320")).toBeInTheDocument();
      expect(screen.getByText("C320")).toBeInTheDocument();
    });
  });

  it("shows enabled badge for active devices", async () => {
    const mockConfigs = {
      C320: {
        name: "C320 Rinstrum",
        manufacturer: "Rinstrum",
        model: "C320",
        protocol: "RINCMD",
        connection: {
          connection_type: "Tcp" as const,
          host: "192.168.1.100",
          port: 4001,
          timeout_ms: 5000,
        },
        commands: {},
        enabled: true,
      },
    };

    mockGetAllDeviceConfigs.mockResolvedValue(mockConfigs);

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={() => {}} />);

    await waitFor(() => {
      const badge = screen.getByTestId("badge");
      expect(badge).toHaveTextContent("Enabled");
      expect(badge).toHaveAttribute("data-variant", "default");
    });
  });

  it("renders edit and delete buttons", async () => {
    const mockConfigs = {
      C320: {
        name: "C320 Rinstrum",
        manufacturer: "Rinstrum",
        model: "C320",
        protocol: "RINCMD",
        connection: {
          connection_type: "Tcp" as const,
          host: "192.168.1.100",
          port: 4001,
          timeout_ms: 5000,
        },
        commands: {},
        enabled: true,
      },
    };

    mockGetAllDeviceConfigs.mockResolvedValue(mockConfigs);

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("edit-icon")).toBeInTheDocument();
      expect(screen.getByTestId("trash2-icon")).toBeInTheDocument();
    });
  });

  it("calls onEdit when edit button is clicked", async () => {
    const mockConfigs = {
      C320: {
        name: "C320 Rinstrum",
        manufacturer: "Rinstrum",
        model: "C320",
        protocol: "RINCMD",
        connection: {
          connection_type: "Tcp" as const,
          host: "192.168.1.100",
          port: 4001,
          timeout_ms: 5000,
        },
        commands: {},
        enabled: true,
      },
    };

    const onEditMock = vi.fn();
    mockGetAllDeviceConfigs.mockResolvedValue(mockConfigs);

    renderWithQueryClient(<DeviceList onEdit={onEditMock} onAdd={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("edit-icon")).toBeInTheDocument();
    });

    const editButton = screen.getByTestId("edit-icon").closest("button");
    fireEvent.click(editButton!);

    expect(onEditMock).toHaveBeenCalledWith("C320", mockConfigs["C320"]);
  });

  it("calls deleteDeviceConfig when delete button is clicked", async () => {
    const mockConfigs = {
      C320: {
        name: "C320 Rinstrum",
        manufacturer: "Rinstrum",
        model: "C320",
        protocol: "RINCMD",
        connection: {
          connection_type: "Tcp" as const,
          host: "192.168.1.100",
          port: 4001,
          timeout_ms: 5000,
        },
        commands: {},
        enabled: true,
      },
    };

    // Mock window.confirm
    global.confirm = vi.fn().mockReturnValue(true);

    mockGetAllDeviceConfigs.mockResolvedValue(mockConfigs);
    mockDeleteDeviceConfig.mockResolvedValue(undefined);

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("trash2-icon")).toBeInTheDocument();
    });

    const deleteButton = screen.getByTestId("trash2-icon").closest("button");
    fireEvent.click(deleteButton!);

    await waitFor(() => {
      expect(mockDeleteDeviceConfig).toHaveBeenCalledWith(
        "C320",
        expect.any(Object),
      );
    });
  });

  it("toggles device enabled state", async () => {
    const mockConfigs = {
      C320: {
        name: "C320 Rinstrum",
        manufacturer: "Rinstrum",
        model: "C320",
        protocol: "RINCMD",
        connection: {
          connection_type: "Tcp" as const,
          host: "192.168.1.100",
          port: 4001,
          timeout_ms: 5000,
        },
        commands: {},
        enabled: true,
      },
    };

    mockGetAllDeviceConfigs.mockResolvedValue(mockConfigs);
    mockSaveDeviceConfig.mockResolvedValue(undefined);

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("switch")).toBeInTheDocument();
    });

    const switchElement = screen.getByTestId("switch");
    fireEvent.click(switchElement);

    await waitFor(() => {
      expect(mockSaveDeviceConfig).toHaveBeenCalledWith("C320", {
        ...mockConfigs["C320"],
        enabled: false,
      });
    });
  });

  it("shows error state when device fetch fails", async () => {
    mockGetAllDeviceConfigs.mockRejectedValue(
      new Error("Failed to fetch devices"),
    );

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText(/error.*loading.*configurations/i),
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when no devices are available", async () => {
    const mockConfigs = {};

    mockGetAllDeviceConfigs.mockResolvedValue(mockConfigs);

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/no.*devices.*configured/i)).toBeInTheDocument();
    });
  });

  it("calls onAdd when add button is clicked", async () => {
    const mockConfigs = {};
    const onAddMock = vi.fn();

    mockGetAllDeviceConfigs.mockResolvedValue(mockConfigs);

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={onAddMock} />);

    await waitFor(() => {
      expect(screen.getByTestId("plus-circle-icon")).toBeInTheDocument();
    });

    const addButton = screen.getByTestId("plus-circle-icon").closest("button");
    fireEvent.click(addButton!);

    expect(onAddMock).toHaveBeenCalled();
  });

  it("displays correct connection type", async () => {
    const mockConfigs = {
      C320: {
        name: "C320 Rinstrum",
        manufacturer: "Rinstrum",
        model: "C320",
        protocol: "RINCMD",
        connection: {
          connection_type: "Tcp" as const,
          host: "192.168.1.100",
          port: 4001,
          timeout_ms: 5000,
        },
        commands: {},
        enabled: true,
      },
    };

    mockGetAllDeviceConfigs.mockResolvedValue(mockConfigs);

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("192.168.1.100:4001")).toBeInTheDocument();
    });
  });

  it("handles multiple devices correctly", async () => {
    const mockConfigs = {
      C320: {
        name: "C320 Rinstrum",
        manufacturer: "Rinstrum",
        model: "C320",
        protocol: "RINCMD",
        connection: {
          connection_type: "Tcp" as const,
          host: "192.168.1.100",
          port: 4001,
          timeout_ms: 5000,
        },
        commands: {},
        enabled: true,
      },
      DWF: {
        name: "DFW - Dini Argeo",
        manufacturer: "Dini Argeo",
        model: "DFW",
        protocol: "ASCII",
        connection: {
          connection_type: "Serial" as const,
          port: "COM1",
          baud_rate: 9600,
          timeout_ms: 1000,
        },
        commands: {},
        enabled: true,
      },
      CUSTOM: {
        name: "Custom Scale",
        manufacturer: "Custom Corp",
        model: "Custom Model",
        protocol: "CUSTOM",
        connection: {
          connection_type: "Tcp" as const,
          host: "10.0.0.1",
          port: 8080,
          timeout_ms: 2000,
        },
        commands: {},
        enabled: false,
      },
    };

    mockGetAllDeviceConfigs.mockResolvedValue(mockConfigs);

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("C320 Rinstrum")).toBeInTheDocument();
      expect(screen.getByText("DFW - Dini Argeo")).toBeInTheDocument();
      expect(screen.getByText("Custom Scale")).toBeInTheDocument();
    });

    // Each device should have its own edit and delete buttons
    const editButtons = screen.getAllByTestId("edit-icon");
    expect(editButtons).toHaveLength(3);

    const deleteButtons = screen.getAllByTestId("trash2-icon");
    expect(deleteButtons).toHaveLength(3);
  });

  it("displays disabled badge for disabled devices", async () => {
    const mockConfigs = {
      C320: {
        name: "C320 Rinstrum",
        manufacturer: "Rinstrum",
        model: "C320",
        protocol: "RINCMD",
        connection: {
          connection_type: "Tcp" as const,
          host: "192.168.1.100",
          port: 4001,
          timeout_ms: 5000,
        },
        commands: {},
        enabled: false,
      },
    };

    mockGetAllDeviceConfigs.mockResolvedValue(mockConfigs);

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={() => {}} />);

    await waitFor(() => {
      const badge = screen.getByTestId("badge");
      expect(badge).toHaveTextContent("Disabled");
      expect(badge).toHaveAttribute("data-variant", "secondary");
    });
  });

  it("displays serial connection information correctly", async () => {
    const mockConfigs = {
      DWF: {
        name: "DFW - Dini Argeo",
        manufacturer: "Dini Argeo",
        model: "DFW",
        protocol: "ASCII",
        connection: {
          connection_type: "Serial" as const,
          port: "COM3",
          baud_rate: 9600,
          timeout_ms: 1000,
        },
        commands: {},
        enabled: true,
      },
    };

    mockGetAllDeviceConfigs.mockResolvedValue(mockConfigs);

    renderWithQueryClient(<DeviceList onEdit={() => {}} onAdd={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("COM3 (9600 baud)")).toBeInTheDocument();
    });
  });
});
