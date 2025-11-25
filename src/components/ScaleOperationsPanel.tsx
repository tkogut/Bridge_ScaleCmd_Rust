import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getDevices, executeScaleCommand } from "@/services/bridge-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, WeightReading, DeviceId } from "@/types/api";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useLogContext } from "@/context/LogContext";

const ScaleOperationsPanel = () => {
  const { addLog } = useLogContext();
  const [selectedDeviceId, setSelectedDeviceId] = useState<DeviceId | undefined>(undefined);
  const [lastReading, setLastReading] = useState<WeightReading | null>(null);

  // 1. Pobieranie listy urządzeń
  const { data: devicesData, isLoading: isLoadingDevices, error: devicesError } = useQuery({
    queryKey: ["devices"],
    queryFn: getDevices,
    staleTime: Infinity,
  });

  const devices = devicesData?.devices || [];

  React.useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0][0]); // Ustawienie pierwszego urządzenia jako domyślnego
    }
  }, [devices, selectedDeviceId]);

  // 2. Mutacja do wykonywania komend
  const commandMutation = useMutation({
    mutationFn: (command: Command) => executeScaleCommand({ device_id: selectedDeviceId!, command }),
    onMutate: (command) => {
      return showLoading(`Executing '${command}' on ${selectedDeviceId}...`);
    },
    onSuccess: (response, command, toastId) => {
      dismissToast(toastId as string);
      
      if (response.success && response.result && 'gross_weight' in response.result) {
        setLastReading(response.result as WeightReading);
        showSuccess(`Successfully read weight: ${response.result.gross_weight} ${response.result.unit}`);
      } else if (response.success && response.result && 'message' in response.result) {
        showSuccess(`Command '${command}' successful: ${response.result.message}`);
        setLastReading(null); // Resetowanie odczytu dla komend sterujących (tare/zero)
      } else {
        showError(`Command failed: ${response.error || "Unknown error"}`);
      }
      
      addLog(selectedDeviceId!, command, response);
    },
    onError: (error, command, toastId) => {
      dismissToast(toastId as string);
      showError(`API Error during '${command}': ${error.message}`);
      
      // Symulacja odpowiedzi błędu dla logowania
      addLog(selectedDeviceId!, command, { success: false, device_id: selectedDeviceId!, command, error: error.message }, error);
    },
  });

  const handleCommand = (command: Command) => {
    if (selectedDeviceId) {
      commandMutation.mutate(command);
    } else {
      showError("Please select a device first.");
    }
  };

  const renderWeightDisplay = () => {
    if (commandMutation.isPending) {
      return (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (lastReading) {
      return (
        <div className="text-center p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Last Stable Reading ({lastReading.timestamp.split('T')[1].slice(0, 8)}):</p>
          <div className="flex justify-center items-baseline space-x-2 mt-1">
            <span className="text-6xl font-extrabold tracking-tighter text-primary">
              {lastReading.gross_weight.toFixed(2)}
            </span>
            <span className="text-2xl font-semibold text-muted-foreground">
              {lastReading.unit}
            </span>
          </div>
          <div className="text-sm mt-2">
            Net: {lastReading.net_weight.toFixed(2)} {lastReading.unit}
          </div>
          <div className="flex justify-center items-center mt-2 text-xs">
            {lastReading.is_stable ? (
              <span className="text-green-600 flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" /> Stable
              </span>
            ) : (
              <span className="text-yellow-600 flex items-center">
                <XCircle className="h-3 w-3 mr-1" /> Unstable
              </span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="text-center p-4 h-24 flex items-center justify-center text-muted-foreground">
        No recent weight reading.
      </div>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Scale Operations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Device Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Select Device
          </label>
          {isLoadingDevices ? (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading devices...
            </div>
          ) : devicesError ? (
            <div className="text-sm text-destructive">
              Error loading devices: {devicesError.message}
            </div>
          ) : devices.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No devices configured.
            </div>
          ) : (
            <Select
              value={selectedDeviceId}
              onValueChange={(value) => setSelectedDeviceId(value)}
              disabled={commandMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map(([id, name, model]) => (
                  <SelectItem key={id} value={id}>
                    {name} ({model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Separator />

        {/* Command Buttons */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Commands</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Button 
              onClick={() => handleCommand("readGross")} 
              disabled={!selectedDeviceId || commandMutation.isPending}
              variant="outline"
            >
              Read Gross
            </Button>
            <Button 
              onClick={() => handleCommand("readNet")} 
              disabled={!selectedDeviceId || commandMutation.isPending}
              variant="outline"
            >
              Read Net
            </Button>
            <Button 
              onClick={() => handleCommand("tare")} 
              disabled={!selectedDeviceId || commandMutation.isPending}
              variant="secondary"
            >
              Tare
            </Button>
            <Button 
              onClick={() => handleCommand("zero")} 
              disabled={!selectedDeviceId || commandMutation.isPending}
              variant="destructive"
            >
              Zero
            </Button>
          </div>
        </div>

        <Separator />

        {/* Weight Display */}
        {renderWeightDisplay()}
      </CardContent>
    </Card>
  );
};

export default ScaleOperationsPanel;