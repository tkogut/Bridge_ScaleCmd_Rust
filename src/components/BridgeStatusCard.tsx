import { useQuery } from "@tanstack/react-query";
import { getHealth, shutdownServer, startServer } from "@/services/bridge-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play, StopCircle, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { useState } from "react";

const BridgeStatusCard = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["bridgeHealth"],
    queryFn: getHealth,
    refetchInterval: 5000, // Odświeżanie co 5 sekund
  });
  const [isStopping, setIsStopping] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleServiceAction = async (action: "start" | "stop" | "restart") => {
    if (action === "start") {
      // If server is stopped, we can't call the API (chicken and egg problem)
      // Show instructions instead
      if (status === "Stopped" || error) {
        showError(
          "Cannot start server via API when it's stopped. Please start manually:\n" +
          "• From project root: .\\run-backend.ps1\n" +
          "• From src-rust: cargo run\n" +
          "• Or run: .\\src-rust\\target\\release\\scaleit-bridge.exe"
        );
        return;
      }
      
      // If server is running, we can try to use the API (for restart scenarios)
      setIsStarting(true);
      try {
        await startServer();
        showSuccess("Start command sent to Bridge service. Server is starting...");
        // Wait a bit and check status
        setTimeout(async () => {
          await refetch();
          setIsStarting(false);
        }, 3000);
        // Continue checking until server is confirmed running
        let checkCount = 0;
        const maxChecks = 15; // Check for up to 15 seconds
        const checkInterval = setInterval(async () => {
          checkCount++;
          const result = await refetch();
          if (result.data?.status === "OK" || checkCount >= maxChecks) {
            clearInterval(checkInterval);
            setIsStarting(false);
          }
        }, 1000);
      } catch (err) {
        setIsStarting(false);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        showError(`Failed to start server: ${errorMessage}. Please start manually using: .\\run-backend.ps1 or cargo run`);
      }
    } else if (action === "stop") {
      setIsStopping(true);
      try {
        await shutdownServer();
        showSuccess("Stop command sent to Bridge service. Server is shutting down...");
        
        // Wait a bit for server to shutdown, then check status
        setTimeout(async () => {
          const result = await refetch();
          if (result.data?.status === "STOPPED" || result.isError) {
            setIsStopping(false);
          }
        }, 2000);
        
        // Continue checking status every second
        let checkCount = 0;
        const maxChecks = 10; // Check for up to 10 seconds
        const checkInterval = setInterval(async () => {
          checkCount++;
          const result = await refetch();
          if (result.data?.status === "STOPPED" || result.isError || checkCount >= maxChecks) {
            clearInterval(checkInterval);
            setIsStopping(false);
          }
        }, 1000);
      } catch (err) {
        // Even if shutdown call fails, server might be stopping
        // Check status after a delay
        setTimeout(async () => {
          await refetch();
          setIsStopping(false);
        }, 2000);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        // Don't show error if it's a network error (server is stopping)
        if (!errorMessage.includes("Failed to fetch")) {
          showError(`Failed to stop server: ${errorMessage}`);
        } else {
          // Server is likely stopping, just wait and check
          setTimeout(async () => {
            await refetch();
          }, 3000);
        }
      }
    } else if (action === "restart") {
      // Restart = stop then start
      setIsStopping(true);
      setIsStarting(true);
      try {
        // First stop
        await shutdownServer();
        showSuccess("Restart initiated: Stopping server...");
        // Wait for server to stop
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Then start
        await startServer();
        showSuccess("Server restart: Starting...");
        // Wait and check status
        setTimeout(async () => {
          await refetch();
          setIsStopping(false);
          setIsStarting(false);
        }, 5000);
        // Continue checking
        let checkCount = 0;
        const maxChecks = 20;
        const checkInterval = setInterval(async () => {
          checkCount++;
          const result = await refetch();
          if (result.data?.status === "OK" || checkCount >= maxChecks) {
            clearInterval(checkInterval);
            setIsStopping(false);
            setIsStarting(false);
          }
        }, 1000);
      } catch (err) {
        setIsStopping(false);
        setIsStarting(false);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        showError(`Failed to restart server: ${errorMessage}`);
      }
    }
  };

  // Determine status based on health check response
  const getStatus = () => {
    if (error) {
      return { text: "Stopped", color: "bg-gray-500 hover:bg-gray-600" };
    }
    if (!data) {
      return { text: "Unknown", color: "bg-yellow-500 hover:bg-yellow-600" };
    }
    switch (data.status) {
      case "OK":
        return { text: "Running", color: "bg-green-500 hover:bg-green-600" };
      case "STOPPED":
        return { text: "Stopped", color: "bg-gray-500 hover:bg-gray-600" };
      case "BLOCKED":
        return { text: "Blocked", color: "bg-yellow-500 hover:bg-yellow-600" };
      case "ERROR":
        return { text: "Error", color: "bg-red-500 hover:bg-red-600" };
      default:
        return { text: "Unknown", color: "bg-yellow-500 hover:bg-yellow-600" };
    }
  };

  const statusInfo = getStatus();
  const status = statusInfo.text;
  const statusColor = statusInfo.color;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold">Bridge Status</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-muted-foreground" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          <Badge className={statusColor}>
            {status}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {data?.service || "ScaleIT Bridge"} v{data?.version || "N/A"}
          </p>
        </div>

        {error && (
          <div className="space-y-2">
            <div className="text-sm text-destructive">
              Connection Error: Cannot reach Bridge API at http://127.0.0.1:8080.
            </div>
            
            {/* Detect Mixed Content / Browser Blocking */}
            {(
              (error as any)?.message?.includes("Failed to fetch") ||
              (error as any)?.message?.includes("ERR_BLOCKED_BY_CLIENT") ||
              (error as any)?.message?.includes("NetworkError") ||
              (error as any)?.message?.includes("Network request failed")
            ) && window.location.protocol === "https:" ? (
              <div className="text-xs bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded">
                <strong className="text-yellow-800 dark:text-yellow-200">⚠️ Mixed Content Blocked</strong>
                <p className="mt-1 text-yellow-700 dark:text-yellow-300">
                  Twoja przeglądarka blokuje połączenie z HTTP (localhost) z HTTPS strony. Zezwól na komunikację:
                </p>
                <div className="mt-2 space-y-1 text-yellow-700 dark:text-yellow-300">
                  <p><strong>Chrome/Edge:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li>Kliknij ikonę kłódki w pasku adresu</li>
                    <li>Wybierz "Ustawienia witryny" → "Zezwól na niebezpieczne treści"</li>
                    <li>Lub kliknij "Zezwól" w dialogu, który się pojawił</li>
                  </ul>
                  <p className="mt-2"><strong>Brave:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li>Kliknij ikonę tarczy (Shields) obok paska adresu</li>
                    <li>Przełącz "Shields" na "Wyłączone" dla tej witryny</li>
                    <li>Lub przejdź do: <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">brave://settings/content</code></li>
                    <li>Dodaj wyjątek dla localhost w sekcji "Dodatkowe uprawnienia"</li>
                  </ul>
                  <p className="mt-2"><strong>Firefox:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li>Kliknij ikonę kłódki w pasku adresu</li>
                    <li>Kliknij "Wyłącz ochronę na tej stronie"</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                <strong>Server is stopped.</strong> To start it manually:
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>From project root: <code className="bg-background px-1 rounded">.\run-backend.ps1</code></li>
                  <li>From src-rust: <code className="bg-background px-1 rounded">cargo run</code></li>
                  <li>Or run executable: <code className="bg-background px-1 rounded">.\src-rust\target\release\scaleit-bridge.exe</code></li>
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Service Control</h4>
          <div className="flex space-x-2">
            <Button 
              size="sm" 
              onClick={() => handleServiceAction("start")}
              disabled={status === "Running" || isStopping || isStarting}
              title={status === "Stopped" ? "Server is stopped. Click to see manual start instructions." : "Start server"}
            >
              {isStarting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" /> Start
                </>
              )}
            </Button>
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={() => handleServiceAction("stop")}
              disabled={status === "Stopped" || isStopping}
            >
              {isStopping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Stopping...
                </>
              ) : (
                <>
                  <StopCircle className="mr-2 h-4 w-4" /> Stop
                </>
              )}
            </Button>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={() => handleServiceAction("restart")}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Restart
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BridgeStatusCard;