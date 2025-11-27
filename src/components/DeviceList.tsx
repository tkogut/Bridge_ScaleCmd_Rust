import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllDeviceConfigs, deleteDeviceConfig, saveDeviceConfig } from "@/services/bridge-api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Edit, Trash2, PlusCircle } from "lucide-react";
import { DeviceId, DeviceConfig } from "@/types/api";
import { showSuccess, showError } from "@/utils/toast";

interface DeviceListProps {
  onEdit: (deviceId: DeviceId, config: DeviceConfig) => void;
  onAdd: () => void;
}

const DeviceList: React.FC<DeviceListProps> = ({ onEdit, onAdd }) => {
  const queryClient = useQueryClient();
  
  const { data: configs, isLoading, error, refetch } = useQuery({
    queryKey: ["deviceConfigs"],
    queryFn: getAllDeviceConfigs,
    refetchInterval: 60000, // Odświeżanie co minutę
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDeviceConfig,
    onSuccess: (_, deviceId) => {
      showSuccess(`Device ${deviceId} deleted successfully.`);
      // Inwalidacja obu zapytań, aby odświeżyć listę i operacje
      queryClient.invalidateQueries({ queryKey: ["deviceConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (err, deviceId) => {
      showError(`Failed to delete device ${deviceId}: ${err.message}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ deviceId, config, enabled }: { deviceId: DeviceId; config: DeviceConfig; enabled: boolean }) => {
      await saveDeviceConfig(deviceId, { ...config, enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deviceConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      showSuccess("Device status updated.");
    },
    onError: (err) => {
      showError(`Failed to update device status: ${err.message}`);
    },
  });

  const handleToggle = (deviceId: DeviceId, config: DeviceConfig, enabled: boolean) => {
    toggleMutation.mutate({ deviceId, config, enabled });
  };

  const handleDelete = (deviceId: DeviceId) => {
    if (!window.confirm(`Are you sure you want to delete device ${deviceId}?`)) {
      return;
    }
    deleteMutation.mutate(deviceId);
  };

  if (isLoading) {
    return (
      <CardContent className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading device configurations...</span>
      </CardContent>
    );
  }

  if (error) {
    return (
      <CardContent>
        <div className="text-destructive p-4 border border-destructive/50 rounded-lg">
          Error loading configurations: {error.message}
        </div>
      </CardContent>
    );
  }

  const devices = configs ? Object.entries(configs) : [];

  const renderConnection = (config: DeviceConfig) => {
    const connection = config.connection;
    if (connection.connection_type === "Tcp") {
      return `${connection.host}:${connection.port}`;
    }
    if (connection.connection_type === "Serial") {
      return `${connection.port} (${connection.baud_rate} baud)`;
    }
    return connection.connection_type;
  };

  return (
    <Card>
      <div className="flex justify-end p-4">
        <Button onClick={onAdd} size="sm">
          <PlusCircle className="h-4 w-4 mr-2" /> Add New Device
        </Button>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No devices configured. Click 'Add New Device' to start.
                </TableCell>
              </TableRow>
            ) : (
              devices.map(([id, config]) => (
                <TableRow key={id}>
                  <TableCell className="font-medium">{id}</TableCell>
                  <TableCell>{config.name}</TableCell>
                  <TableCell>{config.model}</TableCell>
                  <TableCell>{config.protocol}</TableCell>
                  <TableCell>
                    {renderConnection(config)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Badge variant={config.enabled ? "default" : "secondary"}>
                        {config.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={(value) => handleToggle(id, config, value)}
                        disabled={toggleMutation.isPending}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right"
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onEdit(id, config)}
                        title="Edit"
                        disabled={deleteMutation.isPending}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(id)}
                        title="Delete"
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending && deleteMutation.variables === id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default DeviceList;