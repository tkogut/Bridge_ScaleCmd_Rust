import React from "react";
import SidebarNav from "@/components/SidebarNav";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-card shadow-sm">
        <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
          <h1 className="text-2xl font-bold text-primary">
            ScaleIT Bridge Manager
          </h1>
          <div className="flex flex-1 items-center justify-end space-x-4">
            {/* Tutaj można dodać np. przełącznik motywu (dark/light) */}
          </div>
        </div>
      </header>
      
      <div className="container flex-1 flex flex-col lg:flex-row py-8 gap-8">
        {/* Sidebar */}
        <aside className="lg:w-1/5">
          <div className="lg:sticky lg:top-24">
            <SidebarNav />
          </div>
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 lg:w-4/5">{children}</main>
      </div>
      
      <footer className="border-t py-4">
        <div className="container flex justify-center items-center text-sm text-muted-foreground">
          <p>© 2025 ScaleIT Team. All rights reserved. | Bridge v3.1.0</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;