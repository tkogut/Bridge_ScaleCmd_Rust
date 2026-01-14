import { useQuery } from "@tanstack/react-query";
import { getMqttStatus } from "@/services/mqtt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Wifi, WifiOff } from "lucide-react";

const MqttStatusCard = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["mqttStatus"],
    queryFn: getMqttStatus,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const getConnectionStatus = () => {
    if (error) {
      return { text: "Error", color: "bg-red-500 hover:bg-red-600", icon: WifiOff };
    }
    if (!data) {
      return { text: "Unknown", color: "bg-yellow-500 hover:bg-yellow-600", icon: WifiOff };
    }
    if (data.connected) {
      return { text: "Connected", color: "bg-green-500 hover:bg-green-600", icon: Wifi };
    }
    return { text: "Disconnected", color: "bg-gray-500 hover:bg-gray-600", icon: WifiOff };
  };

  const getPublisherStatus = () => {
    if (!data) return "unknown";
    return data.publisher_status;
  };

  const getSubscriberStatus = () => {
    if (!data) return "unknown";
    return data.subscriber_status;
  };

  const statusInfo = getConnectionStatus();
  const StatusIcon = statusInfo.icon;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold">MQTT Status</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          <Badge className={statusInfo.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusInfo.text}
          </Badge>
        </div>

        {data && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Publisher:</p>
                <p className="font-medium capitalize">{getPublisherStatus()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Subscriber:</p>
                <p className="font-medium capitalize">{getSubscriberStatus()}</p>
              </div>
            </div>

            {data.last_connection && (
              <div className="text-xs text-muted-foreground">
                Last connection: {new Date(data.last_connection).toLocaleString()}
              </div>
            )}

            {data.error && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                <strong>Error:</strong> {data.error}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
            <strong>Connection Error:</strong> Cannot fetch MQTT status
          </div>
        )}

        {!data && !error && !isLoading && (
          <div className="text-sm text-muted-foreground">
            No MQTT status available
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MqttStatusCard;
