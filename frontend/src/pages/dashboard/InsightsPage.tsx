import { useEffect, useState } from "react"
import { DashboardHeader } from "../../components/DashboardHeader"
import { Button } from "../../components/ui/button"
import {
  BarChart3,
  TrendingUp,
  Target,
  Award,
  ArrowUpRight,
  Loader2,
} from "lucide-react"
import { Link } from "react-router-dom"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts"
import { analysisService, type AnalysisListItem, type DashboardStats } from "../../services/analysis.service"

export default function InsightsPage() {
  const [stats, setStats] = useState<DashboardStats["stats"] | null>(null)
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, analysesData] = await Promise.all([
          analysisService.getStats(),
          analysisService.getAll(1, 50),
        ])
        setStats(statsData.stats)
        setAnalyses(analysesData.analyses)
      } catch (error) {
        console.error("Failed to fetch insights:", error)
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

  // Build score distribution data
  const scoreDistribution = [
    { range: "0-20", count: 0 },
    { range: "21-40", count: 0 },
    { range: "41-60", count: 0 },
    { range: "61-80", count: 0 },
    { range: "81-100", count: 0 },
  ]

  for (const analysis of analyses) {
    const score = analysis.compatibilityScore
    if (score <= 20) scoreDistribution[0].count++
    else if (score <= 40) scoreDistribution[1].count++
    else if (score <= 60) scoreDistribution[2].count++
    else if (score <= 80) scoreDistribution[3].count++
    else scoreDistribution[4].count++
  }

  // Build skills summary
  const totalMatched = analyses.reduce((sum, a) => sum + a.matchedSkillsCount, 0)
  const totalMissing = analyses.reduce((sum, a) => sum + a.missingSkillsCount, 0)

  const hasData = analyses.length > 0

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Insights"
        description="Deep dive into your CV performance analytics"
      />

      <div className="p-6">
        {!hasData ? (
          <div className="rounded-2xl border border-border/50 bg-card p-12 text-center">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              No insights available yet
            </h3>
            <p className="mb-6 text-muted-foreground">
              Complete your first CV analysis to start seeing insights
            </p>
            <Link to="/dashboard/analyze">
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                Start Analysis
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-border/50 bg-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats?.avgScore || 0}%</p>
                <p className="text-sm text-muted-foreground">Average Score</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="rounded-lg bg-success/10 p-2">
                    <Award className="h-5 w-5 text-success" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats?.bestScore || 0}%</p>
                <p className="text-sm text-muted-foreground">Best Score</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{totalMatched}</p>
                <p className="text-sm text-muted-foreground">Total Matched Skills</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="rounded-lg bg-destructive/10 p-2">
                    <BarChart3 className="h-5 w-5 text-destructive" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{totalMissing}</p>
                <p className="text-sm text-muted-foreground">Total Missing Skills</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Score Trend */}
              <div className="rounded-2xl border border-border/50 bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">Score Trend</h2>
                {stats && stats.scoreTrend.length > 1 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.scoreTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
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
                    <p className="text-muted-foreground">Need more analyses for trend data</p>
                  </div>
                )}
              </div>

              {/* Score Distribution */}
              <div className="rounded-2xl border border-border/50 bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">Score Distribution</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="range" stroke="var(--color-muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={12} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          color: "var(--color-foreground)",
                        }}
                      />
                      <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Skills Ratio */}
            <div className="mt-6 rounded-2xl border border-border/50 bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Skills Match Ratio</h2>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-success">Matched ({totalMatched})</span>
                    <span className="text-destructive">Missing ({totalMissing})</span>
                  </div>
                  <div className="h-4 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-success transition-all duration-500"
                      style={{
                        width: totalMatched + totalMissing > 0
                          ? `${(totalMatched / (totalMatched + totalMissing)) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {totalMatched + totalMissing > 0
                      ? `${Math.round((totalMatched / (totalMatched + totalMissing)) * 100)}% match rate across all analyses`
                      : "No skill data available"}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
