import Layout from "@/components/Layout";
import BridgeStatusCard from "@/components/BridgeStatusCard";
import ScaleOperationsPanel from "@/components/ScaleOperationsPanel";

const Index = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Visual control panel for ScaleIT Bridge management.
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bridge Status Card */}
          <BridgeStatusCard />
          
          {/* Scale Operations Panel */}
          <div className="lg:col-span-2">
            <ScaleOperationsPanel />
          </div>
        </div>
        
        {/* Placeholder for Logs */}
        <div className="bg-card p-6 rounded-lg shadow border">
          <h3 className="text-xl font-semibold">Recent Requests Log</h3>
          <p className="mt-2 text-muted-foreground">Logs will appear here...</p>
        </div>
      </div>
    </Layout>
  );
};

export default Index;