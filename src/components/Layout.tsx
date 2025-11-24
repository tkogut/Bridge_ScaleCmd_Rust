import React from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Separator } from "@/components/ui/separator";

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
      <main className="flex-1 container py-8">{children}</main>
      <footer className="border-t py-4">
        <div className="container flex justify-between items-center text-sm text-muted-foreground">
          <p>© 2025 ScaleIT Team. All rights reserved.</p>
          <MadeWithDyad />
        </div>
      </footer>
    </div>
  );
};

export default Layout;