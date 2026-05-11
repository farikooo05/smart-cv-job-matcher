import { Outlet } from "react-router-dom";
import { useState } from "react";
import { DashboardSidebar } from "../components/DashboardSidebar";
import { MobileNavbar } from "../components/MobileNavbar";
import { cn } from "../lib/utils";

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0 pt-safe">
      <DashboardSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <MobileNavbar />
      <main
        className={cn(
          "min-h-screen transition-all duration-300",
          "ml-0 md:ml-64",
          collapsed && "md:ml-18"
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
