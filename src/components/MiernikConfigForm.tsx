import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { MiernikConfig } from "@/types/api";
import { saveMiernik, getAllMierniki } from "@/services/bridge-api";
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

const MiernikConfigSchema = z.object({
  miernikId: z.string()
    .min(3, "Miernik ID must be at least 3 characters long")
    .regex(/^[a-zA-Z0-9_]+$/, "Miernik ID must be alphanumeric or underscore"),
  name: z.string().min(3, "Name is required"),
  protocol: z.string().min(1, "Protocol is required"),
  manufacturer: z.string().min(1, "Manufacturer is required"),
  model: z.string().min(1, "Model is required"),
  read_gross_cmd: z.string().min(1, "Command is required"),
  read_net_cmd: z.string().min(1, "Command is required"),
  tare_cmd: z.string().min(1, "Command is required"),
  zero_cmd: z.string().min(1, "Command is required"),
  enabled: z.boolean().default(true),
});

type MiernikFormValues = z.infer<typeof MiernikConfigSchema>;

interface MiernikConfigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConfig?: { id: string; config: MiernikConfig };
  onSaveSuccess: () => void;
}

const MiernikConfigForm: React.FC<MiernikConfigFormProps> = ({
  open,
  onOpenChange,
  initialConfig,
  onSaveSuccess,
}) => {
  const isEdit = !!initialConfig;

  const getInitialValues = React.useCallback((): Partial<MiernikFormValues> => {
    if (!initialConfig) {
      return {
        miernikId: "",
        name: "",
        protocol: "RINCMD",
        manufacturer: "",
        model: "",
        read_gross_cmd: "",
        read_net_cmd: "",
        tare_cmd: "",
        zero_cmd: "",
        enabled: true,
      };
    }

    const { id, config } = initialConfig;
    return {
      miernikId: id,
      name: config.name,
      protocol: config.protocol,
      manufacturer: config.manufacturer,
      model: config.model,
      read_gross_cmd: config.commands["readGross"] || config.commands["readgross"] || "",
      read_net_cmd: config.commands["readNet"] || config.commands["readnet"] || "",
      tare_cmd: config.commands["tare"] || "",
      zero_cmd: config.commands["zero"] || "",
      enabled: config.enabled ?? true,
    };
  }, [initialConfig]);

  const form = useForm<MiernikFormValues>({
    resolver: zodResolver(MiernikConfigSchema),
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

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: MiernikFormValues) => {
    const {
      miernikId,
      name,
      protocol,
      manufacturer,
      model,
      read_gross_cmd,
      read_net_cmd,
      tare_cmd,
      zero_cmd,
      enabled,
    } = values;

    const normalizedMiernikId = miernikId.toLowerCase().trim();

    if (!isEdit) {
      try {
        const existingMierniki = await getAllMierniki();
        if (existingMierniki[normalizedMiernikId]) {
          showError(`Miernik ID '${normalizedMiernikId}' already exists.`);
          form.setError("miernikId", {
            type: "manual",
            message: "Miernik ID already exists",
          });
          return;
        }
      } catch (error) {
        console.warn("Could not check existing mierniki:", error);
      }
    }

    const config: MiernikConfig = {
      name: name.trim(),
      protocol: protocol.trim(),
      manufacturer: manufacturer.trim(),
      model: model.trim(),
      commands: {
        readGross: read_gross_cmd.trim(),
        readNet: read_net_cmd.trim(),
        tare: tare_cmd.trim(),
        zero: zero_cmd.trim(),
      },
      enabled,
    };

    try {
      await saveMiernik(normalizedMiernikId, config);
      showSuccess(`Miernik ${isEdit ? "updated" : "created"} successfully.`);
      onSaveSuccess();
      onOpenChange(false);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : `Failed to ${isEdit ? "update" : "create"} miernik.`
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Miernik" : "Add New Miernik"}</DialogTitle>
          <DialogDescription>
            Configure indicator protocol and commands.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="miernikId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Miernik ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., miernik1"
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
                    <Input {...field} placeholder="e.g., Rinstrum C320" />
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
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select protocol" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="RINCMD">RINCMD</SelectItem>
                      <SelectItem value="DINI_ARGEO">DINI_ARGEO</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <Input {...field} placeholder="e.g., Rinstrum" />
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
                    <Input {...field} placeholder="e.g., C320" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Commands</h4>
              
              <FormField
                control={form.control}
                name="read_gross_cmd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Read Gross Command</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., 20050026" />
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
                      <Input {...field} placeholder="e.g., 20050025" />
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
                      <Input {...field} placeholder="e.g., 21120008:0C" />
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
                      <Input {...field} placeholder="e.g., 21120008:0B" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

export default MiernikConfigForm;

