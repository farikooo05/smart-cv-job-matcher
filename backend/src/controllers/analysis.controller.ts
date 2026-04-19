import type { Request, Response } from "express"
import prisma from "../lib/prisma.js"
import { analyzeWithGemini, type GeminiAnalysisResult } from "../services/gemini.service.js"
import { runBasicAnalysis, runBasicProfileExtraction } from "../services/fallback.service.js"
import { runFullScrape } from "../services/scraper.service.js"
import { runMatchingCycle } from "../services/matching.service.js"

export const createAnalysis = async (req: Request, res: Response): Promise<void> => {
  console.log(`[Analysis] Starting request for User: ${req.userId}`)
  
  try {
    const userId = req.userId as string
    const { jobDescription } = req.body
    const file = req.file

    if (!file) {
      console.warn(`[Analysis] Missing file for User: ${userId}`)
      res.status(400).json({ error: "PDF file is required" })
      return
    }

    console.log(`[Analysis] File received: ${file.originalname} (${file.size} bytes, ${file.mimetype})`)

    if (!jobDescription || !jobDescription.trim()) {
      console.warn(`[Analysis] Empty job description for User: ${userId}`)
      res.status(400).json({ error: "Job description is required" })
      return
    }

    console.log(`[Analysis] Calling AI service...`)
    let result: GeminiAnalysisResult
    let isAiAnalysis = true

    try {
      result = await analyzeWithGemini(file.buffer, file.mimetype, jobDescription)
      console.log(`[Analysis] Gemini service returned success. Scoring: ${result.compatibilityScore}`)
    } catch (aiError: any) {
      // Check for Gemini Quota, Transient Error, or Local Test Mode
      const isTransient = 
        aiError.status === 429 || 
        aiError.status === 503 || 
        aiError.message?.includes("429") || 
        aiError.message?.includes("503") || 
        aiError.message?.includes("quota") ||
        aiError.message?.includes("AI_FORCE_OFFLINE")
      
      if (isTransient) {
        console.warn(`[Analysis] Gemini forced offline or limit hit. Falling back to basic analysis...`)
        
        // 1. Extract skills directly from the newly uploaded PDF
        let multilingualSkills: any[] = []
        try {
          const extracted = await runBasicProfileExtraction(file.buffer)
          multilingualSkills = extracted.multilingualSkills
          console.log(`[Analysis] Extracted ${multilingualSkills.length} skills from uploaded PDF for one-off analysis.`)
        } catch (extractError) {
          console.warn(`[Analysis] Local extraction from PDF failed, falling back to Master Profile...`)
          // 2. Fallback to Master Profile only if PDF extraction fails
          try {
            const user = await (prisma.user as any).findUnique({
              where: { id: userId },
              select: { cvSkillsMultilingual: true }
            })
            if ((user as any)?.cvSkillsMultilingual) {
              multilingualSkills = JSON.parse((user as any).cvSkillsMultilingual)
            }
          } catch (dbError) {
            console.warn(`[Analysis] Failed to fetch user synonyms for fallback.`)
          }
        }

        result = await runBasicAnalysis(file.buffer, jobDescription, multilingualSkills)
        isAiAnalysis = false
      } else {
        // Rethrow if it's a different kind of error (e.g. invalid file)
        throw aiError
      }
    }

    console.log(`[Analysis] Saving to Database... (AI: ${isAiAnalysis})`)
    const analysis = await prisma.analysis.create({
      data: {
        userId,
        jobTitle: result.job.title,
        company: result.job.company,
        jobDescription,
        cvFileName: file.originalname,
        compatibilityScore: result.compatibilityScore,
        matchedSkillsCount: result.skillsSummary.matched,
        missingSkillsCount: result.skillsSummary.missing,
        cvKeywords: JSON.stringify(result.cvKeywords),
        jdKeywords: JSON.stringify(result.jdKeywords),
        matchingSkills: JSON.stringify(result.matchingSkills),
        missingRequirements: JSON.stringify(result.missingRequirements),
        suggestions: JSON.stringify(result.suggestions),
        summary: result.summary,
        isAiAnalysis,
      },
    })
    console.log(`[Analysis] Database record created: ${analysis.id}`)

    res.status(201).json({
      analysis: {
        id: analysis.id,
        jobTitle: analysis.jobTitle,
        company: analysis.company,
        cvFileName: analysis.cvFileName,
        compatibilityScore: analysis.compatibilityScore,
        matchedSkillsCount: analysis.matchedSkillsCount,
        missingSkillsCount: analysis.missingSkillsCount,
        cvKeywords: result.cvKeywords,
        jdKeywords: result.jdKeywords,
        matchingSkills: result.matchingSkills,
        missingRequirements: result.missingRequirements,
        suggestions: result.suggestions,
        summary: analysis.summary,
        isAiAnalysis: analysis.isAiAnalysis,
        createdAt: analysis.createdAt,
      },
    })
  } catch (error: any) {
    console.error("[Analysis] Detailed Error Log:")
    console.error(`- Status: ${error.status || 'N/A'}`)
    console.error(`- Message: ${error.message}`)
    if (error.errorDetails) console.error(`- Details: ${JSON.stringify(error.errorDetails)}`)
    
    // Check if it's a Prisma error specifically
    if (error.code && error.clientVersion) {
      console.error("[Analysis] Database Error detected")
      res.status(500).json({ error: "Database error occurred while saving analysis." })
      return
    }

    // Check for Gemini Quota Error
    if (error.status === 429 || error.message?.includes("429") || error.message?.includes("quota")) {
      res.status(429).json({ 
        error: "The AI engine is currently reaching its free tier limit. Please wait about 60 seconds before trying again." 
      })
      return
    }

    res.status(500).json({ error: "Analysis failed. Please check backend logs for details." })
  }
}

