import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { DashboardHeader } from "../../components/DashboardHeader"
import { ScoreCircle } from "../../components/ScoreCircle"
import { SkillTag } from "../../components/SkillTag"
import { SuggestionCard } from "../../components/SuggestionCard"
import { Button } from "../../components/ui/button"
import {
  Download,
  Share2,
  RefreshCw,
  TrendingUp,
  FileText,
  Target,
  CheckCircle2,
  XCircle,
  BarChart3,
  Loader2,
} from "lucide-react"
import { analysisService, type AnalysisResult } from "../../services/analysis.service"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>()
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!id) return

      try {
        const data = await analysisService.getById(id)
        setAnalysis(data.analysis)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load analysis")
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalysis()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading analysis...</p>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="mb-4 text-lg text-muted-foreground">Analysis not found</p>
          <Link to="/dashboard/analyze">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <RefreshCw className="h-4 w-4" />
              Start New Analysis
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Analysis Results"
        description={`${analysis.jobTitle} at ${analysis.company}`}
      />

      <div className="p-6">
        {/* Fallback Notification Banner */}
        {!analysis.isAiAnalysis && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4 text-warning">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Basic Match (AI Optimized)</p>
              <p className="text-sm opacity-90">
                The AI engine is currently reaching its free tier limit. This result was generated using our 
                local keyword-matching engine. You can re-analyze this CV later for deeper AI insights.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
          <Link to="/dashboard/analyze">
            <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
              <RefreshCw className="h-4 w-4" />
              New Analysis
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Score Card */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-border/50 bg-card p-6 text-center">
              <h2 className="mb-6 text-lg font-semibold text-foreground">Match Score</h2>
              <ScoreCircle score={analysis.compatibilityScore} size="lg" />
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-success/10 p-3">
                  <p className="text-2xl font-bold text-success">{analysis.matchingSkills.length}</p>
                  <p className="text-xs text-muted-foreground">Matched Skills</p>
                </div>
                <div className="rounded-xl bg-destructive/10 p-3">
                  <p className="text-2xl font-bold text-destructive">{analysis.missingRequirements.length}</p>
                  <p className="text-xs text-muted-foreground">Missing Skills</p>
                </div>
              </div>
              <Link to="/dashboard/insights" className="mt-6 block">
                <Button variant="outline" className="w-full gap-2">
                  <BarChart3 className="h-4 w-4" />
                  View Detailed Insights
                </Button>
              </Link>
            </div>
          </div>

          {/* Skills Analysis */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <div className="mb-6 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Skills Analysis</h2>
              </div>

              {/* Strengths */}
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <h3 className="font-medium text-foreground">Matching Skills</h3>
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
                    {analysis.matchingSkills.length} found
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.matchingSkills.map((skill) => (
                    <SkillTag key={skill} skill={skill} type="matched" />
                  ))}
                </div>
              </div>

              {/* Missing Skills */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <h3 className="font-medium text-foreground">Missing Skills</h3>
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                    {analysis.missingRequirements.length} missing
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.missingRequirements.map((skill) => (
                    <SkillTag key={skill} skill={skill} type="missing" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Suggestions */}
        <div className="mt-6">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <div className="mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                {analysis.isAiAnalysis ? "AI Suggestions" : "System Suggestions"}
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {analysis.suggestions.length > 0 ? (
                analysis.suggestions.map((suggestion, index) => (
                  <SuggestionCard key={index} {...suggestion} />
                ))
              ) : (
                <p className="text-muted-foreground italic">No suggestions available at this time.</p>
              )}
            </div>
          </div>
        </div>

        {/* Keyword Comparison */}
        <div className="mt-6">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <div className="mb-6 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Keyword Comparison</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* CV Keywords */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <h3 className="font-medium text-foreground">Your CV Keywords</h3>
                </div>
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <div className="flex flex-wrap gap-2">
                    {analysis.cvKeywords.map((keyword) => {
                      const isMatched = analysis.jdKeywords.includes(keyword)
                      return (
                        <span
                          key={keyword}
                          className={`rounded-full px-3 py-1 text-sm font-medium ${
                            isMatched
                              ? "bg-success/20 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {keyword}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Job Keywords */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-accent" />
                  <h3 className="font-medium text-foreground">Job Description Keywords</h3>
                </div>
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <div className="flex flex-wrap gap-2">
                    {analysis.jdKeywords.map((keyword) => {
                      const isMatched = analysis.cvKeywords.includes(keyword)
                      return (
                        <span
                          key={keyword}
                          className={`rounded-full px-3 py-1 text-sm font-medium ${
                            isMatched
                              ? "bg-success/20 text-success"
                              : "bg-destructive/20 text-destructive"
                          }`}
                        >
                          {keyword}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-success/50" />
                <span>Matched keywords</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-destructive/50" />
                <span>Missing from CV</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-muted" />
                <span>Extra in CV</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                {analysis.isAiAnalysis ? "AI Summary" : "Analysis Summary"}
              </h2>
            </div>
            <p className="leading-relaxed text-muted-foreground">{analysis.summary}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
