import { api } from "./api"

export interface AnalysisResult {
  id: string
  jobTitle: string
  company: string
  cvFileName: string
  compatibilityScore: number
  matchedSkillsCount: number
  missingSkillsCount: number
  cvKeywords: string[]
  jdKeywords: string[]
  matchingSkills: string[]
  missingRequirements: string[]
  suggestions: {
    type: "improvement" | "warning" | "positive"
    title: string
    description: string
    actionLabel: string
    actionUrl: string
  }[]
  summary: string
  isAiAnalysis: boolean
  createdAt: string
}

export interface AnalysisListItem {
  id: string
  jobTitle: string
  company: string
  cvFileName: string
  compatibilityScore: number
  matchedSkillsCount: number
  missingSkillsCount: number
  isAiAnalysis: boolean
  createdAt: string
}

export interface PaginatedAnalyses {
  analyses: AnalysisListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface DashboardStats {
  stats: {
    totalAnalyses: number
    avgScore: number
    bestScore: number
    latestScore: number
    scoreChange: number
    scoreTrend: { date: string; score: number }[]
  }
}

export interface JobMatch {
  id: string
  score: number
  summary: string
  matchingSkills: string[]
  missingRequirements: string[]
  isAiAnalysis: boolean
  createdAt: string
  job: {
    title: string
    company: string
    location: string
    url: string
    source: string
  }
}

export interface MatchesResponse {
  matches: JobMatch[]
}

export const analysisService = {
  create: async (file: File, jobDescription: string): Promise<{ analysis: AnalysisResult }> => {
    const formData = new FormData()
    formData.append("cv", file)
    formData.append("jobDescription", jobDescription)

    return api<{ analysis: AnalysisResult }>("/api/analysis", {
      method: "POST",
      body: formData,
      isFormData: true,
    })
  },

  getAll: async (page = 1, limit = 10): Promise<PaginatedAnalyses> => {
    return api<PaginatedAnalyses>(`/api/analysis?page=${page}&limit=${limit}`)
  },

  getMatches: async (): Promise<MatchesResponse> => {
    return api<MatchesResponse>("/api/analysis/matches")
  },

  triggerScrape: async (): Promise<{ message: string }> => {
    return api<{ message: string }>("/api/analysis/scrape", { method: "POST" })
  },

  getById: async (id: string): Promise<{ analysis: AnalysisResult }> => {
    return api<{ analysis: AnalysisResult }>(`/api/analysis/${id}`)
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return api<{ message: string }>(`/api/analysis/${id}`, { method: "DELETE" })
  },

  getStats: async (): Promise<DashboardStats> => {
    return api<DashboardStats>("/api/analysis/stats")
  },

  deleteMatch: async (id: string): Promise<{ message: string }> => {
    return api<{ message: string }>(`/api/analysis/matches/${id}`, { method: "DELETE" })
  },
}
