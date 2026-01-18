import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDevices, getAllDeviceConfigs, getHealth, testDeviceConnection, DeviceConfig, DeviceId } from "@/services/bridge-api";
import { getMqttLatest, getMqttStatus, MqttLatestResponse, MqttStatus } from "@/services/mqtt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Wifi, WifiOff, Cable, Clock, Settings, Zap, TestTube, Database, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const DiagnosticsPanel = () => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<DeviceId | undefined>(undefined);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  // 1. Pobieranie listy urządzeń (dla Selecta)
  const { data: devicesData, isLoading: isLoadingDevices, error: devicesError } = useQuery({
    queryKey: ["devices"],
    queryFn: getDevices,
    staleTime: Infinity,
  });

  // 2. Pobieranie pełnej konfiguracji (dla szczegółów - teraz zintegrowana)
  const { data: configs, isLoading: isLoadingConfigs, error: configsError } = useQuery({
    queryKey: ["deviceConfigs"],
    queryFn: getAllDeviceConfigs,
    staleTime: Infinity,
  });

  // 4. Sprawdzanie statusu serwera
  // 4. Mqtt system status
  const { data: mqttStatus } = useQuery({
    queryKey: ["mqttStatus"],
    queryFn: getMqttStatus,
    refetchInterval: 5000,
  });

  // 5. Latest MQTT telemetry for selected device
  const { data: mqttLatest, refetch: refetchMqttLatest } = useQuery({
    queryKey: ["mqttLatest", selectedDeviceId],
    queryFn: () => selectedDeviceId ? getMqttLatest(selectedDeviceId) : Promise.resolve(null),
    enabled: !!selectedDeviceId && !!mqttStatus?.enabled,
    refetchInterval: 2000, // Frequent polling for "live" feel in diagnostics
  });

  const { data: healthData, isLoading: isLoadingHealth } = useQuery({
    queryKey: ["bridgeHealth"],
    queryFn: getHealth,
    refetchInterval: 5000,
  });

  const devices = React.useMemo(() => devicesData?.devices || [], [devicesData]);

  // Sprawdź czy serwer działa
  const isServerRunning = healthData?.status === "OK";

  // Sprawdź czy wybrane urządzenie jest w liście aktywnych urządzeń
  const isDeviceActive = useMemo(() => {
    if (!selectedDeviceId || !devices.length) return false;
    return devices.some(([id]) => id === selectedDeviceId);
  }, [selectedDeviceId, devices]);

  // Urządzenie jest połączone jeśli serwer działa i urządzenie jest aktywne
  const isDeviceConnected = isServerRunning && isDeviceActive;

  React.useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0][0]);
    }
  }, [devices, selectedDeviceId]);

  const selectedConfig: DeviceConfig | undefined = useMemo(() => {
    if (selectedDeviceId && configs) {
      return configs[selectedDeviceId];
    }
    return undefined;
  }, [selectedDeviceId, configs]);

  const handleTestConnection = async (deviceId: string) => {
    setIsTestingConnection(true);
    setConnectionTestResult(null);

    try {
      // Backend test endpoint should probably take deviceId or hostId. 
      // Current API might expect hostId, but in single model we use deviceId as proxy or hostId if we knew it.
      // Since backend shim creates hostId like 'host-tcp-...' or 'host-serial-...', we might need to be careful.
      // For now, let's keep it simple or use hostId if we had it.
      // The backend actually splits them, so 'selectedConfig' won't have 'host_id' anymore in our TS type.
      // Wait, let's look at bridge-api.ts testHostConnection.

      const result = await testDeviceConnection(deviceId);
      setConnectionTestResult(result);
      toast({
        title: result.success ? "Connection Test Successful" : "Connection Test Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setConnectionTestResult({
        success: false,
        message: errorMessage,
      });
      toast({
        title: "Connection Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const renderConnectionDetails = (config: DeviceConfig) => {
    const conn = config.connection;
    const isTcp = conn.connection_type === 'Tcp';
    const Icon = isTcp ? Wifi : Cable;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-lg font-medium text-primary">
            <Icon className="h-5 w-5" />
            <span>{isTcp ? "TCP/IP Connection" : "Serial Connection"}</span>
          </div>
          <Button
            onClick={() => handleTestConnection(selectedDeviceId!)}
            disabled={isTestingConnection || !selectedDeviceId}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {isTestingConnection ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4" />
                Test Connection
              </>
            )}
          </Button>
        </div>

        {connectionTestResult && (
          <div className={`p-3 rounded-lg border ${connectionTestResult.success
            ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
            : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
            }`}>
            <div className="flex items-start gap-2">
              {connectionTestResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${connectionTestResult.success
                  ? "text-green-800 dark:text-green-200"
                  : "text-red-800 dark:text-red-200"
                  }`}>
                  {connectionTestResult.success ? "Connection Test Passed" : "Connection Test Failed"}
                </p>
                <p className={`text-xs mt-1 ${connectionTestResult.success
                  ? "text-green-700 dark:text-green-300"
                  : "text-red-700 dark:text-red-300"
                  }`}>
                  {connectionTestResult.message}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <DetailItem label="Type" value={conn.connection_type} />

          {isTcp ? (
            <>
              <DetailItem label="Host" value={conn.host} />
              <DetailItem label="Port" value={conn.port.toString()} />
            </>
          ) : (
            <>
              <DetailItem label="Port Path" value={conn.port} />
              <DetailItem label="Baud Rate" value={conn.baud_rate?.toString() || 'N/A'} />
            </>
          )}
          <DetailItem label="Timeout (ms)" value={conn.timeout_ms?.toString() || 'N/A'} />
        </div>
      </div>
    );
  };

  const renderProtocolDetails = (config: DeviceConfig) => {
    const cmds = config.commands;
    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-lg font-medium text-primary">
          <Settings className="h-5 w-5" />
          <span>Protocol: {config.protocol}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <DetailItem label="Read Gross Cmd" value={cmds["readGross"] || "N/A"} />
          <DetailItem label="Read Net Cmd" value={cmds["readNet"] || "N/A"} />
          <DetailItem label="Tare Cmd" value={cmds["tare"] || "N/A"} />
          <DetailItem label="Zero Cmd" value={cmds["zero"] || "N/A"} />
        </div>
      </div>
    );
  };

  const renderMqttTelemetry = () => {
    if (!mqttStatus?.enabled) {
      return (
        <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded flex items-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span>MQTT is disabled. Enable it to see telemetry from topics like <code>{mqttStatus?.topic_prefix || 'scaleit'}/weight/{selectedDeviceId || 'id'}</code></span>
        </div>
      );
    }

    const topic = `${mqttStatus.topic_prefix || 'scaleit'}/weight/${selectedDeviceId}`;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-lg font-medium text-primary">
            <Database className="h-5 w-5" />
            <span>MQTT Telemetry (Server Response)</span>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {topic}
          </Badge>
        </div>

        {mqttLatest?.latest_weight ? (
          <div className="space-y-3">
            <div className="p-4 bg-gradient-to-r from-blue-500/10 to-blue-500/5 rounded-lg border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Latest Topic Payload</span>
                </div>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {mqttLatest.latest_weight.recorded_at ? new Date(mqttLatest.latest_weight.recorded_at).toLocaleTimeString() : 'N/A'}
                </Badge>
              </div>
              <pre className="text-xs font-mono bg-background/50 p-2 rounded border overflow-x-auto whitespace-pre-wrap mb-3">
                {JSON.stringify(mqttLatest.latest_weight, null, 2)}
              </pre>
              <div className="grid grid-cols-2 gap-4">
                <DetailItem
                  label="MQTT Weight"
                  value={`${typeof mqttLatest.latest_weight.weight === 'number' ? mqttLatest.latest_weight.weight.toFixed(2) : '0.00'} ${mqttLatest.latest_weight.unit}`}
                  status="success"
                />
                <DetailItem
                  label="MQTT Stability"
                  value={mqttLatest.latest_weight.is_stable ? "Stable" : "Unstable"}
                  status={mqttLatest.latest_weight.is_stable ? "success" : "error"}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center p-8 bg-muted/30 rounded-lg border border-dashed flex flex-col items-center">
            <Clock className="h-8 w-8 text-muted-foreground opacity-20 mb-2" />
            <p className="text-sm text-muted-foreground">Waiting for messages on topic...</p>
            <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">{topic}</p>
          </div>
        )}
      </div>
    );
  };

  const renderStatus = () => {
    const connectionStatus = isDeviceConnected ? "Online" : "Offline";
    const healthStatus = isDeviceConnected ? "Responsive" : "Unresponsive";
    const lastCheckTime = new Date().toLocaleTimeString();

    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-lg font-medium text-primary">
          <Zap className="h-5 w-5" />
          <span>Real-time Status</span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <DetailItem
            label="Connection Status"
            value={connectionStatus}
            status={isDeviceConnected ? "success" : "error"}
          />
          <DetailItem
            label="Last Check"
            value={lastCheckTime}
            icon={Clock}
          />
          <DetailItem
            label="Device Health"
            value={healthStatus}
            status={isDeviceConnected ? "success" : "error"}
          />
          <DetailItem
            label="Server Status"
            value={isServerRunning ? "Running" : (healthData?.status === "STOPPED" ? "Stopped" : "Unknown")}
            status={isServerRunning ? "success" : "error"}
          />
        </div>
      </div>
    );
  };

  if (isLoadingDevices || isLoadingConfigs || isLoadingHealth) {
    return (
      <Card className="p-8 flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading diagnostics data...</span>
      </Card>
    );
  }

  if (devicesError || configsError) {
    const errorMessage = devicesError?.message || configsError?.message || "Unknown error";
    return (
      <Card className="p-8">
        <div className="text-destructive p-4 border border-destructive/50 rounded-lg">
          <p className="font-semibold">Error loading diagnostics data</p>
          <p className="mt-2">{errorMessage}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Device Selector</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Device Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">
            Select Device for Diagnostics
          </label>
          {devices.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No devices configured.
            </div>
          ) : (
            <Select
              value={selectedDeviceId || ""}
              onValueChange={(value) => setSelectedDeviceId(value as DeviceId)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map(([id, name, model]) => (
                  <SelectItem key={id} value={id}>
                    {name} ({model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Separator />

        {selectedConfig ? (
          <div className="space-y-8">
            <h3 className="text-2xl font-bold">{selectedConfig.name} ({selectedConfig.model})</h3>

            {/* Real-time Status */}
            {renderStatus()}

            <Separator />

            {/* MQTT Telemetry Section */}
            {renderMqttTelemetry()}

            <Separator />

            {/* Connection Details */}
            {renderConnectionDetails(selectedConfig)}

            <Separator />

            {/* Protocol Details */}
            {renderProtocolDetails(selectedConfig)}
          </div>
        ) : (
          <div className="text-center p-8 text-muted-foreground">
            Please select a device to view diagnostics.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface DetailItemProps {
  label: string;
  value: string;
  status?: "success" | "error";
  icon?: React.ElementType;
}

const DetailItem: React.FC<DetailItemProps> = ({ label, value, status, icon: Icon }) => {
  const statusClass = status === "success"
    ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
    : status === "error"
      ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
      : "text-foreground";

  return (
    <div className="flex flex-col space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center">
        {Icon && <Icon className="h-4 w-4 mr-2 text-muted-foreground" />}
        <Badge variant="secondary" className={status ? statusClass : ""}>
          {value}
        </Badge>
      </div>
    </div>
  );
};

export default DiagnosticsPanel;