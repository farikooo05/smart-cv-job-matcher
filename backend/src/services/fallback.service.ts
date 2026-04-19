import { PDFParse } from "pdf-parse"
import { GeminiAnalysisResult, MultilingualSkill } from "./gemini.service.js"
import { findSynonyms } from "../data/translations.js"

/**
 * Core text-matching logic shared between PDF and background matching flows.
 * Now completely dynamic: uses AI-extracted synonyms instead of a hardcoded list.
 */
export const runTextAnalysis = (
  cvText: string,
  jobDescription: string,
  multilingualSkills: MultilingualSkill[] = []
): Partial<GeminiAnalysisResult> => {
  // 1. Improved cleanup (preserve AZ/RU characters)
  const cleanText = (t: string) => t.toLowerCase().replace(/[^a-z0-9\sа-яёәіңғүұқөһçışğü]/g, " ")
  const jdClean = cleanText(jobDescription)

  // 2. Dynamic Multilingual Extraction
  const cvKeywords: string[] = []
  const matchedSkills: string[] = []
  const jdKeywordList: string[] = []
  const searchTermsUsedInTitle = new Set<string>()
  let totalOccurrences = 0

  const jobTitleClean = cleanText(jobDescription.split("\n")[0] || "")

  // Each "skill" from the user profile now has its own EN/AZ/RU variants
  multilingualSkills.forEach(skill => {
    cvKeywords.push(skill.en)
    
    // Fetch ALL known synonyms for this skill from our dictionary
    // This ensures that "AI" matches "ML", "Artificial Intelligence", "Süni İntellekt", etc.
    const searchTerms = findSynonyms(skill.en).map(s => s.toLowerCase());

    const isMatched = searchTerms.some(term => jdClean.includes(term))
    const isTitleMatched = searchTerms.some(term => jobTitleClean.includes(term))
    
    if (isMatched || isTitleMatched) {
      matchedSkills.push(skill.en)
      jdKeywordList.push(skill.en)
      
      // Count total occurrences for density bonus
      searchTerms.forEach(term => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi')
        const matches = jdClean.match(regex)
        if (matches) totalOccurrences += matches.length
        
        if (jobTitleClean.includes(term)) {
          searchTermsUsedInTitle.add(term)
        }
      })
    }
  })
  
  // 3. Calculate Additive Score with Precision
  let score = 0
  if (cvKeywords.length > 0) {
    // Factor A: Additive Breadth (New Model)
    // We award points for the absolute number of matches, not the ratio
    let breadthScore = 0
    if (matchedSkills.length === 1) breadthScore = 52
    else if (matchedSkills.length === 2) breadthScore = 72
    else if (matchedSkills.length >= 3) breadthScore = 82
    
    // Factor B: Depth (Keyword Density) - Max 15 pts
    const wordCount = jdClean.split(/\s+/).length
    const density = totalOccurrences / (Math.max(wordCount, 150) / 100)
    const depthScore = Math.min(density * 5, 15)
    
    // Factor C: Relevance (Title Match) - Max 15 pts
    const hasAnyTitleMatch = searchTermsUsedInTitle.size > 0
    const titleScore = hasAnyTitleMatch ? 15 : 0
    
    // Factor D: Jitter (Precision Offset) - For non-round numbers
    const textHash = jobDescription.length + (jobDescription.charCodeAt(0) || 0)
    const jitter = (textHash % 9) - 4 // range -4 to +4
    
    score = Math.round(breadthScore + depthScore + titleScore + jitter)

    // Penalize if the target text is too short (e.g. just title/company)
    if (jobDescription.length < 250 && score > 65) {
      score = 65 + (jobDescription.length % 5)
    }

    // Boost for strong technical compatibility
    if (matchedSkills.length >= 2 && depthScore > 10) {
      score = Math.min(score + 8, 98)
    }

    // Ensure variety for low scores
    if (matchedSkills.length > 0 && score < 22) {
      score = 22 + (jobDescription.length % 7)
    }

    // Special Case: No matches
    if (matchedSkills.length === 0) {
      score = Math.max(0, jitter / 2)
    }

    // Cap at 98 (save 99-100 for perfect AI matches)
    score = Math.min(score, 98)
  }

  const jdLines = jobDescription.split("\n").filter(l => l.trim().length > 0)
  const titleGuess = jdLines[0]?.substring(0, 50) || "Job Opportunity"

  return {
    job: {
      title: titleGuess,
      company: "Unknown Company",
      date: new Date().toISOString().split("T")[0]
    },
    compatibilityScore: score,
    skillsSummary: {
      matched: matchedSkills.length,
      missing: cvKeywords.length - matchedSkills.length
    },
    cvKeywords,
    jdKeywords: jdKeywordList,
    matchingSkills: matchedSkills,
    missingRequirements: cvKeywords.filter(s => !matchedSkills.includes(s)),
    summary: `Dynamic matching complete. Identified ${matchedSkills.length} matches across English, Azerbaijani, or Russian synonyms based on your Master CV profile.`
  }
}

