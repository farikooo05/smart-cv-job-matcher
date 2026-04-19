import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How It Works" },
];

export function Navbar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (href: string) => {
    if (href.includes('#')) {
      const id = href.split('#')[1];
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            Opti<span className="text-primary">Job</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNavClick(link.href)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                location.pathname === link.href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Sign In</Link>
          </Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90" asChild>
            <Link to="/register">Get Started</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1 p-4">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNavClick(link.href)}
                className={cn(
                  "rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors",
                  location.pathname === link.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {link.label}
              </button>
            ))}
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="ghost" className="w-full justify-center" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
              <Button className="w-full justify-center bg-primary hover:bg-primary/90" asChild>
                <Link to="/register">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
