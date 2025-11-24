import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllDeviceConfigs } from "@/services/bridge-api";
import { Card, CardContent } from "@/components/ui/card";
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
  const { data: configs, isLoading, error, refetch } = useQuery({
    queryKey: ["deviceConfigs"],
    queryFn: getAllDeviceConfigs,
    refetchInterval: 60000, // Odświeżanie co minutę
  });

  const handleDelete = async (deviceId: DeviceId) => {
    if (!window.confirm(`Are you sure you want to delete device ${deviceId}?`)) {
      return;
    }
    try {
      // Symulacja usunięcia
      // await deleteDeviceConfig(deviceId); 
      showSuccess(`Device ${deviceId} deleted successfully (simulated).`);
      refetch();
    } catch (err) {
      showError(`Failed to delete device ${deviceId}.`);
    }
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
                    {config.connection.connection_type === 'Tcp' 
                      ? `${config.connection.host}:${config.connection.port}`
                      : config.connection.connection_type === 'Serial'
                      ? `${config.connection.port} (${config.connection.baud_rate} baud)`
                      : config.connection.connection_type}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onEdit(id, config)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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