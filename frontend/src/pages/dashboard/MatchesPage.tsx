import { useEffect, useState } from "react"
import { analysisService } from "../../services/analysis.service"
import { Briefcase, MapPin, ExternalLink, Sparkles, Building2, TrendingUp, AlertCircle, Search, RefreshCcw, Trash2 } from "lucide-react"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { toast } from "sonner"

interface JobMatch {
  id: string
  score: number
  summary: string
  matchingSkills: string[]
  missingRequirements: string[]
  createdAt: string
  job: {
    title: string
    company: string
    location: string
    url: string
    source: string
  }
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<JobMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isScraping, setIsScraping] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchMatches = async () => {
    try {
      const response = await analysisService.getMatches()
      setMatches(response.matches)
    } catch (error) {
      console.error("Failed to fetch matches:", error)
      toast.error("Could not load job matches")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMatches()
  }, [])

  const handleTriggerScrape = async () => {
    setIsScraping(true)
    try {
      const response = await analysisService.triggerScrape()
      toast.success(response.message)
      // We don't wait for the scrape to finish as it's background, 
      // but we can refresh the list after a small delay
      setTimeout(fetchMatches, 5000)
    } catch (error) {
      toast.error("Failed to start search")
    } finally {
      setIsScraping(false)
    }
  }

  const handleDeleteMatch = async (id: string) => {
    setDeletingId(id)
    try {
      const response = await analysisService.deleteMatch(id)
      toast.success(response.message)
      setMatches(prev => prev.filter(m => m.id !== id))
    } catch (error) {
      toast.error("Failed to remove match")
    } finally {
      setDeletingId(null)
    }
  }

  const filteredMatches = matches.filter(match => 
    match.job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    match.job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    match.job.source.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Recommended Jobs</h1>
          <p className="mt-2 text-muted-foreground">
            AI-powered vacancies matched specifically to your latest CV
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              className="pl-9 bg-card/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleTriggerScrape}
            disabled={isScraping}
          >
            {isScraping ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isScraping ? "Searching..." : "Search Now"}
          </Button>
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            <span>{filteredMatches.length} Matches Found</span>
          </div>
        </div>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50">
            <Briefcase className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-xl font-semibold text-foreground">
            {searchQuery ? "No matches for your search" : "No matches yet"}
          </h3>
          <p className="mt-2 max-w-sm text-muted-foreground">
            {searchQuery 
              ? "Try adjusting your search terms or clearing the filter." 
              : "Our scraper is searching local job boards. We'll notify you as soon as we find a perfect match!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredMatches.map((match) => (
            <div
              key={match.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/50 transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5"
            >
              {/* Action Buttons */}
              <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-background/50 hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteMatch(match.id)
                  }}
                  disabled={deletingId === match.id}
                >
                  {deletingId === match.id ? (
                    <RefreshCcw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${
                  match.score >= 80 
                    ? "bg-success/10 text-success ring-success/20" 
                    : "bg-warning/10 text-warning ring-warning/20"
                }`}>
                  <TrendingUp className="h-3 w-3" />
                  {match.score}% Match
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {match.job.source}
                  </span>
                  <h3 className="mt-1 text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {match.job.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4" />
                      {match.job.company}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {match.job.location}
                    </div>
                  </div>
                </div>

                <div className="mb-6 rounded-xl bg-secondary/50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Insight
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
                    {match.summary}
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-between gap-4">
                  <div className="text-xs text-muted-foreground">
                    Found {new Date(match.createdAt).toLocaleDateString()}
                  </div>
                  <Button 
                    variant="default" 
                    className="gap-2"
                    onClick={() => window.open(match.job.url, '_blank')}
                  >
                    Apply Now
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Card */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex gap-4">
          <div className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 sm:flex">
            <AlertCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">How matching works</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Our scraper scans <strong>Glorri.az</strong>, <strong>JobSearch.az</strong>, and <strong>Busy.az</strong> once a day. 
              We compare job descriptions against your most recently uploaded CV. Matches over 80% will trigger an email alert!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
