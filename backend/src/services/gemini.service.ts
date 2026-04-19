import { GoogleGenerativeAI } from "@google/generative-ai"

/**
 * Circuit breaker for AI overload
 */
const FORCE_FALLBACK = true // Set to true to test backup engine solo
let lastQuotaErrorTimestamp: number | null = null
const QUOTA_COOLDOWN_MS = 15 * 60 * 1000 // 15 minutes

export const isAiOverloaded = (): boolean => {
  if (FORCE_FALLBACK) return true
  if (!lastQuotaErrorTimestamp) return false
  const timeSinceError = Date.now() - lastQuotaErrorTimestamp
  return timeSinceError < QUOTA_COOLDOWN_MS
}

/**
 * Utility to retry API calls with exponential backoff
 */
const withRetry = async <T>(
  operation: () => Promise<T>,
  retries: number = 1,
  delay: number = 2000
): Promise<T> => {
  try {
    return await operation()
  } catch (error: any) {
    const isQuotaError = error.status === 429 || error.message?.includes("429") || error.message?.includes("quota")
    
    if (isQuotaError) {
      lastQuotaErrorTimestamp = Date.now()
      console.error("[Gemini] Quota limit reached. Circuit breaker tripped.")
    }

    const isTransientError = 
      isQuotaError || 
      error.status === 503 || 
      error.message?.includes("503") || 
      error.message?.includes("demand")
    
    if (isTransientError && retries > 0) {
      console.warn(`[Gemini] Transient error (${error.status || 'spike'}). Retrying in ${delay}ms... (${retries} retries left)`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return withRetry(operation, retries - 1, delay * 2.5) // Exponential backoff
    }
    throw error
  }
}

export interface GeminiAnalysisResult {
  job: {
    title: string
    company: string
    date: string
  }
  compatibilityScore: number
  skillsSummary: {
    matched: number
    missing: number
  }
  cvKeywords: string[]
  jdKeywords: string[]
  matchingSkills: string[]
  missingRequirements: string[]
  suggestions: {
    type: "improvement" | "warning" | "positive"
    title: string
    description: string
    actionLabel: string
    actionUrl: string
  }[]
  summary: string
}

export const analyzeWithGemini = async (
  pdfBuffer: Buffer,
  mimeType: string,
  jobDescription: string
): Promise<GeminiAnalysisResult> => {
  if (FORCE_FALLBACK) {
    throw new Error("AI_FORCE_OFFLINE: Live analysis is in local test mode.")
  }

  // Initialize inside the function to ensure process.env.GEMINI_API_KEY is loaded
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" })

  const base64Data = pdfBuffer.toString("base64")

  const prompt = `
    Analyze the following CV against this Job Description: ${jobDescription}.
    
    Return a JSON object with this exact structure:
    {
        "job": {
            "title": string,
            "company": string,
            "date": string
        },
        "compatibilityScore": number,
        "skillsSummary": {
            "matched": number,
            "missing": number
        },
        "cvKeywords": string[],
        "jdKeywords": string[],
        "matchingSkills": string[],
        "missingRequirements": string[],
        "suggestions": [
            {
            "type": "improvement" | "warning" | "positive",
            "title": string,
            "description": string,
            "actionLabel": string,
            "actionUrl": string
            }
        ],
        "summary": string
    }

    Rules:
    - Extract "title" and "company" from the job description.
    - If no date is provided, generate a realistic recent date (YYYY-MM-DD).
    - compatibilityScore must be 0-100.

    For the "suggestions":
    - Identify gaps like Cloud, DevOps, or specific frameworks.
    - Provide a helpful "actionLabel" (e.g., "View Certifications" or "Learn More").
    - Provide a relevant "actionUrl" (e.g., a documentation link or roadmap).
    - If the candidate is strong in an area, provide a positive suggestion on how to highlight it further.

    Strictly output valid JSON. No markdown. No code fences.
  `

  try {
    return await withRetry(async () => {
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
            ],
          },
        ],
      })

      const response = await result.response
      const text = response.text()
      
      if (!text) {
        throw new Error("Empty response from Gemini")
      }

      // Clean potential markdown code fences from response
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()

      try {
        const parsed: GeminiAnalysisResult = JSON.parse(cleaned)
        return parsed
      } catch (error) {
        console.error("JSON Parse Error. Raw text:", text)
        throw new Error("Failed to parse Gemini response as JSON")
      }
    })
  } catch (error: any) {
    console.error("Gemini API Error Detail:", {
      status: error.status,
      message: error.message,
      statusText: error.statusText,
      details: error.errorDetails,
    })
    throw error
  }
}

