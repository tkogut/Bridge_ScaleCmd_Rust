import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DeviceConfig, DeviceId } from "@/types/api";
import { getAllDeviceConfigs, saveDeviceConfig } from "@/services/bridge-api";
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
import { Switch } from "@/components/ui/switch";

// Validation schema for device configuration
const DeviceConfigSchema = z.object({
  deviceId: z.string().min(3, "Device ID must be at least 3 characters long").regex(/^[a-z0-9_]+$/, "Device ID must be lowercase alphanumeric or underscore"),
  name: z.string().min(3, "Name is required"),
  manufacturer: z.string().min(1, "Manufacturer is required"),
  model: z.string().min(1, "Model is required"),
  protocol: z.string().min(1, "Protocol is required"),
  connection_type: z.enum(["Tcp", "Serial"]),
  host: z.string().optional(),
  tcp_port: z.coerce.number().int().min(1).max(65535).optional(),
  serial_port: z.string().optional(),
  baud_rate: z.coerce.number().int().min(1).optional(),
  timeout_ms: z.coerce.number().int().min(100).max(30000),

  read_gross_cmd: z.string().min(1, "Command is required"),
  read_net_cmd: z.string().min(1, "Command is required"),
  tare_cmd: z.string().min(1, "Command is required"),
  zero_cmd: z.string().min(1, "Command is required"),
  enabled: z.boolean().default(true),
}).superRefine((values, ctx) => {
  if (values.connection_type === "Tcp") {
    if (!values.host) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["host"],
        message: "Host IP is required for TCP connections",
      });
    }
    if (values.tcp_port === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tcp_port"],
        message: "Port is required for TCP connections",
      });
    }
  } else if (values.connection_type === "Serial") {
    if (!values.serial_port) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serial_port"],
        message: "Serial port path is required",
      });
    }
    if (values.baud_rate === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baud_rate"],
        message: "Baud rate is required for serial connections",
      });
    }
  }
});

type DeviceFormValues = z.infer<typeof DeviceConfigSchema>;

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

  const getInitialValues = React.useCallback((): Partial<DeviceFormValues> => {
    if (!initialConfig) {
      return {
        deviceId: "",
        name: "",
        manufacturer: "Rinstrum",
        model: "C320",
        protocol: "RINCMD",
        connection_type: "Tcp",
        host: "192.168.1.254",
        tcp_port: 4001,
        serial_port: "",
        baud_rate: 9600,
        timeout_ms: 1000,
        read_gross_cmd: "20050026",
        read_net_cmd: "20050025",
        tare_cmd: "21120008:0C",
        zero_cmd: "21120008:0B",
        enabled: true,
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
      read_gross_cmd: config.commands["readGross"] || "",
      read_net_cmd: config.commands["readNet"] || "",
      tare_cmd: config.commands["tare"] || "",
      zero_cmd: config.commands["zero"] || "",
      timeout_ms: config.connection.timeout_ms,
      enabled: config.enabled ?? true,
    };

    if (config.connection.connection_type === "Tcp") {
      return {
        ...baseValues,
        host: config.connection.host,
        tcp_port: config.connection.port,
      };
    } else {
      return {
        ...baseValues,
        serial_port: config.connection.port,
        baud_rate: config.connection.baud_rate,
      };
    }
  }, [initialConfig]);

  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(DeviceConfigSchema),
    defaultValues: getInitialValues(),
  });

  React.useEffect(() => {
    if (open) {
      form.reset(getInitialValues());
    }
  }, [getInitialValues, open, form]);

  const connectionType = form.watch("connection_type");
  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: DeviceFormValues) => {
    const {
      deviceId,
      name,
      manufacturer,
      model,
      protocol,
      connection_type,
      read_gross_cmd,
      read_net_cmd,
      tare_cmd,
      zero_cmd,
      timeout_ms,
      host,
      tcp_port,
      serial_port,
      baud_rate,
      enabled,
    } = values;

    let connection: DeviceConfig["connection"];

    if (connection_type === "Tcp") {
      connection = {
        connection_type: "Tcp",
        host: host!,
        port: tcp_port!,
        timeout_ms,
      };
    } else {
      connection = {
        connection_type: "Serial",
        port: serial_port!,
        baud_rate: baud_rate!,
        timeout_ms,
      };
    }

    const newConfig: DeviceConfig = {
      name,
      manufacturer,
      model,
      protocol,
      connection,
      commands: {
        readGross: read_gross_cmd,
        readNet: read_net_cmd,
        tare: tare_cmd,
        zero: zero_cmd,
      },
      enabled,
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Device" : "Add New Device"}</DialogTitle>
          <DialogDescription>
            Configure connection and protocol settings for your industrial scale.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. scale_1" {...field} disabled={isEdit} />
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
                    <FormLabel>Friendly Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Main Production Scale" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Rinstrum" {...field} />
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
                      <Input placeholder="e.g. C320" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Connection Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="connection_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {connectionType === "Tcp" ? (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IP Address</FormLabel>
                        <FormControl>
                          <Input placeholder="192.168.1.254" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tcp_port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Port</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="4001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="serial_port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>COM Port</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. COM3" {...field} />
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
                          <Input type="number" placeholder="9600" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Protocol & Commands</h3>
              <FormField
                control={form.control}
                name="protocol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Protocol Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. RINCMD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="read_gross_cmd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Read Gross</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Read Net</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Tare</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Zero</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Enabled</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Whether this device is active and connecting.
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Update Device" : "Create Device"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceConfigForm;