import { Link, useNavigate } from "react-router-dom"
import { useState } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Sparkles, Mail, Lock, User, ArrowRight, Eye, EyeOff, Check } from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { GoogleAuthButton } from "../components/GoogleAuthButton"
import { toast } from "sonner"

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  })

  const passwordRequirements = [
    { label: "At least 8 characters", met: formData.password.length >= 8 },
    { label: "Contains a number", met: /\d/.test(formData.password) },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(formData.password) },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await register(formData.name, formData.email, formData.password)
      toast.success("Account created successfully!")
      navigate("/dashboard")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">
            Opti<span className="text-primary">Job</span>
          </span>
        </Link>

        {/* Card */}
        <div className="rounded-2xl border border-border/50 bg-card/50 p-8 shadow-xl backdrop-blur-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
            <p className="mt-2 text-muted-foreground">
              Start optimizing your CV with AI today
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  className="h-11 bg-secondary/50 pl-10"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="h-11 bg-secondary/50 pl-10"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="h-11 bg-secondary/50 pl-10 pr-10"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-2 space-y-1.5">
                {passwordRequirements.map((req, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors ${
                        req.met
                          ? "bg-success text-success-foreground"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {req.met && <Check className="h-2.5 w-2.5" />}
                    </div>
                    <span className={req.met ? "text-foreground" : "text-muted-foreground"}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="h-11 w-full gap-2 bg-primary hover:bg-primary/90"
              disabled={isLoading || !passwordRequirements.every((r) => r.met)}
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <GoogleAuthButton label="Sign up with Google" />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {"Already have an account? "}
            <Link to="/login" className="font-medium text-primary hover:text-primary/80">
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {"By creating an account, you agree to our "}
          <Link to="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>
          {" and "}
          <Link to="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}
