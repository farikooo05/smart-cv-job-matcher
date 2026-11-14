import prisma from "../lib/prisma.js"
import { matchJobToCv } from "./ai.service.js"
import { indexJobsWithAiService, searchJobsWithAiService } from "./ai-service.client.js"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Job matching is retrieve-then-analyze (RAG):
 *   1. every recent job is embedded once into the vector index;
 *   2. for each user, vector search returns the TOP_K jobs closest to their CV profile;
 *   3. only those jobs go through the LLM requirement analysis.
 * This replaces one LLM call per user per job with one vector search plus at most TOP_K LLM calls.
 */
const TOP_K = Number(process.env.JOB_MATCH_TOP_K || 10)
const MIN_SIMILARITY = Number(process.env.JOB_MATCH_MIN_SIMILARITY || 0.6)
const MIN_ANALYSIS_SCORE = Number(process.env.JOB_MATCH_MIN_SCORE || 50)
// A listing without a description cannot be analyzed, so it must clear a stricter similarity bar.
const MIN_TITLE_ONLY_SIMILARITY = Number(process.env.JOB_MATCH_TITLE_ONLY_MIN_SIMILARITY || 0.68)
const MIN_DESCRIPTION_LENGTH = 120
const PLACEHOLDER_DESCRIPTION = "Refer to job portal for details"

type JobRecord = { id: string; title: string; company: string; location: string | null; description: string | null }

/** The scraper stores a placeholder when a job board gives no description; that is not text to analyze. */
const realDescription = (job: JobRecord): string => {
  const description = job.description?.trim() || ""
  return description.length >= MIN_DESCRIPTION_LENGTH && description !== PLACEHOLDER_DESCRIPTION ? description : ""
}

const parseKeywords = (raw: string | null): string[] => {
  try {
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : []
  } catch {
    return []
  }
}

/** The search query: the stored profile summary and skills, or the CV text when no profile exists. */
const buildProfileQuery = (user: any): string => {
  const keywords = parseKeywords(user.cvKeywords)
  const profile = [user.cvSummary?.trim(), keywords.length ? `Skills: ${keywords.join(", ")}` : ""].filter(Boolean).join("\n")
  return profile || user.cvText.trim()
}

