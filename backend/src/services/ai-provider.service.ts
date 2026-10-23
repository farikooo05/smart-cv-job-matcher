import {
  analyzeWithGemini,
  extractCvProfile as extractCvProfileWithGemini,
  matchJobsWithGemini,
} from "./gemini.service.js"
import type { CvProfileResult, GeminiAnalysisResult } from "./gemini.service.js"
import { analyzeWithOllama, extractCvProfileWithOllama, matchJobsWithOllama } from "./ollama.service.js"
import { extractPdfText } from "./pdf.service.js"
import { AiServiceError } from "./ollama.service.js"

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
): Promise<GeminiAnalysisResult> => {
  if (getAiProvider(requestedProvider) === "gemini") {
    return analyzeWithGemini(pdfBuffer, mimeType, jobDescription)
  }
  const cvText = await extractPdfText(pdfBuffer)
  return analyzeWithOllama(cvText, jobDescription)
}

export const extractCvProfile = async (pdfBuffer: Buffer, mimeType: string): Promise<CvProfileResult> => {
  if (getAiProvider() === "gemini") {
    return extractCvProfileWithGemini(pdfBuffer, mimeType)
  }
  const cvText = await extractPdfText(pdfBuffer)
  return extractCvProfileWithOllama(cvText)
}

export const matchJobToCv = async (cvText: string, jobDescription: string): Promise<GeminiAnalysisResult> => {
  if (getAiProvider() === "gemini") {
    return matchJobsWithGemini(cvText, jobDescription)
  }
  return matchJobsWithOllama(cvText, jobDescription)
}
