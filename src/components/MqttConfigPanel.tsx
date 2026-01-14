import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMqttConfig, updateMqttConfig, validateMqttConfig, testMqttConnection } from "@/services/mqtt-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError } from "@/utils/toast";
import { Loader2, Save, TestTube2 } from "lucide-react";
import type { MqttConfig } from "@/services/mqtt-api";

const MqttConfigPanel = () => {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["mqttConfig"],
    queryFn: getMqttConfig,
  });

  const [formData, setFormData] = useState<Partial<MqttConfig>>({});
  const [isTesting, setIsTesting] = useState(false);

  // Update form data when config is loaded
  useState(() => {
    if (config && Object.keys(formData).length === 0) {
      setFormData(config);
    }
  });

  const updateMutation = useMutation({
    mutationFn: updateMqttConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mqttConfig"] });
      queryClient.invalidateQueries({ queryKey: ["mqttStatus"] });
      showSuccess("MQTT configuration updated successfully");
    },
    onError: (error: Error) => {
      showError(`Failed to update configuration: ${error.message}`);
    },
  });

  const handleInputChange = (field: keyof MqttConfig, value: string | boolean | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    const errors = validateMqttConfig(formData);
    if (errors.length > 0) {
      showError(`Validation errors:\n${errors.join("\n")}`);
      return;
    }

    updateMutation.mutate(formData);
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const result = await testMqttConnection();
      if (result.connected) {
        showSuccess(`MQTT connection successful! Response time: ${result.response_time}ms`);
      } else {
        showError(`Connection failed: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      showError(`Test failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const currentData = { ...config, ...formData };

  return (
    <Card>
      <CardHeader>
        <CardTitle>MQTT Configuration</CardTitle>
        <CardDescription>
          Configure MQTT broker connection for publishing weight readings and receiving commands
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable MQTT */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="mqtt-enabled">Enable MQTT</Label>
            <p className="text-sm text-muted-foreground">
              Enable MQTT pub/sub functionality
            </p>
          </div>
          <Switch
            id="mqtt-enabled"
            checked={currentData.enabled || false}
            onCheckedChange={(checked) => handleInputChange("enabled", checked)}
          />
        </div>

        {/* Broker URL */}
        <div className="space-y-2">
          <Label htmlFor="broker-url">Broker URL</Label>
          <Input
            id="broker-url"
            type="text"
            placeholder="mqtt://localhost:1883"
            value={currentData.broker_url || ""}
            onChange={(e) => handleInputChange("broker_url", e.target.value)}
            disabled={!currentData.enabled}
          />
          <p className="text-xs text-muted-foreground">
            Format: mqtt://host:port or mqtts://host:port (for SSL)
          </p>
        </div>

        {/* Client ID */}
        <div className="space-y-2">
          <Label htmlFor="client-id">Client ID</Label>
          <Input
            id="client-id"
            type="text"
            placeholder="scaleit-bridge"
            value={currentData.client_id || ""}
            onChange={(e) => handleInputChange("client_id", e.target.value)}
            disabled={!currentData.enabled}
          />
          <p className="text-xs text-muted-foreground">
            Unique identifier for this MQTT client
          </p>
        </div>

        {/* Topic Prefix */}
        <div className="space-y-2">
          <Label htmlFor="topic-prefix">Topic Prefix</Label>
          <Input
            id="topic-prefix"
            type="text"
            placeholder="scaleit"
            value={currentData.topic_prefix || ""}
            onChange={(e) => handleInputChange("topic_prefix", e.target.value)}
            disabled={!currentData.enabled}
          />
          <p className="text-xs text-muted-foreground">
            Prefix for all MQTT topics (e.g., scaleit/weight/device_id)
          </p>
        </div>

        {/* Authentication */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username (optional)</Label>
            <Input
              id="username"
              type="text"
              placeholder="mqtt_user"
              value={currentData.username || ""}
              onChange={(e) => handleInputChange("username", e.target.value)}
              disabled={!currentData.enabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password (optional)</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={currentData.password || ""}
              onChange={(e) => handleInputChange("password", e.target.value)}
              disabled={!currentData.enabled}
            />
          </div>
        </div>

        {/* QoS */}
        <div className="space-y-2">
          <Label htmlFor="qos">Quality of Service (QoS)</Label>
          <Select
            value={String(currentData.qos || 1)}
            onValueChange={(value) => handleInputChange("qos", parseInt(value, 10))}
            disabled={!currentData.enabled}
          >
            <SelectTrigger id="qos">
              <SelectValue placeholder="Select QoS level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">QoS 0 - At most once</SelectItem>
              <SelectItem value="1">QoS 1 - At least once (recommended)</SelectItem>
              <SelectItem value="2">QoS 2 - Exactly once</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Retain Flag */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="retain">Retain Messages</Label>
            <p className="text-sm text-muted-foreground">
              New subscribers receive last published message
            </p>
          </div>
          <Switch
            id="retain"
            checked={currentData.retain || false}
            onCheckedChange={(checked) => handleInputChange("retain", checked)}
            disabled={!currentData.enabled}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || !currentData.enabled}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Configuration
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || !currentData.enabled}
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...
              </>
            ) : (
              <>
                <TestTube2 className="mr-2 h-4 w-4" /> Test Connection
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MqttConfigPanel;
