import { useEffect, useState } from "react"
import { analysisService } from "../../services/analysis.service"
import { userService } from "../../services/user.service"
import { DashboardHeader } from "../../components/DashboardHeader"
import { 
  Briefcase, 
  MapPin, 
  ExternalLink, 
  Sparkles, 
  Building2, 
  TrendingUp, 
  AlertCircle, 
  Search, 
  RefreshCcw, 
  Trash2,
  Clock,
  Loader2
} from "lucide-react"
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
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchMatches = async () => {
    try {
      const [matchesRes, profileRes] = await Promise.all([
        analysisService.getMatches(),
        userService.getProfile()
      ])
      setMatches(matchesRes.matches)
      setLastSyncAt(profileRes.user.lastManualSyncAt)
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

  const isSyncLocked = () => {
    return false // Disabled for testing
  }

  const handleSyncProfile = async () => {
    if (isSyncLocked()) {
      const lastSync = new Date(lastSyncAt!).getTime()
      const remaining = 24 - (new Date().getTime() - lastSync) / (1000 * 60 * 60)
      toast.info(`Daily limit reached. Try again in ${Math.ceil(remaining)} hours.`)
      return
    }

    setIsScraping(true)
    try {
      const response = await analysisService.syncUserMatches()
      toast.success(response.message)
      setLastSyncAt(new Date().toISOString())
      // Refresh matches after a delay to allow AI to process
      setTimeout(fetchMatches, 10000)
    } catch (error: any) {
      toast.error(error.message || "Failed to start sync")
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const locked = isSyncLocked()

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Recommended Jobs"
        description="AI-powered vacancies matched specifically to your latest CV profile."
      />

      <div className="p-6">
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search matches..."
                className="pl-10 h-11 bg-card/40 border-border/40 focus:border-primary/40 focus:ring-primary/10 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              variant={locked ? "secondary" : "default"}
              className={`h-11 px-6 rounded-xl gap-2 font-semibold transition-all duration-300 flex flex-col items-center justify-center min-w-[160px] ${
                locked ? "opacity-70 cursor-not-allowed grayscale" : "shadow-lg shadow-primary/20 hover:scale-[1.02]"
              }`}
              onClick={handleSyncProfile}
              disabled={isScraping}
            >
              <div className="flex items-center gap-2">
                {isScraping ? (
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                ) : locked ? (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Sparkles className="h-4 w-4 text-white fill-white/20" />
                )}
                <span>{isScraping ? "Processing..." : locked ? "Sync Locked" : "Sync Profile"}</span>
              </div>
              <span className={`text-[10px] uppercase tracking-widest font-bold ${locked ? 'text-muted-foreground' : 'text-white/70'}`}>
                {locked ? "0/1 syncs left" : "1/1 syncs left today"}
              </span>
            </Button>
            {!locked && (
              <div className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-2 text-sm font-bold text-success border border-success/20">
                <Sparkles className="h-4 w-4" />
                <span>{filteredMatches.length} Matches Found</span>
              </div>
            )}
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

                <div className="mb-6 rounded-xl bg-secondary/50 p-4 relative group/insight">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Insight
                  </div>
                  <div className="relative">
                    <p className={`text-sm leading-relaxed text-muted-foreground transition-all duration-300 ${
                      expandedId === match.id ? "" : "line-clamp-3"
                    }`}>
                      {match.summary}
                    </p>
                    {match.summary && match.summary.length > 150 && (
                      <button
                        onClick={() => setExpandedId(expandedId === match.id ? null : match.id)}
                        className="mt-2 text-xs font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        {expandedId === match.id ? "Read Less" : "Read More..."}
                      </button>
                    )}
                  </div>
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
      <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6">
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
  </div>
  )
}
