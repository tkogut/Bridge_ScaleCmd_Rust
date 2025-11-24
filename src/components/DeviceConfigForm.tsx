import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DeviceConfig, DeviceId } from "@/types/api";
import { saveDeviceConfig } from "@/services/bridge-api";
import { showSuccess, showError } from "@/utils/toast";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

// Schemat walidacji dla połączenia TCP
const TcpConnectionSchema = z.object({
  connection_type: z.literal("Tcp"),
  host: z.string().ip({ message: "Invalid IP address format" }),
  port: z.coerce.number().int().min(1).max(65535),
  timeout_ms: z.coerce.number().int().min(100).max(30000),
});

// Schemat walidacji dla połączenia Serial
const SerialConnectionSchema = z.object({
  connection_type: z.literal("Serial"),
  port: z.string().min(1, "Port path is required (e.g., COM1 or /dev/ttyUSB0)"),
  baud_rate: z.coerce.number().int().min(1).default(9600),
  timeout_ms: z.coerce.number().int().min(100).max(30000),
});

// Schemat walidacji dla konfiguracji urządzenia
const DeviceConfigSchema = z.object({
  deviceId: z.string().min(3, "Device ID must be at least 3 characters long").regex(/^[a-z0-9_]+$/, "Device ID must be lowercase alphanumeric or underscore"),
  name: z.string().min(3, "Name is required"),
  manufacturer: z.string().min(1, "Manufacturer is required"),
  model: z.string().min(1, "Model is required"),
  protocol: z.string().min(1, "Protocol is required"),
  connection_type: z.enum(["Tcp", "Serial"]),
  connection: z.union([TcpConnectionSchema, SerialConnectionSchema]),
  
  // Uproszczone pola dla komend (w pełni konfigurowalny Bridge wymagałby bardziej złożonego formularza)
  read_gross_cmd: z.string().min(1, "Command is required"),
  read_net_cmd: z.string().min(1, "Command is required"),
  tare_cmd: z.string().min(1, "Command is required"),
  zero_cmd: z.string().min(1, "Command is required"),
});

type DeviceFormValues = z.infer<typeof DeviceConfigSchema> & {
  host?: string;
  port?: number;
  baud_rate?: number;
};

interface DeviceConfigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConfig?: { id: DeviceId; config: DeviceConfig };
  onSaveSuccess: () => void;
}

const DeviceConfigForm: React.FC<DeviceConfigFormProps> = ({
  open,
  onOpenChange,
  initialConfig,
  onSaveSuccess,
}) => {
  const isEdit = !!initialConfig;
  
  // Funkcja pomocnicza do spłaszczania danych dla formularza
  const getInitialValues = (): Partial<DeviceFormValues> => {
    if (!initialConfig) {
      return {
        deviceId: "",
        name: "",
        manufacturer: "",
        model: "",
        protocol: "RINCMD",
        connection_type: "Tcp",
        host: "127.0.0.1",
        port: 4001,
        timeout_ms: 3000,
        read_gross_cmd: "",
        read_net_cmd: "",
        tare_cmd: "",
        zero_cmd: "",
      };
    }

    const { id, config } = initialConfig;
    const baseValues = {
      deviceId: id,
      name: config.name,
      manufacturer: config.manufacturer,
      model: config.model,
      protocol: config.protocol,
      connection_type: config.connection.connection_type,
      read_gross_cmd: config.commands.read_gross || "",
      read_net_cmd: config.commands.read_net || "",
      tare_cmd: config.commands.tare || "",
      zero_cmd: config.commands.zero || "",
      timeout_ms: config.connection.timeout_ms,
    };

    if (config.connection.connection_type === "Tcp") {
      return {
        ...baseValues,
        host: config.connection.host,
        port: config.connection.port,
      };
    } else if (config.connection.connection_type === "Serial") {
      return {
        ...baseValues,
        port: config.connection.port,
        baud_rate: config.connection.baud_rate,
      };
    }
    return baseValues;
  };

  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(DeviceConfigSchema),
    defaultValues: getInitialValues(),
    mode: "onChange",
  });
  
  // Resetowanie formularza przy otwarciu/zmianie initialConfig
  React.useEffect(() => {
    form.reset(getInitialValues());
  }, [initialConfig, open]);


  const connectionType = form.watch("connection_type");
  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: DeviceFormValues) => {
    const { deviceId, name, manufacturer, model, protocol, connection_type, read_gross_cmd, read_net_cmd, tare_cmd, zero_cmd, timeout_ms, ...connDetails } = values;

    let connection: DeviceConfig['connection'];

    if (connection_type === "Tcp") {
      connection = {
        connection_type: "Tcp",
        host: connDetails.host!,
        port: connDetails.port!,
        timeout_ms: timeout_ms,
      };
    } else if (connection_type === "Serial") {
      connection = {
        connection_type: "Serial",
        port: connDetails.port as unknown as string, // Port jest stringiem dla Serial
        baud_rate: connDetails.baud_rate!,
        timeout_ms: timeout_ms,
      };
    } else {
      // Powinno być niemożliwe dzięki Zod
      return;
    }

    const newConfig: DeviceConfig = {
      name,
      manufacturer,
      model,
      protocol,
      connection,
      commands: {
        read_gross: read_gross_cmd,
        read_net: read_net_cmd,
        tare: tare_cmd,
        zero: zero_cmd,
      },
    };

    try {
      await saveDeviceConfig(deviceId, newConfig);
      showSuccess(`Device '${name}' configuration saved successfully.`);
      onSaveSuccess();
      onOpenChange(false);
    } catch (error) {
      showError(`Failed to save configuration: ${(error as Error).message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Device Configuration" : "Add New Device"}</DialogTitle>
          <DialogDescription>
            Configure connection parameters and scale commands for the industrial device.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            
            {/* General Settings */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device ID</FormLabel>
                    <FormControl>
                      <Input placeholder="c320_line1" {...field} disabled={isEdit} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Production Line 1 Scale" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input placeholder="Rinstrum" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="C320" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="protocol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Protocol</FormLabel>
                    <FormControl>
                      <Input placeholder="RINCMD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />
            
            {/* Connection Settings */}
            <h3 className="text-lg font-semibold">Connection</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="connection_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Connection Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select connection type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Tcp">TCP/IP</SelectItem>
                        <SelectItem value="Serial">Serial Port</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="timeout_ms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timeout (ms)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="3000" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {connectionType === "Tcp" && (
                <>
                  <FormField
                    control={form.control}
                    name="host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Host IP</FormLabel>
                        <FormControl>
                          <Input placeholder="192.168.1.254" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Port</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="4001" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              
              {connectionType === "Serial" && (
                <>
                  <FormField
                    control={form.control}
                    name="port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Port Path</FormLabel>
                        <FormControl>
                          <Input placeholder="COM1 or /dev/ttyUSB0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="baud_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Baud Rate</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="9600" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>

            <Separator />

            {/* Command Settings */}
            <h3 className="text-lg font-semibold">Protocol Commands</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="read_gross_cmd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Read Gross Command</FormLabel>
                    <FormControl>
                      <Input placeholder="20050026" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="read_net_cmd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Read Net Command</FormLabel>
                    <FormControl>
                      <Input placeholder="20050025" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tare_cmd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tare Command</FormLabel>
                    <FormControl>
                      <Input placeholder="21120008:0C" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="zero_cmd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zero Command</FormLabel>
                    <FormControl>
                      <Input placeholder="21120008:0B" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save Changes" : "Add Device"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceConfigForm;