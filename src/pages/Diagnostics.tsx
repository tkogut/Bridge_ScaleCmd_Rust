import Layout from "@/components/Layout";
import DiagnosticsPanel from "@/components/DiagnosticsPanel";
import MqttTerminal from "@/components/MqttTerminal";

const Diagnostics = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Device Diagnostics</h2>
          <p className="text-muted-foreground">
            Real-time connection status, configuration details, protocol testing, and MQTT terminal for selected device.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DiagnosticsPanel />
          <MqttTerminal />
        </div>
      </div>
    </Layout>
  );
};

export default Diagnostics;