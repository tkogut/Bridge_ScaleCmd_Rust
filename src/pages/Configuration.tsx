import React, { useState } from "react";
import Layout from "@/components/Layout";
import { DeviceList } from "@/components/DeviceList";
import DeviceConfigForm from "@/components/DeviceConfigForm";
import MqttConfigForm from "@/components/MqttConfigForm";
import { DeviceConfig, DeviceId } from "@/types/api";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Wifi, Server, Database, Globe } from "lucide-react";
import HostConfigurationTable from "@/components/HostConfigurationTable";
import IndicatorConfigurationTable from "@/components/IndicatorConfigurationTable";
import MasterServerConfig from "@/components/MasterServerConfig";

const Configuration = () => {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isMqttOpen, setIsMqttOpen] = useState(false);
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
    // Invalidate queries to refresh device list
    queryClient.invalidateQueries({ queryKey: ["deviceConfigs"] });
    queryClient.invalidateQueries({ queryKey: ["devices"] });
  };

  const handleMqttSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["mqttConfig"] });
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Configuration</h2>
          <p className="text-muted-foreground">
            Manage your industrial scale connections and MQTT bridge settings.
          </p>
        </div>

        <Tabs defaultValue="devices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="devices">Scale Devices</TabsTrigger>
            <TabsTrigger value="hosts">Hosts</TabsTrigger>
            <TabsTrigger value="mierniki">Mierniki</TabsTrigger>
            <TabsTrigger value="mqtt">MQTT Bridge</TabsTrigger>
            <TabsTrigger value="master">Master Server</TabsTrigger>
          </TabsList>

          <TabsContent value="devices" className="space-y-4">
            <DeviceList onEdit={handleEdit} onAdd={handleAdd} />
          </TabsContent>

          <TabsContent value="hosts" className="space-y-4">
            <HostConfigurationTable />
          </TabsContent>

          <TabsContent value="mierniki" className="space-y-4">
            <IndicatorConfigurationTable />
          </TabsContent>

          <TabsContent value="mqtt" className="space-y-4">
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
              <Wifi className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">MQTT Bridge Configuration</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Configure how the bridge connects to your MQTT broker to publish weight readings and receive commands.
              </p>
              <Button onClick={() => setIsMqttOpen(true)}>
                Configure MQTT Settings
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="master" className="space-y-4">
            <MasterServerConfig />
          </TabsContent>
        </Tabs>
      </div>

      <DeviceConfigForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialConfig={editingDevice}
        onSaveSuccess={handleSaveSuccess}
      />

      <MqttConfigForm
        open={isMqttOpen}
        onOpenChange={setIsMqttOpen}
        onSaveSuccess={handleMqttSuccess}
      />
    </Layout>
  );
};

export default Configuration;