export interface MultilingualSkill {
  en: string
  az: string
  ru: string
}

export interface CvProfileResult {
  fullName: string
  keywords: string[]
  multilingualSkills: MultilingualSkill[]
  summary: string
  parsedText: string
}

export const extractCvProfile = async (
  pdfBuffer: Buffer,
  mimeType: string
): Promise<CvProfileResult> => {
  if (FORCE_FALLBACK) {
    throw new Error("AI_FORCE_OFFLINE: Profile extraction is in local test mode.")
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" })

  const base64Data = pdfBuffer.toString("base64")

  const prompt = `
    Extract the professional profile from this CV. 
    Identify the candidate's full name, key technical skills, and a brief 2-sentence summary of their experience.
    
    For each skill identified, provide its English, Azerbaijani, and Russian equivalents.
    Example: { "en": "Sales", "az": "Satış", "ru": "Продажи" }

    Return a JSON object with this exact structure:
    {
        "fullName": string,
        "keywords": string[],
        "multilingualSkills": [
            { "en": string, "az": string, "ru": string }
        ],
        "summary": string,
        "parsedText": "full plain text extracted from the CV"
    }

    Rules:
    - keywords should be the primary English version of the skills.
    - multilingualSkills must contain the EN/AZ/RU synonyms for every extracted skill.
    - Strictly output valid JSON. No markdown.
  `

  try {
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Invalid or empty CV file provided")
    }

    return await withRetry(async () => {
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
            ],
          },
        ],
      })

      const response = await result.response
      const text = response.text()
      
      if (!text) {
        throw new Error("Empty response from Gemini")
      }

      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      
      try {
        return JSON.parse(cleaned) as CvProfileResult
      } catch (parseError) {
        console.error("[Gemini] JSON Parse Error. Raw text:", text)
        throw new Error("Failed to parse CV profile. AI response format was unexpected.")
      }
    })
  } catch (error: any) {
    console.error("[Gemini] CV Extraction failed:", error.message || error)
    
    if (error.status === 400) {
      throw new Error("AI could not read this CV format. Please try a standard PDF file.")
    }
    
    throw error
  }
}

export const matchJobsWithGemini = async (
  cvText: string,
  jobDescription: string
): Promise<GeminiAnalysisResult> => {
  if (FORCE_FALLBACK) {
    throw new Error("AI_FORCE_OFFLINE: Background matching is in local test mode.")
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" })

  const prompt = `
    Analyze the following User CV against this Job Vacancy.
    
    USER CV:
    ${cvText}

    JOB VACANCY:
    ${jobDescription}

    Return a JSON object with this exact structure:
    {
        "job": {
            "title": string,
            "company": string,
            "date": string
        },
        "compatibilityScore": number,
        "skillsSummary": {
            "matched": number,
            "missing": number
        },
        "cvKeywords": string[],
        "jdKeywords": string[],
        "matchingSkills": string[],
        "missingRequirements": string[],
        "suggestions": [
            {
            "type": "improvement" | "warning" | "positive",
            "title": string,
            "description": string,
            "actionLabel": string,
            "actionUrl": string
            }
        ],
        "summary": string
    }

    Strictly output valid JSON. No markdown.
  `

  try {
    return await withRetry(async () => {
      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      return JSON.parse(cleaned) as GeminiAnalysisResult
    })
  } catch (error) {
    console.error("Gemini Match Error:", error)
    throw error
  }
}
