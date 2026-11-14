import { z } from "zod"

/**
 * Client for the Python AI service (backend/ai-service).
 * Every LLM and embedding call in the application goes through this one service.
 */

export class AiServiceError extends Error {
  constructor(message: string, public readonly statusCode: number, public readonly code: string) {
    super(message)
    this.name = "AiServiceError"
  }
}

const suggestionSchema = z.object({
  type: z.enum(["improvement", "warning", "positive"]),
  title: z.string(),
  description: z.string(),
  actionLabel: z.string(),
  actionUrl: z.string(),
})

const analysisResultSchema = z.object({
  job: z.object({ title: z.string(), company: z.string(), date: z.string() }),
  compatibilityScore: z.number().min(0).max(100),
  skillsSummary: z.object({ matched: z.number().int().nonnegative(), missing: z.number().int().nonnegative() }),
  cvKeywords: z.array(z.string()),
  jdKeywords: z.array(z.string()),
  matchingSkills: z.array(z.string()),
  missingRequirements: z.array(z.string()),
  suggestions: z.array(suggestionSchema),
  summary: z.string(),
})

const profileResultSchema = z.object({
  fullName: z.string(),
  keywords: z.array(z.string()),
  multilingualSkills: z.array(z.object({ en: z.string(), az: z.string(), ru: z.string() })),
  summary: z.string(),
  parsedText: z.string(),
})

const indexJobsResultSchema = z.object({
  embedded: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  embedding_model: z.string(),
})

const searchJobsResultSchema = z.object({
  results: z.array(z.object({
    job_id: z.string(),
    similarity: z.number(),
    duplicate_job_ids: z.array(z.string()),
  })),
  top_k: z.number().int(),
  candidates_considered: z.number().int(),
  duplicates_collapsed: z.number().int(),
})

export type AnalysisResult = z.infer<typeof analysisResultSchema>
export type CvProfileResult = z.infer<typeof profileResultSchema>
export type MultilingualSkill = CvProfileResult["multilingualSkills"][number]

export interface JobDocument {
  job_id: string
  title: string
  company: string
  location: string
  description: string
}

export interface JobHit {
  jobId: string
  similarity: number
  duplicateJobIds: string[]
}

const post = async <T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> => {
  const baseUrl = (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "")
  const serviceKey = process.env.AI_SERVICE_KEY
  let response: Response

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(serviceKey ? { "X-AI-Service-Key": serviceKey } : {}),
      },
      signal: AbortSignal.timeout(Number(process.env.AI_SERVICE_TIMEOUT_MS || 120_000)),
      body: JSON.stringify(body),
    })
  } catch (error) {
    const detail = error instanceof Error && error.name === "TimeoutError"
      ? "The AI service did not respond in time."
      : "Cannot connect to the AI service. Make sure it is running."
    throw new AiServiceError(detail, 503, "AI_SERVICE_UNAVAILABLE")
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { detail?: unknown; code?: string }
    const detail = typeof payload.detail === "string" ? payload.detail : `AI service returned HTTP ${response.status}.`
    // Keep the statuses the user can act on; everything else is an upstream failure.
    const statusCode = [422, 429].includes(response.status) ? response.status : response.status >= 500 ? 503 : 502
    throw new AiServiceError(detail, statusCode, `AI_${(payload.code || "error").toUpperCase()}`)
  }

  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) {
    throw new AiServiceError("The AI service returned an unexpected response format.", 502, "AI_INVALID_RESPONSE")
  }
  return parsed.data
}

/** Compare a CV with a job description: requirement checklist, evidence quotes and score. */
export const analyzeWithAiService = (cvText: string, jobDescription: string): Promise<AnalysisResult> =>
  post("/analyze", { cv_text: cvText.slice(0, 30_000), job_description: jobDescription.slice(0, 30_000) }, analysisResultSchema)

/** Extract the candidate profile (skills in EN/AZ/RU and a summary) from CV text. */
export const extractProfileWithAiService = (cvText: string): Promise<CvProfileResult> =>
  post("/profile", { cv_text: cvText.slice(0, 30_000) }, profileResultSchema)

/** Add or update job postings in the vector index. Unchanged postings are not re-embedded. */
export const indexJobsWithAiService = async (jobs: JobDocument[]): Promise<{ embedded: number; unchanged: number }> => {
  let embedded = 0
  let unchanged = 0
  for (let start = 0; start < jobs.length; start += 200) {
    const result = await post("/jobs/index", { jobs: jobs.slice(start, start + 200) }, indexJobsResultSchema)
    embedded += result.embedded
    unchanged += result.unchanged
  }
  return { embedded, unchanged }
}

/** Retrieve the jobs most similar to a CV profile, with re-posted duplicates collapsed. */
export const searchJobsWithAiService = async (
  queryText: string,
  options: { topK?: number; minSimilarity?: number; jobIds?: string[] } = {},
): Promise<JobHit[]> => {
  const result = await post("/jobs/search", {
    query_text: queryText.slice(0, 30_000),
    top_k: options.topK,
    min_similarity: options.minSimilarity,
    job_ids: options.jobIds,
  }, searchJobsResultSchema)
  return result.results.map(hit => ({
    jobId: hit.job_id,
    similarity: hit.similarity,
    duplicateJobIds: hit.duplicate_job_ids,
  }))
}
