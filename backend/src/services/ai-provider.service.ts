import {
  extractCvProfile as extractCvProfileWithGemini,
  matchJobsWithGemini,
} from "./gemini.service.js"
import type { CvProfileResult, GeminiAnalysisResult } from "./gemini.service.js"
import { analyzeWithOllama, extractCvProfileWithOllama, matchJobsWithOllama } from "./ollama.service.js"
import { extractPdfText } from "./pdf.service.js"
import { AiServiceError } from "./ollama.service.js"
import { analyzeWithAiService, retrieveResumeChunks } from "./ai-service.client.js"

export type AiProvider = "gemini" | "ollama"

export const getAiProvider = (requestedProvider?: unknown): AiProvider => {
  if (requestedProvider !== undefined) {
    if (requestedProvider !== "ollama" && requestedProvider !== "gemini") {
      throw new AiServiceError('Unsupported AI provider. Use "ollama" or "gemini".', 400, "AI_PROVIDER_INVALID")
    }
    return requestedProvider
  }

  const provider = (process.env.AI_PROVIDER || "ollama").toLowerCase()
  if (provider !== "gemini" && provider !== "ollama") {
    throw new AiServiceError(`Unsupported AI_PROVIDER "${provider}". Use "ollama" or "gemini".`, 500, "AI_PROVIDER_CONFIG_ERROR")
  }
  return provider
}

export const analyzeCv = async (
  pdfBuffer: Buffer,
  mimeType: string,
  jobDescription: string,
  requestedProvider?: unknown,
  userId?: string,
): Promise<GeminiAnalysisResult> => {
  if (getAiProvider(requestedProvider) === "gemini") {
    const cvText = await extractPdfText(pdfBuffer)
    return analyzeWithAiService(cvText, jobDescription)
  }
  const cvText = await extractPdfText(pdfBuffer)
  if (!userId) {
    throw new AiServiceError("A user profile is required for local CV evidence retrieval.", 400, "AI_RAG_USER_REQUIRED")
  }
  const requirements = extractRetrievalQueries(jobDescription)
  const retrievedChunks = await retrieveResumeChunks(userId, requirements)
  if (!retrievedChunks.length) {
    throw new AiServiceError("No relevant CV excerpts were found. Upload the Master CV in My Profile first.", 422, "AI_RAG_NO_EVIDENCE")
  }
  return analyzeWithOllama(cvText, jobDescription, retrievedChunks)
}

export const extractCvProfile = async (pdfBuffer: Buffer, mimeType: string): Promise<CvProfileResult> => {
  if (getAiProvider() === "gemini") {
    return extractCvProfileWithGemini(pdfBuffer, mimeType)
  }
  const cvText = await extractPdfText(pdfBuffer)
  return extractCvProfileWithOllama(cvText)
}

export const matchJobToCv = async (cvText: string, jobDescription: string, userId: string): Promise<GeminiAnalysisResult> => {
  if (getAiProvider() === "gemini") {
    return matchJobsWithGemini(cvText, jobDescription)
  }
  const retrievedChunks = await retrieveResumeChunks(userId, extractRetrievalQueries(jobDescription))
  if (!retrievedChunks.length) {
    throw new AiServiceError("No relevant CV excerpts were found for local job matching.", 422, "AI_RAG_NO_EVIDENCE")
  }
  return matchJobsWithOllama(cvText, jobDescription, retrievedChunks)
}

const extractRetrievalQueries = (jobDescription: string): string[] => {
  const candidates = jobDescription
    .split(/\r?\n|(?<=[.!?;])\s+/)
    .map(line => line.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter(line => line.length >= 20)
  const hasEnglishRequirement = candidates.some(line =>
    /\bEnglish\b/i.test(line) && /proficien|fluent|advanced|written|language|documentation|report/i.test(line),
  )
  const priorityQueries = [
    ...(hasEnglishRequirement ? ["English language proficiency CEFR level C1 C2 fluent advanced"] : []),
    ...(candidates.some(line => /\bcredit\s+risk\b/i.test(line)) ? ["credit risk credit scoring loan default risk lending"] : []),
    ...(candidates.some(line => /\bIFRS\s*9\b/i.test(line)) ? ["IFRS 9 expected credit loss ECL"] : []),
    ...(candidates.some(line => /\bSQL\b|\bstatistics\b|\bmachine learning\b/i.test(line))
      ? ["Python SQL statistics machine learning relevant degree"] : []),
    ...(candidates.some(line => /\b(?:GenAI|generative AI|LLMs?|RAG|AI agents?)\b/i.test(line))
      ? ["GenAI generative AI LLM prompt engineering RAG AI agents"] : []),
  ]
  const generalQueryLimit = Math.max(0, 10 - priorityQueries.length)
  const queries = [
    ...candidates.slice(0, generalQueryLimit).map(line => line.slice(0, 300)),
    ...priorityQueries,
  ]
  return queries.length ? queries : [jobDescription.trim().slice(0, 300)]
}
