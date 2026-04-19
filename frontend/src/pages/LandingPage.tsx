import { Navbar } from "../components/Navbar";
import { FeatureCard } from "../components/FeatureCard";
import { Button } from "../components/ui/button";
import {
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { features } from "../data/featureCardData";
import { steps } from "../data/steps";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
        {/* Background Gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-150 w-200 rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute right-0 top-1/4 h-100 w-100 rounded-full bg-accent/15 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary">
              <Sparkles className="h-4 w-4" />
              <span>AI-Powered CV Analysis</span>
            </div>

            <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              <span className="block">Optimize Your CV</span>
              <span className="block text-primary">with AI</span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Get instant match scores, discover skill gaps, and receive personalized 
              suggestions to make your CV stand out for any job opportunity.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/register">
                <Button size="lg" className="h-12 gap-2 bg-primary px-8 text-base hover:bg-primary/90">
                  Upload CV
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/dashboard/results">
                <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                  Try Demo
                </Button>
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>Free to use</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span>Secure & Private</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                <span>Instant Results</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
              Powerful Features
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to optimize your job application process
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="border-t border-border/50 bg-card/50 py-20 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Three simple steps to optimize your job applications
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <span className="text-2xl font-bold text-primary">{item.step}</span>
                </div>
                <h3 className="mb-3 text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link to="/register">
              <Button size="lg" className="h-12 gap-2 bg-primary px-8 text-base hover:bg-primary/90">
                Start Analyzing
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-linear-to-br from-primary/10 via-card to-accent/10 p-8 sm:p-12 lg:p-16">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-[100px]" />
            <div className="relative mx-auto max-w-2xl text-center">
              <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
                Ready to Stand Out?
              </h2>
              <p className="mb-8 text-lg text-muted-foreground">
                Join thousands of job seekers who have improved their CVs with our AI-powered analysis.
              </p>
              <Link to="/register">
                <Button size="lg" className="h-12 gap-2 bg-primary px-8 text-base hover:bg-primary/90">
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">
                Opti<span className="text-primary">Job</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              2026 OptiJob. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