const processUserMatches = async (user: any, recentJobs: JobRecord[], targetUserId?: string) => {
  const cvText = user.cvText?.trim()
  if (!cvText) {
    console.warn(`[Matching] Skipping user ${user.id}: no extracted CV text is stored.`)
    return
  }

  const jobsById = new Map(recentJobs.map(job => [job.id, job]))
  const existing = await prisma.jobMatch.findMany({
    where: { userId: user.id, jobId: { in: [...jobsById.keys()] } },
    select: { jobId: true },
  })
  const matchedJobIds = new Set(existing.map(match => match.jobId))

  let newMatchCount = 0
  const matchesFound: { title: string; company: string; score: number }[] = []

  try {
    // Already matched jobs stay in the search so that a re-posted copy of one collapses into it
    // instead of coming back as a "new" match; top-k is widened to leave room for new jobs.
    const hits = await searchJobsWithAiService(buildProfileQuery(user), {
      topK: Math.min(50, TOP_K + matchedJobIds.size),
      minSimilarity: MIN_SIMILARITY,
      jobIds: [...jobsById.keys()],
    })
    console.log(`[Matching] User ${user.id}: ${hits.length} candidate jobs retrieved from ${recentJobs.length}.`)

    for (const hit of hits) {
      if (newMatchCount >= TOP_K) break
      if ([hit.jobId, ...hit.duplicateJobIds].some(id => matchedJobIds.has(id))) continue
      const job = jobsById.get(hit.jobId)
      if (!job) continue

      try {
        const description = realDescription(job)
        let match
        if (description) {
          const jdText = `Job Title: ${job.title}\nCompany: ${job.company}\nDescription: ${description}`
          const result = await matchJobToCv(cvText, jdText)
          if (result.compatibilityScore < MIN_ANALYSIS_SCORE) continue
          match = await prisma.jobMatch.create({
            data: {
              userId: user.id,
              jobId: job.id,
              score: result.compatibilityScore,
              summary: result.summary,
              matchingSkills: JSON.stringify(result.matchingSkills),
              missingRequirements: JSON.stringify(result.missingRequirements),
              isAiAnalysis: true,
            },
          })
        } else {
          if (hit.similarity < MIN_TITLE_ONLY_SIMILARITY) continue
          // No description means no requirements to check, so the match is retrieval-only and says so.
          match = await prisma.jobMatch.create({
            data: {
              userId: user.id,
              jobId: job.id,
              score: Math.round(hit.similarity * 100),
              summary: "Suggested because the job title is close to your CV profile. This listing has no description, so its requirements were not checked.",
              matchingSkills: JSON.stringify([]),
              missingRequirements: JSON.stringify([]),
              isAiAnalysis: false,
            },
          })
        }
        matchedJobIds.add(job.id)
        newMatchCount++
        matchesFound.push({ title: job.title, company: job.company, score: match.score })
      } catch (error) {
        console.error(`[Matching] Analysis failed for job ${job.id}:`, error instanceof Error ? error.message : error)
      }
    }
  } catch (error) {
    console.error(`[Matching] Job retrieval failed for user ${user.id}:`, error instanceof Error ? error.message : error)
  }

  // Send Summary Notification
  if (process.env.RESEND_API_KEY && (newMatchCount > 0 || targetUserId)) {
    const subject = newMatchCount > 0
      ? `🔥 OptiJob: ${newMatchCount} New Matches Found!`
      : `✅ OptiJob: Matching Cycle Complete`

    const html = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
        <h2 style="color: #1e293b;">Matching Cycle Update</h2>
        <p>${newMatchCount > 0 ? `Great news! We found <strong>${newMatchCount}</strong> new positions that match your professional profile.` : 'We finished our latest search cycle. No new matches were found this time, but we will keep looking!'}</p>

        ${newMatchCount > 0 ? `
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #334155; font-size: 16px;">Top Matches:</h3>
            <ul style="padding-left: 20px; margin-bottom: 0;">
              ${matchesFound.map(m => `
                <li style="margin-bottom: 8px;">
                  <strong>${m.title}</strong> at ${m.company} (${m.score}%)
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        <div style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/matches" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">View All Matches</a>
        </div>
      </div>
    `

    try {
      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: user.email,
        subject,
        html
      })
    } catch (emailError) {
      console.error(`[Matching] 💥 Unexpected error while sending email to user ${user.id}:`, emailError)
    }
  }
}

export const runMatchingCycle = async (targetUserId?: string): Promise<void> => {
  console.log(targetUserId ? `[Matching] Starting personal sync for user ${targetUserId}...` : "[Matching] Starting full background matching cycle...")

  try {
    const users = await prisma.user.findMany({
      where: targetUserId ? { id: targetUserId } : {},
    })

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentJobs = await prisma.job.findMany({
      where: {
        createdAt: { gte: twentyFourHoursAgo }
      }
    })

    console.log(`[Matching] Found ${users.length} active users and ${recentJobs.length} recent jobs.`)
    if (!recentJobs.length) return

    const indexed = await indexJobsWithAiService(recentJobs.map(job => ({
      job_id: job.id,
      title: job.title,
      company: job.company,
      location: job.location || "",
      description: realDescription(job),
    })))
    console.log(`[Matching] Vector index: ${indexed.embedded} jobs embedded, ${indexed.unchanged} unchanged.`)

    // Users are processed in small groups; the AI service rate-limits the Gemini calls itself.
    const CHUNK_SIZE = 3
    for (let i = 0; i < users.length; i += CHUNK_SIZE) {
      const userChunk = users.slice(i, i + CHUNK_SIZE)
      await Promise.allSettled(
        userChunk.map(user => processUserMatches(user, recentJobs, targetUserId))
      )
    }

  } catch (error) {
    console.error("[Matching] Matching cycle failed:", error instanceof Error ? error.message : error)
  }

  console.log("[Matching] Matching cycle complete.")
}
