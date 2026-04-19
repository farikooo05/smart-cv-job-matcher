import { Button } from "../components/ui/button";
import { Plus, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";

interface DashboardHeaderProps {
  title: string;
  description?: string;
  onMenuClick?: () => void;
}

export function DashboardHeader({ title, description, onMenuClick }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />

        <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" asChild>
          <Link to="/dashboard/analyze">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Analysis</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
