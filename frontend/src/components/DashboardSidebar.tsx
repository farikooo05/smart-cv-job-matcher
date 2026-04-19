import { Link, useLocation, useNavigate } from "react-router-dom"
import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import {
  Sparkles,
  LayoutDashboard,
  FileSearch,
  BarChart3,
  History,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  Briefcase,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"

const mainNavItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/analyze", label: "Analyze CV", icon: FileSearch },
  { href: "/dashboard/matches", label: "Recommended Jobs", icon: Briefcase },
  { href: "/dashboard/profile", label: "My Profile", icon: User },
  { href: "/dashboard/insights", label: "Insights", icon: BarChart3 },
  { href: "/dashboard/history", label: "History", icon: History },
]

interface DashboardSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function DashboardSidebar({ collapsed, onToggle }: DashboardSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border/50 bg-sidebar transition-all duration-300",
        collapsed ? "w-18" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-border/50 px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
              Opti<span className="text-primary">Job</span>
            </span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          tabIndex={0}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <div className={cn("mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground", collapsed && "sr-only")}>
          Main Menu
        </div>
        {mainNavItems.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-border/50 p-3">
        {/* User Profile */}
        <div className={cn(
          "flex items-center gap-3 rounded-lg border border-border/50 bg-sidebar-accent/50 p-3",
          collapsed && "justify-center p-2"
        )}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <User className="h-4 w-4 text-primary" />
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.name || "User"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email || ""}</p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
              aria-label="Log out"
              tabIndex={0}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  )
}
