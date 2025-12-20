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
import { Loader2 } from "lucide-react";
import { DeviceConfig } from "@/types/api";

const IndicatorConfigurationTable: React.FC = () => {
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
          Loading indicator configurations...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive p-4 border border-destructive/50 rounded-lg">
        Error loading indicator configurations: {error.message}
      </div>
    );
  }

  // Extract unique indicator (protocol) configurations from devices
  const indicatorConfigs = new Map<string, {
    protocol: string;
    manufacturer: string;
    model: string;
    commands: Record<string, string>;
    devices: Array<{ id: string; name: string }>;
  }>();

  if (configs) {
    Object.entries(configs).forEach(([deviceId, config]) => {
      const protocolKey = config.protocol;

      if (!indicatorConfigs.has(protocolKey)) {
        indicatorConfigs.set(protocolKey, {
          protocol: config.protocol,
          manufacturer: config.manufacturer,
          model: config.model,
          commands: config.commands,
          devices: [],
        });
      }
      indicatorConfigs.get(protocolKey)!.devices.push({
        id: deviceId,
        name: config.name,
      });
    });
  }

  const indicators = Array.from(indicatorConfigs.entries());

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Protocol</TableHead>
            <TableHead>Manufacturer</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Commands</TableHead>
            <TableHead>Connected Devices</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {indicators.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-muted-foreground"
              >
                No indicator configurations found.
              </TableCell>
            </TableRow>
          ) : (
            indicators.map(([protocolKey, indicator]) => (
              <TableRow key={protocolKey}>
                <TableCell>
                  <Badge variant="outline" className="font-mono">
                    {indicator.protocol}
                  </Badge>
                </TableCell>
                <TableCell>{indicator.manufacturer}</TableCell>
                <TableCell>{indicator.model}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(indicator.commands).map((cmd) => (
                      <Badge key={cmd} variant="secondary" className="text-xs">
                        {cmd}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {indicator.devices.map((device) => (
                      <Badge key={device.id} variant="secondary">
                        {device.name}
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

export default IndicatorConfigurationTable;

