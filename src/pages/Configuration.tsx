import Layout from "@/components/Layout";
import React from "react";

const Configuration = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <h2 className="text-3xl font-bold tracking-tight">Device Configuration</h2>
        <p className="text-muted-foreground">
          Manage industrial scale devices, connection settings, and command protocols.
        </p>
        
        {/* Tutaj dodamy komponenty do zarządzania urządzeniami */}
        <div className="p-6 border rounded-lg bg-card">
            <p className="text-muted-foreground">Configuration management interface coming soon...</p>
        </div>
      </div>
    </Layout>
  );
};

export default Configuration;