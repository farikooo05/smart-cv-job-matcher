import { Link, useLocation } from "react-router-dom"
import { cn } from "../lib/utils"
import {
  LayoutDashboard,
  FileSearch,
  Briefcase,
  User,
} from "lucide-react"

const mobileNavItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/analyze", label: "Analyze", icon: FileSearch },
  { href: "/dashboard/matches", label: "Matches", icon: Briefcase },
  { href: "/dashboard/profile", label: "Profile", icon: User },
]

export function MobileNavbar() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border/50 bg-background/80 backdrop-blur-md md:hidden">
      {mobileNavItems.map((item) => {
        const isActive = location.pathname === item.href
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            aria-label={item.label}
          >
            <item.icon className={cn("h-5 w-5", isActive && "fill-primary/20")} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
