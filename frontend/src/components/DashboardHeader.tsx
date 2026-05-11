import { Button } from "../components/ui/button";
import { Plus, Menu, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "../contexts/AuthContext";

interface DashboardHeaderProps {
  title: string;
  description?: string;
  onMenuClick?: () => void;
}

export function DashboardHeader({ title, description, onMenuClick }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border/50 bg-background/80 px-4 sm:px-6 backdrop-blur-xl pt-safe">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          onClick={onMenuClick}
          className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary lg:hidden flex-shrink-0"
        >
          <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">{title}</h1>
          {description && <p className="text-xs sm:text-sm text-muted-foreground truncate">{description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <NotificationBell />

        <Button size="sm" className="gap-1.5 sm:gap-2 bg-primary hover:bg-primary/90 h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4" asChild>
          <Link to="/dashboard/analyze">
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">New Analysis</span>
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 sm:h-10 w-8 sm:w-10 text-muted-foreground hover:text-destructive lg:hidden"
          onClick={handleLogout}
          title="Log out"
        >
          <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </div>
    </header>
  );
}
