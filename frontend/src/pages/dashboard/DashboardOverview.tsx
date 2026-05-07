import { useEffect, useState } from "react"
import { DashboardHeader } from "../../components/DashboardHeader"
import { ScoreCircle } from "../../components/ScoreCircle"
import { Button } from "../../components/ui/button"
import { cn } from "../../lib/utils"
import {
  FileSearch,
  BarChart3,
  Clock,
  ArrowUpRight,
  Sparkles,
  Target,
  TrendingUp,
  Award,
  Loader2,
  Bell,
  CheckCircle2,
} from "lucide-react"
import { Link } from "react-router-dom"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { analysisService, type AnalysisListItem, type DashboardStats, type JobMatch } from "../../services/analysis.service"
import { useAuth } from "../../contexts/AuthContext"

const quickActions = [
  {
    title: "Analyze New CV",
    description: "Upload and compare against a job",
    icon: FileSearch,
    href: "/dashboard/analyze",
    color: "bg-primary/10 text-primary",
  },
  {
    title: "View Insights",
    description: "Deep dive into your analytics",
    icon: BarChart3,
    href: "/dashboard/insights",
    color: "bg-accent/10 text-accent",
  },
  {
    title: "Browse History",
    description: "Review past analyses",
    icon: Clock,
    href: "/dashboard/history",
    color: "bg-success/10 text-success",
  },
]

export default function DashboardOverview() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats["stats"] | null>(null)
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisListItem[]>([])
  const [recentMatches, setRecentMatches] = useState<JobMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, analysesData, matchesData] = await Promise.all([
          analysisService.getStats(),
          analysisService.getAll(1, 3),
          analysisService.getMatches(),
        ])
        setStats(statsData.stats)
        setRecentAnalyses(analysesData.analyses)
        setRecentMatches(matchesData.matches.slice(0, 5))
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const scoreChangeText = stats && stats.scoreChange !== 0
    ? `${stats.scoreChange > 0 ? "+" : ""}${stats.scoreChange}%`
    : ""

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Dashboard"
        description={`Welcome back${user?.name ? `, ${user.name}` : ""}! Here's an overview of your CV performance.`}
      />

      <div className="p-6">
        {/* Stats Overview */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Latest Score",
              value: stats ? `${stats.latestScore}%` : "—",
              change: scoreChangeText,
              icon: Target,
            },
            {
              label: "Analyses Done",
              value: stats ? `${stats.totalAnalyses}` : "0",
              change: "",
              icon: TrendingUp,
            },
            {
              label: "Avg Score",
              value: stats ? `${stats.avgScore}%` : "—",
              change: "",
              icon: BarChart3,
            },
            {
              label: "Best Match",
              value: stats ? `${stats.bestScore}%` : "—",
              change: "",
              icon: Award,
            },
          ].map((stat, index) => (
            <div
              key={index}
              className="rounded-2xl border border-border/50 bg-card p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="rounded-lg bg-primary/10 p-2">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                {stat.change && (
                  <span className="text-sm font-medium text-success">
                    {stat.change}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Notifications & Quick Actions Section */}
        <div className="mb-8 grid gap-6 lg:grid-cols-4">
          {/* Notifications Feed */}
          <div className="lg:col-span-2">
            <div className="h-full rounded-2xl border border-border/50 bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Bell className="h-5 w-5 text-primary" />
                  Notifications
                </h2>
                <Link to="/dashboard/matches" className="text-xs text-muted-foreground hover:text-primary">
                  View all matches
                </Link>
              </div>
              <div className="space-y-4">
                {recentMatches.length > 0 ? (
                  recentMatches.map((match) => (
                    <div key={match.id} className="flex gap-3 text-sm">
                      <div className="mt-0.5 rounded-full bg-success/10 p-1.5 text-success flex-shrink-0">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          New high-match found: <span className="text-primary">{match.job.title}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {match.score}% compatibility at {match.job.company}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <CheckCircle2 className="mb-2 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">You're all caught up!</p>
                  </div>
                )}

                {/* System notification if CV exists */}
                {user?.cvFileName && (
                  <div className="flex gap-3 text-sm">
                    <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary flex-shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Master CV Indexed</p>
                      <p className="text-xs text-muted-foreground">
                        Agent is actively monitoring jobs for <span className="italic">{user.cvFileName}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions Re-integrated */}
          <div className="lg:col-span-2">
            <div className="h-full rounded-2xl border border-border/50 bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    to={action.href}
                    className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/30 p-3 transition-all hover:border-primary/30 hover:bg-secondary/50"
                  >
                    <div className={cn("rounded-lg p-2", action.color)}>
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{action.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Progress Chart */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Score Progress</h2>
                <Link to="/dashboard/insights">
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                    View Details
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              {stats && stats.scoreTrend.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.scoreTrend}>
                      <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--color-muted-foreground)" domain={[0, 100]} fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          color: "var(--color-foreground)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="var(--color-primary)"
                        strokeWidth={3}
                        dot={{ fill: "var(--color-primary)", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                    <p className="text-muted-foreground">No data yet. Start your first analysis!</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Analyses */}
        <div className="mt-6">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Recent Analyses</h2>
              <Link to="/dashboard/history">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  View All
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            {recentAnalyses.length > 0 ? (
              <div className="space-y-3">
                {recentAnalyses.map((analysis) => (
                  <Link
                    key={analysis.id}
                    to={`/dashboard/results/${analysis.id}`}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/30 p-4 transition-all hover:border-primary/30 hover:bg-secondary/50"
                  >
                    <div className="flex items-center gap-4">
                      <ScoreCircle score={analysis.compatibilityScore} size="sm" animated={false} />
                      <div>
                        <p className="font-medium text-foreground">{analysis.jobTitle}</p>
                        <p className="text-sm text-muted-foreground">{analysis.company}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mb-1 flex items-center justify-end gap-2">
                        {!analysis.isAiAnalysis && (
                          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning ring-1 ring-inset ring-warning/20">
                            BASIC
                          </span>
                        )}
                        <p className={cn(
                          "text-lg font-bold",
                          analysis.compatibilityScore >= 80 ? "text-success" : analysis.compatibilityScore >= 50 ? "text-primary" : "text-destructive"
                        )}>
                          {analysis.compatibilityScore}%
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(analysis.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">No analyses yet. Start your first one!</p>
              </div>
            )}
          </div>
        </div>

        {/* CTA Banner */}
        <div className="mt-6 rounded-2xl border border-primary/20 bg-linear-to-br from-primary/10 via-card to-accent/10 p-6 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary" />
          <h3 className="mb-2 text-xl font-semibold text-foreground">
            Ready to optimize your next application?
          </h3>
          <p className="mb-4 text-muted-foreground">
            Upload your CV and compare it against any job description for instant AI-powered insights.
          </p>
          <Link to="/dashboard/analyze">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              Start New Analysis
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
