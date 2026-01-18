import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMqttDevices,
  getMqttHistory,
  getMqttLatest,
  getMqttStats,
  deleteMqttHistory,
  MqttDeviceInfo,
  WeightReadingEntry,
} from "@/services/mqtt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Trash2,
  RefreshCw,
  Activity,
  Clock,
  Scale,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MqttConfigPanel = () => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch devices with MQTT history
  const {
    data: devicesData,
    isLoading: isLoadingDevices,
    error: devicesError,
    refetch: refetchDevices,
  } = useQuery({
    queryKey: ["mqttDevices"],
    queryFn: getMqttDevices,
    refetchInterval: 15000,
  });

  // Fetch latest data for selected device
  const {
    data: latestData,
    isLoading: isLoadingLatest,
  } = useQuery({
    queryKey: ["mqttLatest", selectedDeviceId],
    queryFn: () => selectedDeviceId ? getMqttLatest(selectedDeviceId) : Promise.resolve(null),
    enabled: !!selectedDeviceId,
    refetchInterval: 5000,
  });

  // Fetch stats for selected device
  const {
    data: statsData,
    isLoading: isLoadingStats,
  } = useQuery({
    queryKey: ["mqttStats", selectedDeviceId],
    queryFn: () => selectedDeviceId ? getMqttStats(selectedDeviceId) : Promise.resolve(null),
    enabled: !!selectedDeviceId,
    refetchInterval: 30000,
  });

  // Fetch history for selected device
  const {
    data: historyData,
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["mqttHistory", selectedDeviceId],
    queryFn: () => selectedDeviceId ? getMqttHistory(selectedDeviceId, { limit: 20 }) : Promise.resolve(null),
    enabled: !!selectedDeviceId,
  });

  // Delete history mutation
  const deleteHistoryMutation = useMutation({
    mutationFn: (deviceId: string) => deleteMqttHistory(deviceId),
    onSuccess: () => {
      toast({
        title: "History Deleted",
        description: `MQTT history for ${selectedDeviceId} has been deleted.`,
      });
      queryClient.invalidateQueries({ queryKey: ["mqttDevices"] });
      queryClient.invalidateQueries({ queryKey: ["mqttHistory", selectedDeviceId] });
      queryClient.invalidateQueries({ queryKey: ["mqttStats", selectedDeviceId] });
      queryClient.invalidateQueries({ queryKey: ["mqttLatest", selectedDeviceId] });
      queryClient.invalidateQueries({ queryKey: ["mqttStatus"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const devices = React.useMemo(() => devicesData?.devices || [], [devicesData?.devices]);
  const isLoading = isLoadingDevices || isLoadingLatest || isLoadingStats || isLoadingHistory;

  // Auto-select first device if none selected
  React.useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].device_id);
    }
  }, [devices, selectedDeviceId]);

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Format relative time
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Render weight reading
  const renderWeightReading = (reading: WeightReadingEntry) => (
    <div
      key={`${reading.device_id}-${reading.timestamp}`}
      className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm"
    >
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{reading.device_id}</span>
      </div>
      <div className="text-primary font-mono font-bold">
        {typeof reading.weight === 'number' ? reading.weight.toFixed(2) : "0.00"} {reading.unit || "kg"}
      </div>
      <div className="text-xs text-muted-foreground italic">
        {reading.is_stable ? "stable" : "unstable"}
      </div>
    </div>
  );

  if (isLoadingDevices && !devicesData) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading MQTT data...</span>
        </CardContent>
      </Card>
    );
  }

  if (devicesError) {
    return (
      <Card className="h-full">
        <CardContent className="p-8">
          <div className="text-destructive p-4 border border-destructive/50 rounded-lg">
            <p className="font-semibold">Error loading MQTT devices</p>
            <p className="mt-2">{(devicesError as Error).message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          MQTT History
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            refetchDevices();
            if (selectedDeviceId) refetchHistory();
          }}
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
        {/* Device Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">
            Select Device
          </label>
          {devices.length === 0 ? (
            <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded">
              No devices with MQTT history found. Send some MQTT messages to see history here.
            </div>
          ) : (
            <Select
              value={selectedDeviceId || ""}
              onValueChange={setSelectedDeviceId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device: MqttDeviceInfo) => (
                  <SelectItem key={device.device_id} value={device.device_id}>
                    <div className="flex items-center gap-2">
                      <span>{device.device_id}</span>
                      <Badge variant="secondary" className="text-xs">
                        {device.weight_readings_count} readings
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedDeviceId && (
          <>
            <Separator />

            {/* Latest Reading */}
            {latestData?.latest_weight && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Latest Reading</h4>
                <div className="p-4 bg-gradient-to-r from-green-500/10 to-green-500/5 rounded-lg border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Scale className="h-8 w-8 text-green-600 dark:text-green-400" />
                      <div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {typeof latestData.latest_weight.weight === 'number' ? latestData.latest_weight.weight.toFixed(2) : "0"} {latestData.latest_weight.unit}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {latestData.latest_weight.is_stable ? "Stable" : "Unstable"} · {latestData.latest_weight.timestamp ? formatRelativeTime(latestData.latest_weight.timestamp) : "unknown"}
                        </div>
                      </div>
                    </div>
                    {latestData.latest_status && (
                      <Badge
                        variant={latestData.latest_status.status === "connected" ? "default" : "secondary"}
                      >
                        {latestData.latest_status.status}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Statistics */}
            {statsData && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Statistics</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-xs text-muted-foreground">Weight Readings</div>
                    <div className="font-semibold">{statsData.weight_readings_count}</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-xs text-muted-foreground">Status Updates</div>
                    <div className="font-semibold">{statsData.status_updates_count}</div>
                  </div>
                  {latestData.latest_weight && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm">
                        <strong>Latest Weight:</strong> {typeof latestData.latest_weight.weight === 'number' ? latestData.latest_weight.weight.toFixed(2) : "0.00"} {latestData.latest_weight.unit || "kg"}
                        {latestData.latest_weight.is_stable && (
                          <Badge variant="secondary" className="ml-2 text-xs">Stable</Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {statsData.first_weight_reading && (
                    <div className="p-2 bg-muted/50 rounded col-span-2">
                      <div className="text-xs text-muted-foreground">First Reading</div>
                      <div className="text-xs font-mono">
                        {new Date(statsData.first_weight_reading).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* History */}
            {Array.isArray(historyData?.weight_readings) && historyData.weight_readings.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-muted-foreground">Recent History</h4>
                  <span className="text-xs text-muted-foreground">
                    Showing {historyData.weight_readings.length} of {historyData.total_weight_readings}
                  </span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {historyData.weight_readings.map(renderWeightReading)}
                </div>
              </div>
            )}

            <Separator />

            {/* Delete History Button */}
            <div className="pt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteHistoryMutation.isPending}
                  >
                    {deleteHistoryMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete History
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Delete MQTT History
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete all MQTT history for device{" "}
                      <span className="font-semibold">{selectedDeviceId}</span>?
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => selectedDeviceId && deleteHistoryMutation.mutate(selectedDeviceId)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MqttConfigPanel;
