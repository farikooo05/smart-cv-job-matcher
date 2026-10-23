import { z } from "zod"
import type { GeminiAnalysisResult } from "./gemini.service.js"
import { AiServiceError } from "./ollama.service.js"

const analysisResultSchema = z.object({
  job: z.object({ title: z.string(), company: z.string(), date: z.string() }),
  compatibilityScore: z.number().min(0).max(100),
  skillsSummary: z.object({ matched: z.number().int().nonnegative(), missing: z.number().int().nonnegative() }),
  cvKeywords: z.array(z.string()),
  jdKeywords: z.array(z.string()),
  matchingSkills: z.array(z.string()),
  missingRequirements: z.array(z.string()),
  suggestions: z.array(z.object({
    type: z.enum(["improvement", "warning", "positive"]),
    title: z.string(),
    description: z.string(),
    actionLabel: z.string(),
    actionUrl: z.string(),
  })),
  summary: z.string(),
})

export const analyzeWithAiService = async (cvText: string, jobDescription: string): Promise<GeminiAnalysisResult> => {
  const baseUrl = (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "")
  let response: Response

  try {
    response = await fetch(`${baseUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(Number(process.env.AI_SERVICE_TIMEOUT_MS || 120_000)),
      body: JSON.stringify({ cv_text: cvText, job_description: jobDescription }),
    })
  } catch (error) {
    const detail = error instanceof Error && error.name === "TimeoutError"
      ? "The AI service did not respond in time."
      : "Cannot connect to the AI service. Make sure its Docker container is running."
    throw new AiServiceError(detail, 503, "AI_PROVIDER_UNAVAILABLE")
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: string }
    const statusCode = response.status === 429 ? 429 : response.status >= 500 ? 503 : 502
    throw new AiServiceError(body.detail || `AI service returned HTTP ${response.status}.`, statusCode, "AI_PROVIDER_ERROR")
  }

  const parsed = analysisResultSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new AiServiceError("The AI service returned an invalid analysis format.", 502, "AI_INVALID_RESPONSE")
  }
  return parsed.data
}
