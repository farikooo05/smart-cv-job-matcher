import { useState } from "react"
import { Link } from "react-router-dom"
import {
  Crown,
  Check,
  Zap,
  Building2,
  Sparkles,
  ArrowLeft,
  X,
} from "lucide-react"
import { Button } from "../../components/ui/button"

type BillingCycle = "monthly" | "yearly"

interface Plan {
  id: string
  name: string
  icon: React.ReactNode
  badge?: string
  monthlyPrice: number
  yearlyPrice: number
  period?: string
  description: string
  color: string
  borderColor: string
  iconBg: string
  buttonVariant: "default" | "outline"
  buttonClass: string
  features: string[]
  limits: string[]
}

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    icon: <Sparkles className="h-5 w-5" />,
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Perfect for getting started with CV analysis.",
    color: "text-muted-foreground",
    borderColor: "border-border/50",
    iconBg: "bg-muted",
    buttonVariant: "outline",
    buttonClass: "",
    features: [
      "5 CV analyses per month",
      "Basic skill matching",
      "AI suggestions",
      "Job board monitoring (3 sites)",
      "Email notifications",
      "Insights dashboard",
    ],
    limits: [
      "No priority processing",
      "Fallback engine when AI limit hit",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    icon: <Zap className="h-5 w-5 text-yellow-400" />,
    badge: "Most Popular",
    monthlyPrice: 7,
    yearlyPrice: 5.5, // slightly cheaper if billed yearly?
    period: "week",
    description: "For serious job seekers who want the full AI experience.",
    color: "text-primary",
    borderColor: "border-primary/50",
    iconBg: "bg-primary/10",
    buttonVariant: "default",
    buttonClass: "bg-primary hover:bg-primary/90",
    features: [
      "50 CV analyses per month",
      "Priority AI processing (always Gemini)",
      "Advanced multilingual matching",
      "Job board monitoring (3 sites)",
      "Instant email & push notifications",
      "Full insights & analytics",
      "CV improvement history tracking",
      "Download analysis as PDF",
    ],
    limits: [],
  },
  {
    id: "business",
    name: "Business",
    icon: <Building2 className="h-5 w-5 text-purple-400" />,
    monthlyPrice: 29.99,
    yearlyPrice: 23.99,
    description: "For teams and HR professionals screening multiple candidates.",
    color: "text-purple-400",
    borderColor: "border-purple-500/40",
    iconBg: "bg-purple-500/10",
    buttonVariant: "outline",
    buttonClass: "border-purple-500/50 text-purple-400 hover:bg-purple-500/10",
    features: [
      "Unlimited CV analyses",
      "Priority AI processing (always Gemini)",
      "HR bulk screening mode",
      "Team workspace (up to 10 members)",
      "Advanced analytics & reports",
      "API access",
      "Custom job board integrations",
      "Dedicated support",
    ],
    limits: [],
  },
]

export default function SubscriptionPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly")
  const [currentPlan] = useState("free")

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/40 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Crown className="h-4 w-4 text-yellow-400" />
            Current plan: <span className="capitalize text-foreground">{currentPlan}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
            <Crown className="h-4 w-4 text-yellow-400" />
            Upgrade your plan
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Get more AI analyses, priority processing, and advanced features.
            No hidden fees. Cancel anytime.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-1 rounded-xl border border-border/50 bg-card p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${
                billing === "monthly"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all ${
                billing === "yearly"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const price =
              billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice
            const isCurrent = currentPlan === plan.id
            const isPopular = plan.badge === "Most Popular"

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-card p-6 transition-all duration-200 hover:shadow-xl ${
                  plan.borderColor
                } ${isPopular ? "shadow-lg shadow-primary/10 scale-[1.02]" : ""}`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-6">
                  <div className={`mb-3 inline-flex rounded-xl p-2.5 ${plan.iconBg}`}>
                    {plan.icon}
                  </div>
                  <h2 className={`text-xl font-bold ${plan.color}`}>
                    {plan.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  {price === 0 ? (
                    <div className="text-4xl font-bold text-foreground">Free</div>
                  ) : (
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        ${price}
                      </span>
                      <span className="mb-1 text-sm text-muted-foreground">
                        / {plan.period || "month"}
                      </span>
                    </div>
                  )}
                  {billing === "yearly" && price > 0 && (
                    <p className="mt-1 text-xs text-green-400">
                      Billed as ${(price * (plan.period === "week" ? 52 : 12)).toFixed(0)}/year
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                <Button
                  variant={plan.buttonVariant}
                  className={`mb-6 w-full ${plan.buttonClass}`}
                  disabled={isCurrent}
                >
                  {isCurrent ? "Current Plan" : plan.id === "free" ? "Downgrade" : "Upgrade Now"}
                </Button>

                {/* Features */}
                <div className="flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                      <span className="text-foreground">{f}</span>
                    </div>
                  ))}
                  {plan.limits.map((l) => (
                    <div key={l} className="flex items-start gap-2.5 text-sm">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                      <span className="text-muted-foreground">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom note */}
        <div className="mt-10 rounded-2xl border border-border/50 bg-card/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            All paid plans include a{" "}
            <span className="font-semibold text-foreground">7-day free trial</span>
            . No credit card required to start.{" "}
            <span className="font-semibold text-foreground">Cancel anytime</span>{" "}
            with no fees. Payments are securely processed via{" "}
            <span className="font-semibold text-foreground">Stripe</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