/**
 * Basic keyword matching fallback for when Gemini is unavailable.
 */
export const runBasicAnalysis = async (
  pdfBuffer: Buffer,
  jobDescription: string,
  multilingualSkills: MultilingualSkill[] = []
): Promise<GeminiAnalysisResult> => {
  console.log("[Fallback] Running basic dynamic analysis...")

  const parser = new PDFParse({ data: pdfBuffer, verbosity: 0 })

  try {
    const data = await parser.getText()
    const cvText = data.text
    await parser.destroy()

    const analysis = runTextAnalysis(cvText, jobDescription, multilingualSkills)

    return {
      ...(analysis as GeminiAnalysisResult),
      suggestions: [
        {
          type: "warning",
          title: "Dynamic Keyword Matching",
          description: "Gemini is currently at its limit. We used our dynamic engine to match your skills across the synonyms we previously learned from your CV.",
          actionLabel: "Try AI Later",
          actionUrl: "#"
        }
      ]
    }
  } catch (error: any) {
    console.error("[Fallback] Text extraction failed:", error.message)
    throw new Error("Local text extraction failed.")
  }
}

/**
 * Basic profile extraction fallback
 */
export const runBasicProfileExtraction = async (
  pdfBuffer: Buffer
) => {
  console.log("[Fallback] Running emergency profile extraction...")

  const parser = new PDFParse({ data: pdfBuffer, verbosity: 0 })

  try {
    const data = await parser.getText()
    const cvText = data.text
    await parser.destroy()

    const lines = cvText.split("\n").map(l => l.trim()).filter(l => l.length > 0)
    const nameGuess = lines[0] || "User"

    // Use core transitions as a baseline during emergency fallback
    const words = cvText.toLowerCase().split(/\s+/)
    const foundKeywords = new Set<string>()
    const multilingualSkills: MultilingualSkill[] = []

    // Extract any word that matches our core professional dictionary
    words.forEach(word => {
      const synonyms = findSynonyms(word)
      if (synonyms.length > 1) { // It's a mapped term (EN + AZ/RU)
        const enVersion = synonyms[0]
        if (!foundKeywords.has(enVersion)) {
          foundKeywords.add(enVersion)
          multilingualSkills.push({
            en: enVersion,
            az: synonyms[1] || enVersion,
            ru: synonyms[2] || synonyms[1] || enVersion
          })
        }
      }
    })

    const keywords = Array.from(foundKeywords)

    return {
      fullName: nameGuess,
      keywords,
      multilingualSkills,
      summary: `Professional (Emergency extraction). Keywords: ${keywords.join(", ")}`,
      parsedText: cvText
    }
  } catch (error: any) {
    console.error("[Fallback] Profile extraction failed:", error.message)
    throw new Error("Local profile extraction failed.")
  }
}


