import prisma from "../lib/prisma.js"
import { matchJobsWithGemini, isAiOverloaded, GeminiAnalysisResult } from "./gemini.service.js"
import { runTextAnalysis } from "./fallback.service.js"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

/** 
 * Normalizes Azerbaijani text for robust keyword matching
 */
const normalizeText = (text: string): string => {
  return text
    .toLocaleLowerCase("az-AZ")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Remove punctuation
    .replace(/\s{2,}/g, " ") // Clean extra spaces
    .normalize("NFC")
    .trim()
}

export const runMatchingCycle = async (targetUserId?: string): Promise<void> => {
  console.log(targetUserId ? `[Matching] Starting personal sync for user ${targetUserId}...` : "[Matching] Starting full background matching cycle...")

  try {
    const users = await (prisma as any).user.findMany({
      where: targetUserId ? { id: targetUserId } : {},
      include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 } }
    })

    // 2. Get all jobs created in the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentJobs = await (prisma as any).job.findMany({
      where: {
        createdAt: { gte: twentyFourHoursAgo }
      }
    })

    console.log(`[Matching] Found ${users.length} active users and ${recentJobs.length} recent jobs.`)
    for (const user of users) {
      // Fetch multilingual synonyms for smarter matching
      let multilingualSkills: any[] = []
      let searchTerms: string[] = []

      try {
        if ((user as any).cvSkillsMultilingual) {
          multilingualSkills = JSON.parse((user as any).cvSkillsMultilingual)
          searchTerms = multilingualSkills.flatMap((s: any) => [
            normalizeText(s.en),
            normalizeText(s.az),
            normalizeText(s.ru)
          ]).filter(t => t.length > 0)
        } else if ((user as any).cvKeywords) {
          searchTerms = JSON.parse((user as any).cvKeywords).map((k: string) => normalizeText(k))
        }
      } catch (e) {
        console.warn(`[Matching] Failed to parse keywords for ${user.email}`)
      }

      console.log(`[Matching] User ${user.email} has ${searchTerms.length} search variants across all languages.`)

      if (searchTerms.length === 0) continue

      for (const job of recentJobs) {
        // Check if we already matched this job for this user
        const existingMatch = await (prisma as any).jobMatch.findFirst({
          where: { userId: user.id, jobId: job.id }
        })
        if (existingMatch) continue

        // --- STAGE 1: Light Filter (Multilingual Keyword matching) ---
        const jobText = normalizeText(`${job.title} ${job.company}`)

        const isPotentialMatch = searchTerms.some((term: string) => jobText.includes(term))

        if (isPotentialMatch) {
          console.log(`[Matching] 🎯 Potential match detected for ${user.email} -> ${job.title}. Analyzing...`)

          // --- STAGE 2: Analysis (AI with Automatic Fallback) ---
          try {
            let result: any
            let usedAi = false

            if (isAiOverloaded()) {
              console.log(`[Matching] ⚡ AI Overloaded. Using Dynamic Fallback for ${job.title}`)
              const cvText = (user as any).cvText || "N/A"
              const jdText = `Job Title: ${job.title}\nCompany: ${job.company}\nDescription: ${job.description || "Refer to URL"}`
              result = runTextAnalysis(cvText, jdText, multilingualSkills)
              usedAi = false
            } else {
              // Rate limiting: Wait 5s between deep analyses ONLY if Gemini is active
              await new Promise(resolve => setTimeout(resolve, 5000))

              const cvText = (user as any).cvText || "N/A"
              const jdText = `Job Title: ${job.title}\nCompany: ${job.company}\nDescription: ${job.description || job.title}`

              result = await matchJobsWithGemini(cvText, jdText)
              usedAi = true
            }

            if (usedAi) {
              console.log(`[Matching] ✨ AI Analysis complete. Score: ${result.compatibilityScore}% for ${job.title}`)
            } else {
              console.log(`[Matching] ⚡ Basic Analysis complete. Score: ${result.compatibilityScore}% for ${job.title}`)
            }

            // Only save if it's a valid match outcome (> 25% for AI, > 50% for Basic)
            const minScore = usedAi ? 25 : 50
            if (result.compatibilityScore >= minScore) {
              const match = await (prisma as any).jobMatch.create({
                data: {
                  userId: user.id,
                  jobId: job.id,
                  score: result.compatibilityScore,
                  summary: result.summary,
                  matchingSkills: JSON.stringify(result.matchingSkills),
                  missingRequirements: JSON.stringify(result.missingRequirements),
                  isAiAnalysis: usedAi
                }
              })

              // --- STAGE 3: Notification ---
              if (match.score >= 75 && process.env.RESEND_API_KEY) {
                await resend.emails.send({
                  from: "onboarding@resend.dev",
                  to: user.email,
                  subject: `🔥 High Compatibility Found: ${job.title}`,
                  html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
                      <h2 style="color: #1e293b;">New Job Match Found!</h2>
                      <p>We found a position that matches <strong>${match.score}%</strong> of your professional profile.</p>
                      <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Position:</strong> ${job.title}</p>
                        <p style="margin: 8px 0 0 0;"><strong>Company:</strong> ${job.company}</p>
                      </div>
                      <p><strong>AI Insight:</strong> ${match.summary}</p>
                      <div style="margin-top: 24px;">
                        <a href="${job.url}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">View Full Opportunity</a>
                      </div>
                    </div>
                  `
                })
                console.log(`[Matching] Email alert sent to ${user.email}`)
              }
            }
          } catch (geminiError) {
            // Quietly skip on error
          }
        }
      }
    }
  } catch (error) {
    console.error("[Matching] Matching cycle failed:", error)
  }

  console.log("[Matching] Matching cycle complete.")
}
