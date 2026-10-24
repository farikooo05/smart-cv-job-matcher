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

const ragIndexResultSchema = z.object({
  indexed_chunks: z.number().int().nonnegative(),
  embedding_model: z.string(),
})

const ragSearchResultSchema = z.object({
  results: z.record(z.string(), z.array(z.object({
    chunk_id: z.number().int(),
    section: z.string(),
    text: z.string(),
    similarity: z.number().min(-1).max(1),
  }))),
})

export interface RetrievedResumeChunk {
  chunkId: number
  section: string
  text: string
  similarity: number
}

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

export const indexResumeWithAiService = async (
  userId: string,
  cvText: string,
): Promise<{ indexedChunks: number; embeddingModel: string }> => {
  const baseUrl = (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "")
  let response: Response
  try {
    response = await fetch(`${baseUrl}/rag/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(Number(process.env.AI_SERVICE_TIMEOUT_MS || 120_000)),
      body: JSON.stringify({ user_id: userId, cv_text: cvText }),
    })
  } catch {
    throw new AiServiceError("Cannot connect to the AI service for CV indexing.", 503, "AI_RAG_UNAVAILABLE")
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: string }
    throw new AiServiceError(body.detail || `AI service returned HTTP ${response.status}.`, 503, "AI_RAG_INDEX_FAILED")
  }

  const parsed = ragIndexResultSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new AiServiceError("The AI service returned an invalid indexing response.", 502, "AI_INVALID_RESPONSE")
  }
  return {
    indexedChunks: parsed.data.indexed_chunks,
    embeddingModel: parsed.data.embedding_model,
  }
}

export const retrieveResumeChunks = async (
  userId: string,
  requirements: string[],
  topK = 2,
): Promise<RetrievedResumeChunk[]> => {
  const baseUrl = (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "")
  let response: Response

  try {
    response = await fetch(`${baseUrl}/rag/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(Number(process.env.AI_SERVICE_TIMEOUT_MS || 120_000)),
      body: JSON.stringify({ user_id: userId, requirements, top_k: topK }),
    })
  } catch (error) {
    const detail = error instanceof Error && error.name === "TimeoutError"
      ? "The AI service did not respond in time while retrieving CV evidence."
      : "Cannot connect to the AI service for CV evidence retrieval."
    throw new AiServiceError(detail, 503, "AI_RAG_UNAVAILABLE")
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: string }
    throw new AiServiceError(body.detail || `AI service returned HTTP ${response.status} during CV retrieval.`, 503, "AI_RAG_SEARCH_FAILED")
  }

  const parsed = ragSearchResultSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new AiServiceError("The AI service returned an invalid CV retrieval response.", 502, "AI_INVALID_RESPONSE")
  }

  const uniqueChunks = new Map<number, RetrievedResumeChunk>()
  for (const chunks of Object.values(parsed.data.results)) {
    for (const chunk of chunks) {
      const existing = uniqueChunks.get(chunk.chunk_id)
      if (!existing || chunk.similarity > existing.similarity) {
        uniqueChunks.set(chunk.chunk_id, {
          chunkId: chunk.chunk_id,
          section: chunk.section,
          text: chunk.text,
          similarity: chunk.similarity,
        })
      }
    }
  }

  return [...uniqueChunks.values()]
    .filter(chunk => chunk.similarity >= 0.2)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 8)
}
