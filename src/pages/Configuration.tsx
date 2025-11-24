import Layout from "@/components/Layout";
import React, { useState } from "react";
import DeviceList from "@/components/DeviceList";
import DeviceConfigForm from "@/components/DeviceConfigForm";
import { DeviceConfig, DeviceId } from "@/types/api";
import { useQueryClient } from "@tanstack/react-query";

const Configuration = () => {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<{ id: DeviceId; config: DeviceConfig } | undefined>(undefined);

  const handleAdd = () => {
    setEditingDevice(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (id: DeviceId, config: DeviceConfig) => {
    setEditingDevice({ id, config });
    setIsFormOpen(true);
  };
  
  const handleSaveSuccess = () => {
    // Inwalidacja zapytania, aby odświeżyć listę urządzeń
    queryClient.invalidateQueries({ queryKey: ["deviceConfigs"] });
    // Ponadto, inwalidujemy listę urządzeń używaną w ScaleOperationsPanel
    queryClient.invalidateQueries({ queryKey: ["devices"] });
  };

  return (
    <Layout>
      <div className="space-y-8">
        <h2 className="text-3xl font-bold tracking-tight">Device Configuration</h2>
        <p className="text-muted-foreground">
          Manage industrial scale devices, connection settings, and command protocols.
        </p>
        
        <DeviceList onEdit={handleEdit} onAdd={handleAdd} />
      </div>
      
      <DeviceConfigForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialConfig={editingDevice}
        onSaveSuccess={handleSaveSuccess}
      />
    </Layout>
  );
};

export default Configuration;