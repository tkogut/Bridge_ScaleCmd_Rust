import Layout from "@/components/Layout";
import React, { useState } from "react";
import DeviceList from "@/components/DeviceList";
import HostConfigurationTable from "@/components/HostConfigurationTable";
import IndicatorConfigurationTable from "@/components/IndicatorConfigurationTable";
import DeviceConfigForm from "@/components/DeviceConfigForm";
import { DeviceConfig, DeviceId } from "@/types/api";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configuration</h2>
          <p className="text-muted-foreground">
            Manage industrial scale devices, host connections, and indicator protocols.
          </p>
        </div>
        
        {/* Device Configuration Table */}
        <Card>
          <CardHeader>
            <CardTitle>Device Configuration - Konfiguracja wagi</CardTitle>
          </CardHeader>
          <CardContent>
            <DeviceList onEdit={handleEdit} onAdd={handleAdd} />
          </CardContent>
        </Card>

        {/* Host Configuration Table */}
        <Card>
          <CardHeader>
            <CardTitle>Host Configuration - Konfiguracja Hosta</CardTitle>
          </CardHeader>
          <CardContent>
            <HostConfigurationTable />
          </CardContent>
        </Card>

        {/* Indicator Configuration Table */}
        <Card>
          <CardHeader>
            <CardTitle>Indicator Configuration - Konfiguracja Miernika</CardTitle>
          </CardHeader>
          <CardContent>
            <IndicatorConfigurationTable />
          </CardContent>
        </Card>
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