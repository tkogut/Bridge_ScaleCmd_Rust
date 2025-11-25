import Layout from "@/components/Layout";
import BridgeStatusCard from "@/components/BridgeStatusCard";
import ScaleOperationsPanel from "@/components/ScaleOperationsPanel";
import RecentRequestsLog from "@/components/RecentRequestsLog";

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
        
        {/* Recent Requests Log */}
        <RecentRequestsLog />
      </div>
    </Layout>
  );
};

export default Index;