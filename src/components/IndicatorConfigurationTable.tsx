import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllMierniki, deleteMiernik, getAllDeviceConfigs } from "@/services/bridge-api";
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
import { Loader2, Edit, Trash2, PlusCircle } from "lucide-react";
import { MiernikConfig } from "@/types/api";
import { showSuccess, showError } from "@/utils/toast";
import MiernikConfigForm from "./MiernikConfigForm";

interface IndicatorConfigurationTableProps {
  onEdit?: (miernikId: string, config: MiernikConfig) => void;
  onAdd?: () => void;
}

const IndicatorConfigurationTable: React.FC<IndicatorConfigurationTableProps> = ({ onEdit, onAdd }) => {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMiernik, setEditingMiernik] = useState<{ id: string; config: MiernikConfig } | undefined>(undefined);

  const {
    data: mierniki,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["mierniki"],
    queryFn: getAllMierniki,
    refetchInterval: 60000,
  });

  const { data: devices } = useQuery({
    queryKey: ["deviceConfigs"],
    queryFn: getAllDeviceConfigs,
    refetchInterval: 60000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMiernik,
    onSuccess: (_, miernikId) => {
      showSuccess(`Miernik ${miernikId} deleted successfully.`);
      queryClient.invalidateQueries({ queryKey: ["mierniki"] });
      queryClient.invalidateQueries({ queryKey: ["deviceConfigs"] });
    },
    onError: (err, miernikId) => {
      showError(`Failed to delete miernik ${miernikId}: ${err.message}`);
    },
  });

  const handleAdd = () => {
    setEditingMiernik(undefined);
    setIsFormOpen(true);
    onAdd?.();
  };

  const handleEdit = (miernikId: string, config: MiernikConfig) => {
    setEditingMiernik({ id: miernikId, config });
    setIsFormOpen(true);
    onEdit?.(miernikId, config);
  };

  const handleDelete = (miernikId: string) => {
    if (!window.confirm(`Are you sure you want to delete miernik ${miernikId}?`)) {
      return;
    }
    deleteMutation.mutate(miernikId);
  };

  const handleSaveSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["mierniki"] });
    queryClient.invalidateQueries({ queryKey: ["deviceConfigs"] });
  };

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

  // Get devices using each miernik
  const getDevicesForMiernik = (miernikId: string): string[] => {
    if (!devices) return [];
    return Object.entries(devices)
      .filter(([_, device]) => device.miernik_id === miernikId)
      .map(([deviceId]) => deviceId);
  };

  const miernikiList = mierniki ? Object.entries(mierniki) : [];

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={handleAdd} size="sm">
          <PlusCircle className="h-4 w-4 mr-2" /> Add New Miernik
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">ID</TableHead>
              <TableHead>Nazwa</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead>Connected Devices</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {miernikiList.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No miernik configurations found. Click 'Add New Miernik' to start.
                </TableCell>
              </TableRow>
            ) : (
              miernikiList.map(([miernikId, miernikConfig]) => {
                const connectedDevices = getDevicesForMiernik(miernikId);
                return (
                  <TableRow key={miernikId}>
                    <TableCell className="font-medium">{miernikId}</TableCell>
                    <TableCell>{miernikConfig.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {miernikConfig.protocol}
                      </Badge>
                    </TableCell>
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
                      <Badge variant={miernikConfig.enabled ? "default" : "secondary"}>
                        {miernikConfig.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(miernikId, miernikConfig)}
                          title="Edit"
                          disabled={deleteMutation.isPending}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(miernikId)}
                          title="Delete"
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending &&
                          deleteMutation.variables === miernikId ? (
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

      <MiernikConfigForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialConfig={editingMiernik}
        onSaveSuccess={handleSaveSuccess}
      />
    </>
  );
};

export default IndicatorConfigurationTable;

