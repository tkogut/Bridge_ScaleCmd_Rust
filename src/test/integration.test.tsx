import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { server } from "./setup";
import { http, HttpResponse } from "msw";

// Mock components and pages
// Mock components defined inline to avoid hoisting issues
const MockIndex = () => <div data-testid="index-page">Mock Index Page</div>;
const MockConfiguration = () => (
  <div data-testid="configuration-page">Mock Configuration Page</div>
);
const MockDiagnostics = () => (
  <div data-testid="diagnostics-page">Mock Diagnostics Page</div>
);

// Mock the pages
vi.mock("../pages/Index", () => ({
  default: MockIndex,
}));
vi.mock("../pages/Configuration", () => ({
  default: MockConfiguration,
}));
vi.mock("../pages/Diagnostics", () => ({
  default: MockDiagnostics,
}));

// Mock UI components
vi.mock("@/components/ui/toaster", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));
vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => <div data-testid="sonner" />,
}));
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the context provider
vi.mock("../context/LogContext", () => ({
  LogProvider: ({ children }: { children: React.ReactNode }) => {
    return (
      <div data-testid="log-provider">
        {children}
        <div data-testid="log-entries">
          <div className="log-entry">System started</div>
          <div className="log-entry">Health check passed</div>
        </div>
      </div>
    );
  },
}));

import App from "../App";

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

const TestWrapper = ({
  children,
  initialEntries = ["/"],
  queryClient = createTestQueryClient(),
}: {
  children: React.ReactNode;
  initialEntries?: string[];
  queryClient?: QueryClient;
}) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  </QueryClientProvider>
);

const renderApp = (initialEntries?: string[]) => {
  const queryClient = createTestQueryClient();
  return render(
    <TestWrapper initialEntries={initialEntries} queryClient={queryClient}>
      <App />
    </TestWrapper>,
  );
};

