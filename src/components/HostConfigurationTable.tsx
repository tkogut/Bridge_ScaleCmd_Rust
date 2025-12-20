import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllDeviceConfigs } from "@/services/bridge-api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wifi, Cable } from "lucide-react";
import { DeviceConfig } from "@/types/api";

const HostConfigurationTable: React.FC = () => {
  const {
    data: configs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["deviceConfigs"],
    queryFn: getAllDeviceConfigs,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">
          Loading host configurations...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive p-4 border border-destructive/50 rounded-lg">
        Error loading host configurations: {error.message}
      </div>
    );
  }

  // Extract unique host configurations from devices
  const hostConfigs = new Map<string, {
    connection: DeviceConfig["connection"];
    devices: string[];
    timeout_ms: number;
  }>();

  if (configs) {
    Object.entries(configs).forEach(([deviceId, config]) => {
      const connectionKey = config.connection.connection_type === "Tcp"
        ? `TCP:${config.connection.host}:${config.connection.port}`
        : `Serial:${config.connection.port}:${config.connection.baud_rate}`;

      if (!hostConfigs.has(connectionKey)) {
        hostConfigs.set(connectionKey, {
          connection: config.connection,
          devices: [],
          timeout_ms: config.timeout_ms,
        });
      }
      hostConfigs.get(connectionKey)!.devices.push(deviceId);
    });
  }

  const hosts = Array.from(hostConfigs.entries());

  const renderConnectionDetails = (connection: DeviceConfig["connection"]) => {
    if (connection.connection_type === "Tcp") {
      return (
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Wifi className="h-4 w-4 text-primary" />
            <span className="font-medium">TCP/IP</span>
          </div>
          <div className="text-sm text-muted-foreground pl-6">
            <div>Host: {connection.host}</div>
            <div>Port: {connection.port}</div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Cable className="h-4 w-4 text-primary" />
            <span className="font-medium">Serial</span>
          </div>
          <div className="text-sm text-muted-foreground pl-6">
            <div>Port: {connection.port}</div>
            <div>Baud Rate: {connection.baud_rate} baud</div>
            {connection.data_bits && <div>Data Bits: {connection.data_bits}</div>}
            {connection.stop_bits && <div>Stop Bits: {connection.stop_bits}</div>}
            {connection.parity && <div>Parity: {connection.parity}</div>}
            {connection.flow_control && <div>Flow Control: {connection.flow_control}</div>}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Connection Details</TableHead>
            <TableHead>Timeout (ms)</TableHead>
            <TableHead>Connected Devices</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hosts.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-muted-foreground"
              >
                No host configurations found.
              </TableCell>
            </TableRow>
          ) : (
            hosts.map(([key, hostConfig]) => (
              <TableRow key={key}>
                <TableCell>
                  <Badge variant="outline">
                    {hostConfig.connection.connection_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  {renderConnectionDetails(hostConfig.connection)}
                </TableCell>
                <TableCell>{hostConfig.timeout_ms}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {hostConfig.devices.map((deviceId) => (
                      <Badge key={deviceId} variant="secondary">
                        {deviceId}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="default">Active</Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default HostConfigurationTable;

