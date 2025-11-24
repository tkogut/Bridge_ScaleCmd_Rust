import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDevices, getAllDeviceConfigs, DeviceConfig, DeviceId } from "@/services/bridge-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, XCircle, Wifi, Cable, Clock, Settings, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const DiagnosticsPanel = () => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<DeviceId | undefined>(undefined);

  // 1. Pobieranie listy urządzeń (dla Selecta)
  const { data: devicesData, isLoading: isLoadingDevices, error: devicesError } = useQuery({
    queryKey: ["devices"],
    queryFn: getDevices,
    staleTime: Infinity,
  });

  // 2. Pobieranie pełnej konfiguracji (dla szczegółów)
  const { data: configs, isLoading: isLoadingConfigs, error: configsError } = useQuery({
    queryKey: ["deviceConfigs"],
    queryFn: getAllDeviceConfigs,
    staleTime: Infinity,
  });

  const devices = devicesData?.devices || [];

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

  const renderConnectionDetails = (config: DeviceConfig) => {
    const conn = config.connection;
    const isTcp = conn.connection_type === 'Tcp';
    const Icon = isTcp ? Wifi : Cable;

    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-lg font-medium text-primary">
          <Icon className="h-5 w-5" />
          <span>{isTcp ? "TCP/IP Connection" : "Serial Connection"}</span>
        </div>
        
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
          <DetailItem label="Timeout (ms)" value={conn.timeout_ms.toString()} />
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
          <DetailItem label="Read Gross Cmd" value={cmds.read_gross} />
          <DetailItem label="Read Net Cmd" value={cmds.read_net} />
          <DetailItem label="Tare Cmd" value={cmds.tare} />
          <DetailItem label="Zero Cmd" value={cmds.zero} />
        </div>
      </div>
    );
  };

  const renderStatus = () => {
    // Symulacja statusu połączenia
    const isConnected = selectedDeviceId === "c320_line1"; // Symulacja, że tylko c320_line1 jest 'online'
    
    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-lg font-medium text-primary">
          <Zap className="h-5 w-5" />
          <span>Real-time Status</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <DetailItem label="Connection Status" value={isConnected ? "Online" : "Offline"} status={isConnected ? "success" : "error"} />
          <DetailItem label="Last Check" value={new Date().toLocaleTimeString()} icon={Clock} />
          <DetailItem label="Device Health" value={isConnected ? "Healthy" : "Unresponsive"} status={isConnected ? "success" : "error"} />
          <DetailItem label="Protocol Version" value={selectedConfig?.protocol || 'N/A'} />
        </div>
      </div>
    );
  };

  if (isLoadingDevices || isLoadingConfigs) {
    return (
      <Card className="p-8 flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading diagnostics data...</span>
      </Card>
    );
  }

  if (devicesError || configsError) {
    return (
      <Card className="p-8">
        <div className="text-destructive p-4 border border-destructive/50 rounded-lg">
          Error loading data: {devicesError?.message || configsError?.message}
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
              value={selectedDeviceId}
              onValueChange={(value) => setSelectedDeviceId(value)}
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

// Komponent pomocniczy do wyświetlania szczegółów
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