export const getAnalyses = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit

    const [analyses, total] = await Promise.all([
      prisma.analysis.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          jobTitle: true,
          company: true,
          cvFileName: true,
          compatibilityScore: true,
          matchedSkillsCount: true,
          missingSkillsCount: true,
          isAiAnalysis: true,
          createdAt: true,
        },
      }),
      prisma.analysis.count({ where: { userId } }),
    ])

    res.json({
      analyses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Get analyses error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const getAnalysisById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string
    const id = req.params.id as string

    const analysis = await prisma.analysis.findFirst({
      where: { 
        id, 
        userId 
      },
    })

    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" })
      return
    }

    res.json({
      analysis: {
        id: analysis.id,
        jobTitle: analysis.jobTitle,
        company: analysis.company,
        jobDescription: analysis.jobDescription,
        cvFileName: analysis.cvFileName,
        compatibilityScore: analysis.compatibilityScore,
        matchedSkillsCount: analysis.matchedSkillsCount,
        missingSkillsCount: analysis.missingSkillsCount,
        cvKeywords: JSON.parse(analysis.cvKeywords),
        jdKeywords: JSON.parse(analysis.jdKeywords),
        matchingSkills: JSON.parse(analysis.matchingSkills),
        missingRequirements: JSON.parse(analysis.missingRequirements),
        suggestions: JSON.parse(analysis.suggestions),
        summary: analysis.summary,
        isAiAnalysis: analysis.isAiAnalysis,
        createdAt: analysis.createdAt,
      },
    })
  } catch (error) {
    console.error("Get analysis error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const deleteAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string
    const id = req.params.id as string

    const analysis = await prisma.analysis.findFirst({
      where: { 
        id, 
        userId 
      },
    })

    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" })
      return
    }

    await prisma.analysis.delete({ where: { id } })

    res.json({ message: "Analysis deleted successfully" })
  } catch (error) {
    console.error("Delete analysis error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string

    const analyses = await prisma.analysis.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        compatibilityScore: true,
        createdAt: true,
      },
    })

    const totalAnalyses = analyses.length
    const avgScore = totalAnalyses
      ? Math.round(analyses.reduce((sum, a) => sum + a.compatibilityScore, 0) / totalAnalyses)
      : 0
    const bestScore = totalAnalyses
      ? Math.max(...analyses.map((a) => a.compatibilityScore))
      : 0
    const latestScore = analyses[0]?.compatibilityScore || 0

    // Score trend — group by month for the chart
    const scoreByMonth: { date: string; score: number }[] = []
    const monthMap = new Map<string, number[]>()

    for (const analysis of analyses) {
      const date = new Date(analysis.createdAt)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      if (!monthMap.has(key)) {
        monthMap.set(key, [])
      }
      monthMap.get(key)!.push(analysis.compatibilityScore)
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for (const [key, scores] of monthMap) {
      const monthIndex = parseInt(key.split("-")[1]) - 1
      scoreByMonth.push({
        date: monthNames[monthIndex],
        score: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      })
    }

    // Score change (compare latest to second-latest)
    const previousScore = analyses[1]?.compatibilityScore || latestScore
    const scoreChange = latestScore - previousScore

    res.json({
      stats: {
        totalAnalyses,
        avgScore,
        bestScore,
        latestScore,
        scoreChange,
        scoreTrend: scoreByMonth.reverse(),
      },
    })
  } catch (error) {
    console.error("Get stats error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}
export const getMatches = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string

    // Fetch matches with the related job data
    const matches = await (prisma as any).jobMatch.findMany({
      where: { userId },
      include: {
        job: true,
      },
      orderBy: { createdAt: "desc" },
    })

    // Map the results safely, handling potential nulls from the AI fields
    const formattedMatches = matches.map((m: any) => {
      return {
        id: m.id,
        score: m.score,
        summary: m.summary || "No summary available",
        matchingSkills: m.matchingSkills ? JSON.parse(m.matchingSkills) : [],
        missingRequirements: m.missingRequirements ? JSON.parse(m.missingRequirements) : [],
        job: m.job,
        createdAt: m.createdAt,
      }
    })

    res.json({
      matches: formattedMatches,
    })
  } catch (error) {
    console.error("Get matches error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const triggerScrape = async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log("[Scraper] Manual trigger received")
    
    // We don't await these to return early and let them run in background
    runFullScrape()
      .then(() => runMatchingCycle())
      .catch(err => console.error("[Scraper] Manual background error:", err))

    res.json({ message: "Search started in background. Refresh in a few minutes to see results." })
  } catch (error) {
    console.error("Manual trigger error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const syncUserMatches = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string
    console.log(`[Matching] Personal sync requested for User: ${userId}`)
    
    // Trigger personal matching cycle in background
    runMatchingCycle(userId)
      .catch(err => console.error(`[Matching] Personal sync error for ${userId}:`, err))

    res.json({ message: "Personal job analysis started. Refresh in a few moments." })
  } catch (error) {
    console.error("Personal sync error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const deleteMatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string
    const id = req.params.id as string

    const match = await (prisma as any).jobMatch.findFirst({
      where: { 
        id, 
        userId 
      },
    })

    if (!match) {
      res.status(404).json({ error: "Match not found" })
      return
    }

    await (prisma as any).jobMatch.delete({ where: { id } })

    res.json({ message: "Match removed from recommendations" })
  } catch (error) {
    console.error("Delete match error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}
