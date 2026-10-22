import prisma from "../lib/prisma.js"
import { matchJobToCv, getAiProvider } from "./ai-provider.service.js"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Yields the event loop to prevent the Node.js thread from freezing during heavy processing.
 */
const yieldEventLoop = () => new Promise(resolve => setTimeout(resolve, 0))

const processUserMatches = async (user: any, recentJobs: any[], targetUserId?: string) => {
  const cvText = user.cvText?.trim()
  if (!cvText) {
    console.warn(`[Matching] Skipping ${user.email}: no extracted CV text is stored.`)
    return
  }

  let newMatchCount = 0
  const matchesFound: any[] = []

  for (const job of recentJobs) {
    // Yield the event loop per job to keep Express highly responsive
    await yieldEventLoop()

    const existingMatch = await prisma.jobMatch.findFirst({
      where: { userId: user.id, jobId: job.id }
    })
    if (existingMatch) continue

    if (!job.description?.trim()) {
      console.warn(`[Matching] Skipping ${job.title}: no job description is available for AI analysis.`)
      continue
    }

    console.log(`[Matching] Analyzing ${job.title} for ${user.email} with ${getAiProvider()}...`)

    try {
      if (getAiProvider() === "gemini") {
        await new Promise(resolve => setTimeout(resolve, 5000))
      }

      const jdText = `Job Title: ${job.title}\nCompany: ${job.company}\nDescription: ${job.description}`
      const result = await matchJobToCv(cvText, jdText)

      if (result.compatibilityScore >= 50) {
        const match = await prisma.jobMatch.create({
          data: {
            userId: user.id,
            jobId: job.id,
            score: result.compatibilityScore,
            summary: result.summary,
            matchingSkills: JSON.stringify(result.matchingSkills),
            missingRequirements: JSON.stringify(result.missingRequirements),
            isAiAnalysis: true
          }
        })
        newMatchCount++
        matchesFound.push({ title: job.title, company: job.company, score: match.score })
      }
    } catch (error) {
      console.error(`[Matching] AI analysis failed for ${job.title}:`, error)
    }
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
      console.error(`[Matching] 💥 Unexpected error while sending email to ${user.email}:`, emailError)
    }
  }
}

export const runMatchingCycle = async (targetUserId?: string): Promise<void> => {
  console.log(targetUserId ? `[Matching] Starting personal sync for user ${targetUserId}...` : "[Matching] Starting full background matching cycle...")

  try {
    const users = await prisma.user.findMany({
      where: targetUserId ? { id: targetUserId } : {},
      include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 } }
    })

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentJobs = await prisma.job.findMany({
      where: {
        createdAt: { gte: twentyFourHoursAgo }
      }
    })

    console.log(`[Matching] Found ${users.length} active users and ${recentJobs.length} recent jobs.`)

    // Process users in concurrent chunks of 3 to avoid overwhelming DB/API
    const CHUNK_SIZE = 3
    for (let i = 0; i < users.length; i += CHUNK_SIZE) {
      const userChunk = users.slice(i, i + CHUNK_SIZE)
      
      await Promise.allSettled(
        userChunk.map(user => processUserMatches(user, recentJobs, targetUserId))
      )
      
      // Yield heavily between chunks
      await yieldEventLoop()
    }

  } catch (error) {
    console.error("[Matching] Matching cycle failed:", error)
  }

  console.log("[Matching] Matching cycle complete.")
}
