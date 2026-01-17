import { useQuery } from "@tanstack/react-query";
import { getMqttStatus, getMqttDevices, MqttStatus, MqttDeviceInfo } from "@/services/mqtt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wifi, WifiOff, Loader2, Server, Database, Activity } from "lucide-react";

const MqttStatusCard = () => {
  const { 
    data: mqttStatus, 
    isLoading: isLoadingStatus, 
    error: statusError, 
    refetch: refetchStatus 
  } = useQuery({
    queryKey: ["mqttStatus"],
    queryFn: getMqttStatus,
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: 1,
  });

  const { 
    data: mqttDevices, 
    isLoading: isLoadingDevices,
  } = useQuery({
    queryKey: ["mqttDevices"],
    queryFn: getMqttDevices,
    refetchInterval: 10000,
    retry: 1,
  });

  const isLoading = isLoadingStatus || isLoadingDevices;

  // Determine status display
  const getStatusDisplay = (status: MqttStatus | undefined, error: Error | null) => {
    if (error) {
      return { 
        text: "Error", 
        color: "bg-red-500 hover:bg-red-600",
        icon: WifiOff,
        description: "Cannot connect to MQTT API"
      };
    }
    
    if (!status) {
      return { 
        text: "Unknown", 
        color: "bg-gray-500 hover:bg-gray-600",
        icon: WifiOff,
        description: "Loading status..."
      };
    }

    if (!status.enabled) {
      return { 
        text: "Disabled", 
        color: "bg-gray-500 hover:bg-gray-600",
        icon: WifiOff,
        description: "MQTT is disabled in configuration"
      };
    }

    if (status.connected) {
      return { 
        text: "Connected", 
        color: "bg-green-500 hover:bg-green-600",
        icon: Wifi,
        description: `Connected to ${status.broker_url}`
      };
    }

    return { 
      text: "Disconnected", 
      color: "bg-yellow-500 hover:bg-yellow-600",
      icon: WifiOff,
      description: "MQTT enabled but not connected"
    };
  };

  const statusDisplay = getStatusDisplay(mqttStatus, statusError as Error | null);
  const StatusIcon = statusDisplay.icon;

  // Format large numbers
  const formatNumber = (num: number | undefined | null): string => {
    if (num == null || num === undefined) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Server className="h-5 w-5" />
          MQTT Status
        </CardTitle>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => refetchStatus()} 
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center space-x-3">
          <Badge className={statusDisplay.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusDisplay.text}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {statusDisplay.description}
          </p>
        </div>

        {/* MQTT Details */}
        {mqttStatus && mqttStatus.enabled && (
          <div className="space-y-3 pt-2">
            {/* Broker Info */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Broker URL</span>
                <span className="font-mono text-xs truncate" title={mqttStatus.broker_url}>
                  {mqttStatus.broker_url}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Client ID</span>
                <span className="font-mono text-xs truncate" title={mqttStatus.client_id}>
                  {mqttStatus.client_id}
                </span>
              </div>
            </div>

            {/* Topic Prefix */}
            <div className="flex flex-col text-sm">
              <span className="text-xs text-muted-foreground">Topic Prefix</span>
              <span className="font-mono text-xs">{mqttStatus.topic_prefix}</span>
            </div>

            {/* Statistics */}
            <div className="pt-2 border-t">
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Database className="h-4 w-4" />
                History Statistics
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center p-2 bg-muted/50 rounded">
                  <span className="text-lg font-semibold">
                    {formatNumber(mqttStatus.devices_with_history)}
                  </span>
                  <span className="text-xs text-muted-foreground">Devices</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-muted/50 rounded">
                  <span className="text-lg font-semibold">
                    {formatNumber(mqttStatus.total_weight_readings)}
                  </span>
                  <span className="text-xs text-muted-foreground">Readings</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-muted/50 rounded">
                  <span className="text-lg font-semibold">
                    {formatNumber(mqttStatus.total_status_updates)}
                  </span>
                  <span className="text-xs text-muted-foreground">Updates</span>
                </div>
              </div>
            </div>

            {/* Recent Device Activity */}
            {mqttDevices && mqttDevices.devices.length > 0 && (
              <div className="pt-2 border-t">
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  Recent Device Activity
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {mqttDevices.devices.slice(0, 5).map((device: MqttDeviceInfo) => (
                    <div 
                      key={device.device_id} 
                      className="flex items-center justify-between text-xs p-1.5 bg-muted/30 rounded"
                    >
                      <span className="font-mono truncate max-w-[120px]" title={device.device_id}>
                        {device.device_id}
                      </span>
                      <div className="flex items-center gap-2">
                        {device.last_weight_reading && (
                          <span className="text-green-600 dark:text-green-400">
                            {device.last_weight_reading.weight.toFixed(1)} {device.last_weight_reading.unit}
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs py-0">
                          {device.weight_readings_count} readings
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Disabled State Info */}
        {mqttStatus && !mqttStatus.enabled && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
            <p className="font-medium mb-1">MQTT is disabled</p>
            <p className="text-xs">
              To enable MQTT, set <code className="bg-background px-1 rounded">MQTT_ENABLED=true</code> in 
              the environment variables and restart the Bridge service.
            </p>
          </div>
        )}

        {/* Error State */}
        {statusError && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
            <p className="font-medium">Error loading MQTT status</p>
            <p className="text-xs mt-1">
              {(statusError as Error).message}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MqttStatusCard;
