import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMqttDevices, getMqttHistory, getMqttLatest, getMqttStatus, sendMqttCommand, MqttDeviceInfo } from "@/services/mqtt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Terminal,
  Send,
  Play,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  MessageSquare,
  Clock,
  Database
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MqttMessage {
  id: string;
  timestamp: Date;
  topic: string;
  payload: any;
  direction: 'received' | 'sent';
}

const MqttTerminal: React.FC = () => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [manualDeviceId, setManualDeviceId] = useState<string>("");
  const [command, setCommand] = useState("");
  const [messages, setMessages] = useState<MqttMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Get available devices with MQTT history
  const { data: devicesData, isLoading: isLoadingDevices } = useQuery({
    queryKey: ["mqttDevices"],
    queryFn: getMqttDevices,
    refetchInterval: 10000,
  });

  // Get MQTT status
  const { data: mqttStatus } = useQuery({
    queryKey: ["mqttStatus"],
    queryFn: getMqttStatus,
    refetchInterval: 5000, // Check every 5 seconds
  });

  // Get latest readings for selected device
  const { data: latestData, refetch: refetchLatest } = useQuery({
    queryKey: ["mqttLatest", selectedDeviceId],
    queryFn: () => selectedDeviceId ? getMqttLatest(selectedDeviceId) : Promise.resolve(null),
    enabled: !!selectedDeviceId,
  });

  // Get history for selected device
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ["mqttHistory", selectedDeviceId],
    queryFn: () => selectedDeviceId ? getMqttHistory(selectedDeviceId, { limit: 10 }) : Promise.resolve(null),
    enabled: !!selectedDeviceId,
  });

  const devices = devicesData?.devices || [];

  // Auto-select first device when devices are loaded
  React.useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      const firstDevice = devices[0];
      if (firstDevice && firstDevice.device_id) {
        setSelectedDeviceId(firstDevice.device_id);
      }
    }
  }, [devices]); // Only depend on devices to avoid infinite loops

  // Use real MQTT connection status
  const isMqttConnected = mqttStatus?.connected || false;

  // Allow commands when connected and either a device is selected or manual ID is entered
  const canSendCommands = isMqttConnected && (selectedDeviceId || (devices.length === 0 && manualDeviceId.trim()));

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);



  const addMessage = (topic: string, payload: any, direction: 'received' | 'sent') => {
    const message: MqttMessage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      topic,
      payload,
      direction,
    };
    setMessages(prev => [...prev.slice(-19), message]); // Keep last 20 messages
  };

  const handleSendCommand = async () => {
    if (!command.trim() || !canSendCommands) {
      toast({
        title: "Error",
        description: "Please enter a command and ensure MQTT is connected and a device is selected",
        variant: "destructive",
      });
      return;
    }

    // Use selected device ID or manual device ID
    const deviceId = selectedDeviceId || manualDeviceId.trim();

    try {
      // Send MQTT command using the API
      const topic = `scaleit/command/${deviceId}`;
      const payload = {
        device_id: deviceId,
        command: command.trim(),
        timestamp: Date.now()
      };

      // Add sent message to the UI
      addMessage(topic, payload, 'sent');

      // Send the MQTT command
      const response = await sendMqttCommand({
        topic,
        payload,
        qos: 1,
        retain: false
      });

      toast({
        title: "Command Sent",
        description: response.message,
      });

      setCommand("");

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send MQTT command";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleRefreshData = () => {
    if (selectedDeviceId) {
      refetchLatest();
      refetchHistory();
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendCommand();
    }
  };

  const formatPayload = (payload: any): string => {
    if (typeof payload === 'string') return payload;
    return JSON.stringify(payload, null, 2);
  };

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString();
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          MQTT Terminal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          {isMqttConnected ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
              <Wifi className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : mqttStatus?.enabled ? (
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
              <WifiOff className="h-3 w-3 mr-1" />
              Connecting
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
              <WifiOff className="h-3 w-3 mr-1" />
              Disabled
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            MQTT broker connection status
            {mqttStatus?.broker_url && ` • ${mqttStatus.broker_url}`}
          </span>
        </div>

        {/* Device Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Device</label>
          {isLoadingDevices ? (
            <div className="text-sm text-muted-foreground">Loading devices...</div>
          ) : devices.length === 0 ? (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded">
                No devices with MQTT history found. Enter a device ID manually to send commands.
              </div>
              <div className="flex gap-2">
                <Input
                  value={manualDeviceId}
                  onChange={(e) => setManualDeviceId(e.target.value)}
                  placeholder="Enter device ID (e.g., scale1)"
                  className="flex-1"
                />
                <Button
                  onClick={() => setSelectedDeviceId(manualDeviceId.trim())}
                  disabled={!manualDeviceId.trim()}
                  size="sm"
                >
                  Use
                </Button>
              </div>
            </div>
          ) : (
            <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device: MqttDeviceInfo) => (
                  <SelectItem key={device.device_id} value={device.device_id}>
                    <div className="flex items-center gap-2">
                      <span>{device.device_id}</span>
                      <Badge variant="secondary" className="text-xs">
                        {device.weight_readings_count} readings
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Separator />

        {/* Command Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Send MQTT Command</label>
          <div className="flex gap-2">
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter command (e.g., read_gross, tare, zero)"
              disabled={!canSendCommands}
            />
            <Button
              onClick={handleSendCommand}
              disabled={!command.trim() || !canSendCommands}
              size="sm"
            >
              <Send className="h-4 w-4 mr-1" />
              Send
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Press Enter to send command. Commands will be published to topic: scaleit/command/{selectedDeviceId || manualDeviceId.trim() || 'device_id'}
          </p>
        </div>

        <Separator />

        {/* Quick Commands */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Quick Commands</label>
          <div className="flex flex-wrap gap-2">
            {["read_gross", "read_net", "tare", "zero", "read_status"].map((cmd) => (
              <Button
                key={cmd}
                variant="outline"
                size="sm"
                onClick={() => setCommand(cmd)}
                disabled={!canSendCommands}
              >
                <Play className="h-3 w-3 mr-1" />
                {cmd}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Messages Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              MQTT Messages
            </label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshData}
                disabled={!selectedDeviceId}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearMessages}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>

          <ScrollArea className="h-64 w-full border rounded-md p-3">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No MQTT messages yet</p>
                <p className="text-xs">Send a command to see messages appear</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg border ${
                      msg.direction === 'received'
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                        : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={msg.direction === 'received' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {msg.direction === 'received' ? 'RX' : 'TX'}
                        </Badge>
                        <code className="text-xs font-mono bg-background px-2 py-1 rounded">
                          {msg.topic}
                        </code>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(msg.timestamp)}
                      </div>
                    </div>
                    <pre className="text-xs bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap">
                      {formatPayload(msg.payload)}
                    </pre>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Latest Device Data */}
        {latestData && (
          <>
            <Separator />
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                Latest Device Data
              </label>
              {latestData.latest_weight && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm">
                    <strong>Latest Weight:</strong> {latestData.latest_weight.weight.toFixed(2)} {latestData.latest_weight.unit}
                    {latestData.latest_weight.is_stable && (
                      <Badge variant="secondary" className="ml-2 text-xs">Stable</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MqttTerminal;