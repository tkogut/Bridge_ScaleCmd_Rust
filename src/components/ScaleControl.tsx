import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { scaleService, DeviceInfo, ScaleResponse } from "@/services/scaleService";
import { useToast } from "@/hooks/use-toast";

export const ScaleControl = () => {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [weight, setWeight] = useState<string>("--");
  const [loading, setLoading] = useState<boolean>(false);
  const [devicesLoading, setDevicesLoading] = useState<boolean>(true);
  const { toast } = useToast();

  // Fetch available devices
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setDevicesLoading(true);
        const deviceList = await scaleService.getDevices();
        setDevices(deviceList);
        
        // Auto-select first enabled device
        const enabledDevice = deviceList.find(device => device.enabled);
        if (enabledDevice) {
          setSelectedDevice(enabledDevice.id);
        }
      } catch (error) {
        toast({
          title: "Error",
          description: `Failed to fetch devices: ${error.message}`,
          variant: "destructive"
        });
        console.error("Failed to fetch devices:", error);
      } finally {
        setDevicesLoading(false);
      }
    };

    fetchDevices();
  }, [toast]);

  // Send command to selected device
  const sendCommand = async (command: "readGross" | "readNet" | "tare" | "zero") => {
    if (!selectedDevice) {
      toast({
        title: "No Device Selected",
        description: "Please select a device first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      let response: ScaleResponse;
      
      switch (command) {
        case "readGross":
          response = await scaleService.readGross(selectedDevice);
          break;
        case "readNet":
          response = await scaleService.readNet(selectedDevice);
          break;
        case "tare":
          response = await scaleService.setTare(selectedDevice);
          break;
        case "zero":
          response = await scaleService.zeroScale(selectedDevice);
          break;
        default:
          throw new Error("Unknown command");
      }

      if (response.success) {
        if (command === "readGross" || command === "readNet") {
          setWeight(response.data?.value || "0.0");
          toast({
            title: "Success",
            description: `${command} command executed successfully`
          });
        } else {
          toast({
            title: "Success",
            description: `${command} command executed successfully`
          });
        }
      } else {
        throw new Error(response.error || "Command failed");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to execute ${command}: ${error.message}`,
        variant: "destructive"
      });
      console.error(`Failed to execute ${command}:`, error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Scale Control Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-2">Available Devices</h3>
          {devicesLoading ? (
            <p>Loading devices...</p>
          ) : devices.length === 0 ? (
            <p className="text-muted-foreground">No devices found</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedDevice === device.id
                      ? "border-primary bg-primary/10"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedDevice(device.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{device.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {device.manufacturer} {device.model}
                      </p>
                    </div>
                    <Badge variant={device.enabled ? "default" : "secondary"}>
                      {device.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center mt-2">
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      {device.protocol}
                    </span>
                    <span className="text-xs ml-2 px-2 py-1 rounded bg-secondary">
                      {device.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedDevice && (
          <div className="space-y-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Current Weight</p>
              <p className="text-3xl font-bold">{weight} kg</p>
              <p className="text-sm text-muted-foreground mt-1">
                Device: {devices.find(d => d.id === selectedDevice)?.name}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                onClick={() => sendCommand("readGross")}
                disabled={loading}
                variant="default"
              >
                Read Gross
              </Button>
              <Button
                onClick={() => sendCommand("readNet")}
                disabled={loading}
                variant="default"
              >
                Read Net
              </Button>
              <Button
                onClick={() => sendCommand("tare")}
                disabled={loading}
                variant="secondary"
              >
                Tare
              </Button>
              <Button
                onClick={() => sendCommand("zero")}
                disabled={loading}
                variant="secondary"
              >
                Zero
              </Button>
            </div>
          </div>
        )}

        {!selectedDevice && !devicesLoading && (
          <div className="text-center py-4 text-muted-foreground">
            Select a device to control
          </div>
        )}
      </CardContent>
    </Card>
  );
};