import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { DashboardHeader } from "../../components/DashboardHeader"
import { ScoreCircle } from "../../components/ScoreCircle"
import { Button } from "../../components/ui/button"
import { cn } from "../../lib/utils"
import {
  Search,
  Trash2,
  ArrowUpRight,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { analysisService, type AnalysisListItem } from "../../services/analysis.service"
import { toast } from "sonner"

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchAnalyses = async (pageNum: number) => {
    setIsLoading(true)
    try {
      const data = await analysisService.getAll(pageNum, 10)
      setAnalyses(data.analyses)
      setTotalPages(data.pagination.totalPages)
    } catch (error) {
      console.error("Failed to fetch history:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalyses(page)
  }, [page])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await analysisService.delete(id)
      setAnalyses((prev) => prev.filter((a) => a.id !== id))
      toast.success("Analysis deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete")
    } finally {
      setDeletingId(null)
    }
  }

  const filteredAnalyses = analyses.filter(
    (a) =>
      a.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.company.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Analysis History"
        description="Review and manage your past CV analyses"
      />

      <div className="p-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by job title or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-secondary/30 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Search analyses"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card p-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              {searchQuery ? "No results found" : "No analyses yet"}
            </h3>
            <p className="mb-6 text-muted-foreground">
              {searchQuery
                ? "Try a different search term"
                : "Start your first CV analysis to see it here"}
            </p>
            {!searchQuery && (
              <Link to="/dashboard/analyze">
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  Start Analysis
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filteredAnalyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="flex items-center justify-between rounded-2xl border border-border/50 bg-card p-4 transition-all hover:border-primary/20"
                >
                  <Link
                    to={`/dashboard/results/${analysis.id}`}
                    className="flex flex-1 items-center gap-4"
                  >
                    <ScoreCircle score={analysis.compatibilityScore} size="sm" animated={false} />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{analysis.jobTitle}</p>
                      <p className="text-sm text-muted-foreground">{analysis.company}</p>
                    </div>
                    <div className="hidden text-right sm:block">
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-3 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(analysis.id)}
                    disabled={deletingId === analysis.id}
                    aria-label={`Delete analysis for ${analysis.jobTitle}`}
                  >
                    {deletingId === analysis.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