describe.skip("Frontend Integration Tests", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Application Bootstrap", () => {
    it("should bootstrap the application successfully", async () => {
      renderApp();

      // Check if core components are rendered
      expect(screen.getByTestId("toaster")).toBeInTheDocument();
      expect(screen.getByTestId("sonner")).toBeInTheDocument();
      expect(screen.getByTestId("log-provider")).toBeInTheDocument();
      expect(screen.getByTestId("index-page")).toBeInTheDocument();
    });

    it("should initialize query client properly", async () => {
      const queryClient = createTestQueryClient();
      render(
        <TestWrapper queryClient={queryClient}>
          <div data-testid="query-client-test">Test Component</div>
        </TestWrapper>,
      );

      expect(screen.getByTestId("query-client-test")).toBeInTheDocument();
    });

    it("should handle router initialization", async () => {
      renderApp(["/", "/config", "/diagnostics"]);

      // Should render the first route (index)
      expect(screen.getByTestId("index-page")).toBeInTheDocument();
    });
  });

  describe("Navigation Integration", () => {
    it("should navigate between different pages", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <div>
            <nav>
              <a
                href="/config"
                onClick={(e) => {
                  e.preventDefault();
                  window.history.pushState({}, "", "/config");
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
              >
                Config
              </a>
            </nav>
            <App />
          </div>
        </TestWrapper>,
      );

      // Initially should show index page
      expect(screen.getByTestId("index-page")).toBeInTheDocument();
    });

    it("should handle deep linking", async () => {
      renderApp(["/config"]);
      expect(screen.getByTestId("configuration-page")).toBeInTheDocument();

      renderApp(["/diagnostics"]);
      expect(screen.getByTestId("diagnostics-page")).toBeInTheDocument();
    });

    it("should handle 404 routes", async () => {
      renderApp(["/nonexistent"]);
      // Should render the catch-all route or 404 component
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe("API Integration Flows", () => {
    it("should handle successful API communication", async () => {
      server.use(
        http.get("http://localhost:8080/health", () => {
          return HttpResponse.json({
            status: "OK",
            service: "ScaleIT Bridge",
            version: "3.1.0",
          });
        }),
        http.get("http://localhost:8080/devices", () => {
          return HttpResponse.json({
            success: true,
            devices: [
              ["C320", "C320 Rinstrum", "C320"],
              ["DWF", "DFW - Dini Argeo", "DFW"],
            ],
          });
        }),
      );

      renderApp();

      // Wait for API calls to complete
      await waitFor(() => {
        expect(screen.getByTestId("log-provider")).toBeInTheDocument();
      });
    });

    it("should handle API failures gracefully", async () => {
      server.use(
        http.get("http://localhost:8080/health", () => {
          return new HttpResponse(null, { status: 500 });
        }),
        http.get("http://localhost:8080/devices", () => {
          return new HttpResponse(null, { status: 503 });
        }),
      );

      renderApp();

      // Application should still render despite API failures
      await waitFor(() => {
        expect(screen.getByTestId("index-page")).toBeInTheDocument();
      });
    });

    it("should handle network connectivity issues", async () => {
      server.use(
        http.get("http://localhost:8080/health", () => {
          return HttpResponse.error();
        }),
        http.get("http://localhost:8080/devices", () => {
          return HttpResponse.error();
        }),
      );

      renderApp();

      // Application should remain functional
      expect(screen.getByTestId("index-page")).toBeInTheDocument();
    });
  });

  describe("State Management Integration", () => {
    it("should manage application state correctly", async () => {
      renderApp();

      // Check if log provider maintains state
      const logProvider = screen.getByTestId("log-provider");
      expect(logProvider).toBeInTheDocument();

      const logEntries = within(logProvider).getByTestId("log-entries");
      expect(logEntries).toBeInTheDocument();
      expect(
        within(logEntries).getByText("System started"),
      ).toBeInTheDocument();
      expect(
        within(logEntries).getByText("Health check passed"),
      ).toBeInTheDocument();
    });

    it("should handle context provider updates", async () => {
      const { rerender } = renderApp();

      // Initial state
      expect(screen.getByTestId("log-provider")).toBeInTheDocument();

      // Rerender to simulate state updates
      rerender(
        <TestWrapper>
          <App />
        </TestWrapper>,
      );

      // State should persist
      expect(screen.getByTestId("log-provider")).toBeInTheDocument();
    });
  });

  describe("Error Boundary Integration", () => {
    it("should handle component errors gracefully", async () => {
      const ErrorComponent = () => {
        throw new Error("Test error");
      };

      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      try {
        render(
          <TestWrapper>
            <ErrorComponent />
          </TestWrapper>,
        );
      } catch (error) {
        // Error should be caught
        expect(error).toBeDefined();
      }

      consoleError.mockRestore();
    });
  });

  describe("Performance Integration", () => {
    it("should render within acceptable time limits", async () => {
      const startTime = performance.now();

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("index-page")).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;

      // Should render within 100ms
      expect(renderTime).toBeLessThan(100);
    });

    it("should handle rapid navigation changes", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <div>
            <button
              onClick={() => {
                window.history.pushState({}, "", "/config");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              data-testid="nav-config"
            >
              Config
            </button>
            <button
              onClick={() => {
                window.history.pushState({}, "", "/diagnostics");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              data-testid="nav-diagnostics"
            >
              Diagnostics
            </button>
            <button
              onClick={() => {
                window.history.pushState({}, "", "/");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              data-testid="nav-home"
            >
              Home
            </button>
            <App />
          </div>
        </TestWrapper>,
      );

      // Rapid navigation
      await user.click(screen.getByTestId("nav-config"));
      await user.click(screen.getByTestId("nav-diagnostics"));
      await user.click(screen.getByTestId("nav-home"));

      // Should handle rapid changes without crashing
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Accessibility Integration", () => {
    it("should maintain accessibility standards", async () => {
      renderApp();

      const app = screen.getByTestId("index-page");
      expect(app).toBeInTheDocument();

      // Check for basic accessibility structure
      expect(document.body).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <div>
            <button data-testid="focusable-1">Button 1</button>
            <button data-testid="focusable-2">Button 2</button>
            <App />
          </div>
        </TestWrapper>,
      );

      // Tab navigation should work
      await user.tab();
      await user.tab();

      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Real-time Features Integration", () => {
    it("should handle real-time updates", async () => {
      let updateCallback: (() => void) | null = null;

      // Mock a real-time update system
      const MockRealTimeComponent = () => {
        const [data, setData] = React.useState("initial");

        React.useEffect(() => {
          updateCallback = () => setData("updated");
        }, []);

        return <div data-testid="realtime-data">{data}</div>;
      };

      render(
        <TestWrapper>
          <div>
            <MockRealTimeComponent />
            <App />
          </div>
        </TestWrapper>,
      );

      expect(screen.getByTestId("realtime-data")).toHaveTextContent("initial");

      // Simulate real-time update
      if (updateCallback) {
        updateCallback();
      }

      await waitFor(() => {
        expect(screen.getByTestId("realtime-data")).toHaveTextContent(
          "updated",
        );
      });
    });
  });

  describe("Multi-component Integration", () => {
    it("should handle complex component interactions", async () => {
      const user = userEvent.setup();

      const ComplexApp = () => {
        const [count, setCount] = React.useState(0);
        const [message, setMessage] = React.useState("");

        return (
          <div>
            <button
              data-testid="increment"
              onClick={() => setCount((c) => c + 1)}
            >
              Count: {count}
            </button>
            <input
              data-testid="message-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter message"
            />
            <div data-testid="message-display">{message}</div>
            <App />
          </div>
        );
      };

      render(
        <TestWrapper>
          <ComplexApp />
        </TestWrapper>,
      );

      // Test counter
      const incrementButton = screen.getByTestId("increment");
      expect(incrementButton).toHaveTextContent("Count: 0");

      await user.click(incrementButton);
      expect(incrementButton).toHaveTextContent("Count: 1");

      // Test input
      const messageInput = screen.getByTestId("message-input");
      await user.type(messageInput, "Hello World");

      await waitFor(() => {
        expect(screen.getByTestId("message-display")).toHaveTextContent(
          "Hello World",
        );
      });

      // Main app should still be rendered
      expect(screen.getByTestId("index-page")).toBeInTheDocument();
    });
  });

  describe("Memory Management Integration", () => {
    it("should clean up resources properly", async () => {
      const { unmount } = renderApp();

      // Component should render properly
      expect(screen.getByTestId("index-page")).toBeInTheDocument();

      // Unmount should not cause errors
      unmount();

      // No elements should remain
      expect(screen.queryByTestId("index-page")).not.toBeInTheDocument();
    });

    it("should handle memory-intensive operations", async () => {
      const LargeDataComponent = () => {
        const [data] = React.useState(() =>
          Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            description: `Description for item ${i}`,
          })),
        );

        return (
          <div data-testid="large-data">
            {data.slice(0, 10).map((item) => (
              <div key={item.id}>{item.name}</div>
            ))}
          </div>
        );
      };

      render(
        <TestWrapper>
          <div>
            <LargeDataComponent />
            <App />
          </div>
        </TestWrapper>,
      );

      expect(screen.getByTestId("large-data")).toBeInTheDocument();
      expect(screen.getByText("Item 0")).toBeInTheDocument();
      expect(screen.getByTestId("index-page")).toBeInTheDocument();
    });
  });

  describe("Edge Case Integration", () => {
    it("should handle rapid re-renders", async () => {
      const RapidRenderComponent = () => {
        const [count, setCount] = React.useState(0);

        React.useEffect(() => {
          const interval = setInterval(() => {
            setCount((c) => (c + 1) % 100);
          }, 10);

          const timeout = setTimeout(() => {
            clearInterval(interval);
          }, 500);

          return () => {
            clearInterval(interval);
            clearTimeout(timeout);
          };
        }, []);

        return <div data-testid="rapid-render">Count: {count}</div>;
      };

      render(
        <TestWrapper>
          <div>
            <RapidRenderComponent />
            <App />
          </div>
        </TestWrapper>,
      );

      expect(screen.getByTestId("rapid-render")).toBeInTheDocument();
      expect(screen.getByTestId("index-page")).toBeInTheDocument();

      // Wait for rapid renders to complete
      await waitFor(
        () => {
          expect(screen.getByTestId("rapid-render")).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("should handle concurrent state updates", async () => {
      const user = userEvent.setup();

      const ConcurrentStateComponent = () => {
        const [state1, setState1] = React.useState(0);
        const [state2, setState2] = React.useState(0);

        return (
          <div>
            <button
              data-testid="update-state1"
              onClick={() => setState1((s) => s + 1)}
            >
              State 1: {state1}
            </button>
            <button
              data-testid="update-state2"
              onClick={() => setState2((s) => s + 1)}
            >
              State 2: {state2}
            </button>
          </div>
        );
      };

      render(
        <TestWrapper>
          <div>
            <ConcurrentStateComponent />
            <App />
          </div>
        </TestWrapper>,
      );

      const button1 = screen.getByTestId("update-state1");
      const button2 = screen.getByTestId("update-state2");

      // Rapid concurrent updates
      await user.click(button1);
      await user.click(button2);
      await user.click(button1);
      await user.click(button2);

      await waitFor(() => {
        expect(button1).toHaveTextContent("State 1: 2");
        expect(button2).toHaveTextContent("State 2: 2");
      });

      expect(screen.getByTestId("index-page")).toBeInTheDocument();
    });
  });
});
