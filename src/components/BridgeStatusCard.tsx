import { useQuery } from "@tanstack/react-query";
import { getHealth } from "@/services/bridge-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play, StopCircle, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

const BridgeStatusCard = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["bridgeHealth"],
    queryFn: getHealth,
    refetchInterval: 5000, // Odświeżanie co 5 sekund
  });

  const handleServiceAction = (action: "start" | "stop" | "restart") => {
    // W prawdziwej aplikacji tutaj byłoby wywołanie API do kontroli usługi.
    // Ponieważ API Bridge nie udostępnia tych endpointów, symulujemy akcję.
    const actionName = action.charAt(0).toUpperCase() + action.slice(1);
    showSuccess(`${actionName} command sent to Bridge service.`);
    // Wymuszamy odświeżenie stanu po symulowanej akcji
    setTimeout(() => refetch(), 1000);
  };

  const status = data?.status === "OK" ? "Running" : "Error";
  const statusColor = data?.status === "OK" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600";

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
          <div className="text-sm text-destructive">
            Connection Error: Cannot reach Bridge API at http://localhost:8080.
          </div>
        )}

        <div className="pt-2 space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Service Control</h4>
          <div className="flex space-x-2">
            <Button 
              size="sm" 
              onClick={() => handleServiceAction("start")}
              disabled={status === "Running"}
            >
              <Play className="mr-2 h-4 w-4" /> Start
            </Button>
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={() => handleServiceAction("stop")}
              disabled={status === "Error"}
            >
              <StopCircle className="mr-2 h-4 w-4" /> Stop
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