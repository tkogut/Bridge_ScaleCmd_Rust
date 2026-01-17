import Layout from "@/components/Layout";
import React, { useState } from "react";
import DeviceList from "@/components/DeviceList";
import HostConfigurationTable from "@/components/HostConfigurationTable";
import IndicatorConfigurationTable from "@/components/IndicatorConfigurationTable";
import DeviceConfigForm from "@/components/DeviceConfigForm";
import MasterServerConfig from "@/components/MasterServerConfig";
import MqttConfigForm from "@/components/MqttConfigForm";
import { DeviceConfig, DeviceId } from "@/types/api";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Configuration = () => {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<{ id: DeviceId; config: DeviceConfig } | undefined>(undefined);
  const [isMqttFormOpen, setIsMqttFormOpen] = useState(false);

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

  const handleMqttSaveSuccess = () => {
    // Invalidate MQTT-related queries
    queryClient.invalidateQueries({ queryKey: ["mqttConfig"] });
    queryClient.invalidateQueries({ queryKey: ["mqttStatus"] });
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

        {/* MQTT Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>MQTT Configuration - Konfiguracja MQTT</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure MQTT settings for publishing weight readings and receiving commands.
                This enables real-time communication with external systems via MQTT broker.
              </p>
              <Button onClick={() => setIsMqttFormOpen(true)}>
                Configure MQTT Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Network Settings */}
        <MasterServerConfig />
      </div>
      
      <DeviceConfigForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialConfig={editingDevice}
        onSaveSuccess={handleSaveSuccess}
      />

      <MqttConfigForm
        open={isMqttFormOpen}
        onOpenChange={setIsMqttFormOpen}
        onSaveSuccess={handleMqttSaveSuccess}
      />
    </Layout>
  );
};

export default Configuration;