import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllHosts, deleteHost, getAllDeviceConfigs } from "@/services/bridge-api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Wifi, Cable, Edit, Trash2, PlusCircle } from "lucide-react";
import { HostConfig } from "@/types/api";
import { showSuccess, showError } from "@/utils/toast";
import HostConfigForm from "./HostConfigForm";

interface HostConfigurationTableProps {
  onEdit?: (hostId: string, config: HostConfig) => void;
  onAdd?: () => void;
}

const HostConfigurationTable: React.FC<HostConfigurationTableProps> = ({ onEdit, onAdd }) => {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<{ id: string; config: HostConfig } | undefined>(undefined);

  const {
    data: hosts,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["hosts"],
    queryFn: getAllHosts,
    refetchInterval: 60000,
  });

  const { data: devices } = useQuery({
    queryKey: ["deviceConfigs"],
    queryFn: getAllDeviceConfigs,
    refetchInterval: 60000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHost,
    onSuccess: (_, hostId) => {
      showSuccess(`Host ${hostId} deleted successfully.`);
      queryClient.invalidateQueries({ queryKey: ["hosts"] });
      queryClient.invalidateQueries({ queryKey: ["deviceConfigs"] });
    },
    onError: (err, hostId) => {
      showError(`Failed to delete host ${hostId}: ${err.message}`);
    },
  });

  const handleAdd = () => {
    setEditingHost(undefined);
    setIsFormOpen(true);
    onAdd?.();
  };

  const handleEdit = (hostId: string, config: HostConfig) => {
    setEditingHost({ id: hostId, config });
    setIsFormOpen(true);
    onEdit?.(hostId, config);
  };

  const handleDelete = (hostId: string) => {
    if (!window.confirm(`Are you sure you want to delete host ${hostId}?`)) {
      return;
    }
    deleteMutation.mutate(hostId);
  };

  const handleSaveSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["hosts"] });
    queryClient.invalidateQueries({ queryKey: ["deviceConfigs"] });
  };

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

  // Get devices using each host
  const getDevicesForHost = (hostId: string): string[] => {
    if (!devices) return [];
    return Object.entries(devices)
      .filter(([_, device]) => device.host_id === hostId)
      .map(([deviceId]) => deviceId);
  };

  const hostsList = hosts ? Object.entries(hosts) : [];

  const renderConnectionDetails = (connection: HostConfig["connection"]) => {
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
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={handleAdd} size="sm">
          <PlusCircle className="h-4 w-4 mr-2" /> Add New Host
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">ID</TableHead>
              <TableHead>Nazwa</TableHead>
              <TableHead>Connection Details</TableHead>
              <TableHead>Timeout (ms)</TableHead>
              <TableHead>Connected Devices</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hostsList.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No host configurations found. Click 'Add New Host' to start.
                </TableCell>
              </TableRow>
            ) : (
              hostsList.map(([hostId, hostConfig]) => {
                const connectedDevices = getDevicesForHost(hostId);
                return (
                  <TableRow key={hostId}>
                    <TableCell className="font-medium">{hostId}</TableCell>
                    <TableCell>{hostConfig.name}</TableCell>
                    <TableCell>
                      {renderConnectionDetails(hostConfig.connection)}
                    </TableCell>
                    <TableCell>{hostConfig.timeout_ms}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {connectedDevices.length > 0 ? (
                          connectedDevices.map((deviceId) => (
                            <Badge key={deviceId} variant="secondary">
                              {deviceId}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={hostConfig.enabled ? "default" : "secondary"}>
                        {hostConfig.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(hostId, hostConfig)}
                          title="Edit"
                          disabled={deleteMutation.isPending}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(hostId)}
                          title="Delete"
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending &&
                          deleteMutation.variables === hostId ? (
                            <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <HostConfigForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialConfig={editingHost}
        onSaveSuccess={handleSaveSuccess}
      />
    </>
  );
};

export default HostConfigurationTable;

