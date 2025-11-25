import Layout from "@/components/Layout";
import DiagnosticsPanel from "@/components/DiagnosticsPanel";

const Diagnostics = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <h2 className="text-3xl font-bold tracking-tight">Device Diagnostics</h2>
        <p className="text-muted-foreground">
          Real-time connection status, configuration details, and protocol testing for selected device.
        </p>
        
        <DiagnosticsPanel />
      </div>
    </Layout>
  );
};

export default Diagnostics;