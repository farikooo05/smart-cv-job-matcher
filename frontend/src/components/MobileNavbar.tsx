import { Link, useLocation, useNavigate } from "react-router-dom"
import { cn } from "../lib/utils"
import { useState } from "react"
import {
  LayoutDashboard,
  FileSearch,
  Briefcase,
  User,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { Button } from "./ui/button"

const mobileNavItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/analyze", label: "Analyze", icon: FileSearch },
  { href: "/dashboard/matches", label: "Matches", icon: Briefcase },
  { href: "/dashboard/profile", label: "Profile", icon: User },
]

export function MobileNavbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const handleLogout = () => {
    logout()
    navigate("/login")
    setShowLogoutConfirm(false)
  }

  return (
    <>
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border/50 bg-background/80 backdrop-blur-md md:hidden pb-safe">
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

    {/* Logout Confirmation Modal */}
    {showLogoutConfirm && (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 md:bg-black/30">
        <div className="w-full rounded-t-2xl md:rounded-2xl bg-background border border-border/50 p-6 md:max-w-sm">
          <h2 className="text-lg font-semibold mb-2">Log Out</h2>
          <p className="text-sm text-muted-foreground mb-6">Are you sure you want to log out?</p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowLogoutConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleLogout}
            >
              Log Out
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
