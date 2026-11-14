import { extractPdfText } from "./pdf.service.js"
import {
  analyzeWithAiService,
  extractProfileWithAiService,
} from "./ai-service.client.js"
import type { AnalysisResult, CvProfileResult } from "./ai-service.client.js"

/** The single AI provider. Stored with each analysis so old records stay readable. */
export const AI_PROVIDER = "gemini"

/** Analyze an uploaded CV (PDF) against a pasted job description. */
export const analyzeCv = async (pdfBuffer: Buffer, jobDescription: string): Promise<AnalysisResult> =>
  analyzeWithAiService(await extractPdfText(pdfBuffer), jobDescription)

/** Build the Master CV profile from an uploaded PDF. */
export const extractCvProfile = async (pdfBuffer: Buffer): Promise<CvProfileResult> =>
  extractProfileWithAiService(await extractPdfText(pdfBuffer))

/** Analyze stored CV text against a scraped job posting. */
export const matchJobToCv = (cvText: string, jobDescription: string): Promise<AnalysisResult> =>
  analyzeWithAiService(cvText, jobDescription)
