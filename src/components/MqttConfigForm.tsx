import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { MqttConfig } from "@/services/mqtt-api";
import { saveMqttConfig, getMqttConfig } from "@/services/mqtt-api";
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
import { Loader2, Wifi, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const MqttConfigSchema = z.object({
  enabled: z.boolean().default(false),
  broker_url: z.string()
    .min(1, "Broker URL is required")
    .regex(/^(mqtt|mqtts|tcp|ssl):\/\/.+/, "Invalid broker URL format (use mqtt://host:port)"),
  client_id: z.string()
    .min(1, "Client ID is required")
    .regex(/^[a-zA-Z0-9_-]+$/, "Client ID must be alphanumeric with underscores or hyphens"),
  topic_prefix: z.string()
    .min(1, "Topic prefix is required")
    .regex(/^[a-zA-Z0-9_-]+$/, "Topic prefix must be alphanumeric with underscores or hyphens"),
  username: z.string().optional(),
  password: z.string().optional(),
  qos: z.union([
    z.coerce.number().int().min(0).max(2),
    z.null(),
    z.undefined(),
  ]).optional(),
  retain: z.boolean().default(false),
}).superRefine((values, ctx) => {
  if (values.enabled) {
    // Validate broker URL format more strictly when enabled
    try {
      const url = new URL(values.broker_url);
      if (!['mqtt:', 'mqtts:', 'tcp:', 'ssl:'].includes(url.protocol)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["broker_url"],
          message: "Protocol must be mqtt, mqtts, tcp, or ssl",
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["broker_url"],
        message: "Invalid URL format",
      });
    }
  }
});

type MqttFormValues = z.infer<typeof MqttConfigSchema>;

interface MqttConfigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveSuccess: () => void;
}

const MqttConfigForm: React.FC<MqttConfigFormProps> = ({
  open,
  onOpenChange,
  onSaveSuccess,
}) => {
  const queryClient = useQueryClient();

  // Fetch current MQTT configuration
  const { data: currentConfig, isLoading: isLoadingConfig, error: configError } = useQuery({
    queryKey: ["mqttConfig"],
    queryFn: getMqttConfig,
    enabled: open,
    retry: false,
  });

  const form = useForm<MqttFormValues>({
    resolver: zodResolver(MqttConfigSchema),
    defaultValues: {
      enabled: false,
      broker_url: "mqtt://localhost:1883",
      client_id: "scaleit-bridge",
      topic_prefix: "scaleit",
      username: "",
      password: "",
      qos: 1,
      retain: false,
    },
    mode: "onChange",
  });

  // Update form when config is loaded
  React.useEffect(() => {
    if (currentConfig && open) {
      form.reset({
        enabled: currentConfig.enabled,
        broker_url: currentConfig.broker_url,
        client_id: currentConfig.client_id,
        topic_prefix: currentConfig.topic_prefix,
        username: currentConfig.username || "",
        password: currentConfig.password || "",
        qos: currentConfig.qos,
        retain: currentConfig.retain,
      });
    } else if (open && !currentConfig) {
      // Reset to defaults if no config exists
      form.reset({
        enabled: false,
        broker_url: "mqtt://localhost:1883",
        client_id: "scaleit-bridge",
        topic_prefix: "scaleit",
        username: "",
        password: "",
        qos: 1,
        retain: false,
      });
    }
  }, [currentConfig, open, form]);

  const saveMutation = useMutation({
    mutationFn: (config: MqttConfig) => saveMqttConfig(config),
    onSuccess: () => {
      showSuccess("MQTT configuration saved successfully. Restart the server for changes to take effect.");
      queryClient.invalidateQueries({ queryKey: ["mqttConfig"] });
      queryClient.invalidateQueries({ queryKey: ["mqttStatus"] });
      onSaveSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const onSubmit = async (values: MqttFormValues) => {
    const config: MqttConfig = {
      enabled: values.enabled,
      broker_url: values.broker_url,
      client_id: values.client_id,
      topic_prefix: values.topic_prefix,
      username: values.username || undefined,
      password: values.password || undefined,
      qos: values.qos || 1,
      retain: values.retain,
    };

    saveMutation.mutate(config);
  };

  const isSubmitting = saveMutation.isPending;
  const isLoading = isLoadingConfig || isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            MQTT Configuration
          </DialogTitle>
          <DialogDescription>
            Configure MQTT settings for publishing weight readings and receiving commands.
            Changes require server restart to take effect.
          </DialogDescription>
        </DialogHeader>

        {isLoadingConfig ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading MQTT configuration...</span>
          </div>
        ) : configError ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-destructive mb-2">⚠️ MQTT Configuration API Not Available</div>
            <div className="text-sm text-muted-foreground">
              The backend needs to be rebuilt to enable MQTT configuration through the UI.
              <br />
              For now, use environment variables to configure MQTT.
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable MQTT</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Enable MQTT publishing and subscribing functionality
                      </div>
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="broker_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Broker URL</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="mqtt://localhost:1883"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client ID</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="scaleit-bridge"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="topic_prefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Topic Prefix</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="scaleit"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="qos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>QoS Level</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value, 10))}
                        defaultValue={field.value?.toString() ?? "1"}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">0 - At Most Once</SelectItem>
                          <SelectItem value="1">1 - At Least Once</SelectItem>
                          <SelectItem value="2">2 - Exactly Once</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="MQTT username"
                          type="text"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="MQTT password"
                          type="password"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="retain"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Retain Messages</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Keep the last message on each topic for new subscribers
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("enabled") && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Server Restart Required
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        MQTT configuration changes require a server restart to take effect.
                        After saving, please restart the ScaleIT Bridge service.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Configuration
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MqttConfigForm;