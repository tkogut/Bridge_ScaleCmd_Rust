import Layout from "@/components/Layout";

const Index = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Visual control panel for ScaleIT Bridge management.
        </p>
        
        {/* Tutaj będą dodawane główne panele kontrolne */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Placeholder for Status Card */}
          <div className="bg-card p-6 rounded-lg shadow border">
            <h3 className="text-xl font-semibold">Bridge Status</h3>
            <p className="mt-2 text-muted-foreground">Loading...</p>
          </div>
          
          {/* Placeholder for Device Control */}
          <div className="lg:col-span-2 bg-card p-6 rounded-lg shadow border">
            <h3 className="text-xl font-semibold">Scale Operations</h3>
            <p className="mt-2 text-muted-foreground">Loading...</p>
          </div>
        </div>
        
        {/* Placeholder for Logs */}
        <div className="bg-card p-6 rounded-lg shadow border">
          <h3 className="text-xl font-semibold">Recent Requests Log</h3>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    </Layout>
  );
};

export default Index;