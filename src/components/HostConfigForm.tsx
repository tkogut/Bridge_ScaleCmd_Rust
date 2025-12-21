import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { HostConfig } from "@/types/api";
import { saveHost, getAllHosts } from "@/services/bridge-api";
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
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

const HostConfigSchema = z.object({
  hostId: z.string()
    .min(3, "Host ID must be at least 3 characters long")
    .regex(/^[a-zA-Z0-9_]+$/, "Host ID must be alphanumeric or underscore"),
  name: z.string().min(3, "Name is required"),
  connection_type: z.enum(["Tcp", "Serial"]),
  host: z.string().optional(),
  tcp_port: z.union([
    z.coerce.number().int().max(65535),
    z.null(),
    z.undefined(),
    z.literal(""),
  ]).optional(),
  serial_port: z.string().optional(),
  baud_rate: z.union([
    z.coerce.number().int(),
    z.null(),
    z.undefined(),
    z.literal(""),
  ]).optional(),
  data_bits: z.union([
    z.coerce.number().int().min(5).max(8),
    z.null(),
    z.undefined(),
    z.literal(""),
  ]).optional(),
  stop_bits: z.enum(["one", "two"]).optional(),
  parity: z.enum(["none", "even", "odd"]).optional(),
  flow_control: z.enum(["none", "software", "hardware"]).optional(),
  timeout_ms: z.coerce.number().int().min(100).max(30000),
  enabled: z.boolean().default(true),
}).superRefine((values, ctx) => {
  if (values.connection_type === "Tcp") {
    if (!values.host || values.host.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["host"],
        message: "Host IP is required for TCP connections",
      });
    } else {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(values.host.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["host"],
          message: "Invalid IP address format",
        });
      }
    }
    if (values.tcp_port === undefined || values.tcp_port === null || values.tcp_port === 0 || values.tcp_port === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tcp_port"],
        message: "Port is required for TCP connections",
      });
    }
  } else if (values.connection_type === "Serial") {
    if (!values.serial_port || values.serial_port.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serial_port"],
        message: "Serial port is required",
      });
    }
    if (values.baud_rate === undefined || values.baud_rate === null || values.baud_rate === 0 || values.baud_rate === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baud_rate"],
        message: "Baud rate is required",
      });
    }
  }
});

type HostFormValues = z.infer<typeof HostConfigSchema>;

interface HostConfigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConfig?: { id: string; config: HostConfig };
  onSaveSuccess: () => void;
}

const HostConfigForm: React.FC<HostConfigFormProps> = ({
  open,
  onOpenChange,
  initialConfig,
  onSaveSuccess,
}) => {
  const isEdit = !!initialConfig;

  const getInitialValues = React.useCallback((): Partial<HostFormValues> => {
    if (!initialConfig) {
      return {
        hostId: "",
        name: "",
        connection_type: "Tcp",
        host: "192.168.1.254",
        tcp_port: 4001,
        serial_port: undefined,
        baud_rate: undefined,
        data_bits: 8,
        stop_bits: "one",
        parity: "none",
        flow_control: "none",
        timeout_ms: 1000,
        enabled: true,
      };
    }

    const { id, config } = initialConfig;
    const baseValues: Partial<HostFormValues> = {
      hostId: id,
      name: config.name,
      timeout_ms: config.timeout_ms ?? 1000,
      enabled: config.enabled ?? true,
    };

    if (config.connection.connection_type === "Tcp") {
      return {
        ...baseValues,
        connection_type: "Tcp",
        host: config.connection.host,
        tcp_port: config.connection.port,
      };
    } else if (config.connection.connection_type === "Serial") {
      return {
        ...baseValues,
        connection_type: "Serial",
        serial_port: config.connection.port,
        baud_rate: config.connection.baud_rate,
        data_bits: config.connection.data_bits ?? 8,
        stop_bits: config.connection.stop_bits ?? "one",
        parity: config.connection.parity ?? "none",
        flow_control: config.connection.flow_control ?? "none",
      };
    }
    return baseValues;
  }, [initialConfig]);

  const form = useForm<HostFormValues>({
    resolver: zodResolver(HostConfigSchema),
    defaultValues: getInitialValues(),
    mode: "onChange",
  });

  React.useEffect(() => {
    if (open) {
      const initialValues = getInitialValues();
      form.reset(initialValues);
    } else {
      form.reset();
    }
  }, [getInitialValues, open, form]);

  const connectionType = form.watch("connection_type");
  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: HostFormValues) => {
    const {
      hostId,
      name,
      connection_type,
      host,
      tcp_port,
      serial_port,
      baud_rate,
      data_bits,
      stop_bits,
      parity,
      flow_control,
      timeout_ms,
      enabled,
    } = values;

    const normalizedHostId = hostId.toLowerCase().trim();

    if (!isEdit) {
      try {
        const existingHosts = await getAllHosts();
        if (existingHosts[normalizedHostId]) {
          showError(`Host ID '${normalizedHostId}' already exists.`);
          form.setError("hostId", {
            type: "manual",
            message: "Host ID already exists",
          });
          return;
        }
      } catch (error) {
        console.warn("Could not check existing hosts:", error);
      }
    }

    let connection: HostConfig["connection"];
    if (connection_type === "Tcp") {
      connection = {
        connection_type: "Tcp",
        host: host!.trim(),
        port: tcp_port as number,
      };
    } else {
      connection = {
        connection_type: "Serial",
        port: serial_port!.trim(),
        baud_rate: baud_rate as number,
        data_bits: data_bits ?? 8,
        stop_bits: stop_bits ?? "one",
        parity: parity ?? "none",
        flow_control: flow_control ?? "none",
      };
    }

    const config: HostConfig = {
      name: name.trim(),
      connection,
      timeout_ms,
      enabled,
    };

    try {
      await saveHost(normalizedHostId, config);
      showSuccess(`Host ${isEdit ? "updated" : "created"} successfully.`);
      onSaveSuccess();
      onOpenChange(false);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : `Failed to ${isEdit ? "update" : "create"} host.`
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Host" : "Add New Host"}</DialogTitle>
          <DialogDescription>
            Configure host connection settings (TCP/IP or Serial).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="hostId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., host1"
                      disabled={isEdit}
                    />
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
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Main Scale Host" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="connection_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select connection type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Tcp">TCP/IP</SelectItem>
                      <SelectItem value="Serial">Serial</SelectItem>
                    </SelectContent>
                  </Select>
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
                      <FormLabel>Host IP Address</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="192.168.1.254" />
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
                        <Input
                          type="number"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
                                : parseInt(e.target.value, 10)
                            )
                          }
                          placeholder="4001"
                        />
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
                  name="serial_port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Port</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="COM1" />
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
                        <Input
                          type="number"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
                                : parseInt(e.target.value, 10)
                            )
                          }
                          placeholder="9600"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="data_bits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Bits</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(parseInt(value, 10))
                        }
                        defaultValue={field.value?.toString() ?? "8"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="6">6</SelectItem>
                          <SelectItem value="7">7</SelectItem>
                          <SelectItem value="8">8</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stop_bits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stop Bits</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? "one"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="one">One</SelectItem>
                          <SelectItem value="two">Two</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parity</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="even">Even</SelectItem>
                          <SelectItem value="odd">Odd</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="flow_control"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flow Control</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="software">Software</SelectItem>
                          <SelectItem value="hardware">Hardware</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="timeout_ms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timeout (ms)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value, 10))
                      }
                      placeholder="1000"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Enabled</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEdit ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default HostConfigForm;

