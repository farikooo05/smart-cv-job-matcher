import "dotenv/config"
import { readFile } from "node:fs/promises"

type Case = { id: string; cv: string; job: string; matched: string[] }
type Analysis = { matchingSkills: string[]; missingRequirements: string[] }
type ProviderResult = { name: string; model: string; elapsedMs: number; outputs: Analysis[] }

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "")
const allCases = JSON.parse(await readFile(new URL("./benchmark-cases.json", import.meta.url), "utf8")) as Case[]
const caseLimit = Math.max(1, Number.parseInt(process.env.BENCHMARK_CASE_LIMIT || "5", 10) || 5)
const cases = allCases.slice(0, caseLimit)
const selectedProvider = (process.env.BENCHMARK_PROVIDER || "both").toLowerCase()
if (!["both", "gemini", "ollama"].includes(selectedProvider)) {
  throw new Error("BENCHMARK_PROVIDER must be 'both', 'gemini', or 'ollama'.")
}
const ollamaTimeoutSeconds = Math.max(10, Number.parseInt(process.env.BENCHMARK_OLLAMA_TIMEOUT_SECONDS || "1800", 10) || 1800)

// Keep the comparison run bounded and reproducible without changing the app's .env.
process.env.OLLAMA_NUM_PREDICT = process.env.BENCHMARK_OLLAMA_NUM_PREDICT || "400"
process.env.AI_REQUEST_TIMEOUT_MS = String(ollamaTimeoutSeconds * 1000)
const { analyzeWithOllama } = await import("../src/services/ollama.service.js")

const categories = [
  "Python", "SQL", "Statistics", "Machine learning", "GenAI and LLMs",
  "Prompt engineering", "RAG", "English proficiency", "Credit risk", "IFRS 9", "AI agents",
]

const evidencePatterns: Record<string, RegExp> = {
  "Python": /\bpython\b/i,
  "SQL": /\bSQL\b|\bPostgreSQL\b|\bPostgres\b|\bMySQL\b|\bSQLite\b/i,
  "Statistics": /\bstatistics\b|\bstatistical\b|\bprobability\b/i,
  "Machine learning": /\bmachine learning\b|\bML\b|scikit[- ]learn|\bTensorFlow\b|\bKeras\b|\bneural networks?\b/i,
  "GenAI and LLMs": /\bGenAI\b|generative AI|\bLLMs?\b|large language models?|\bRAG\b|retrieval[- ]augmented generation/i,
  "Prompt engineering": /prompt design|prompt engineering/i,
  "RAG": /\bRAG\b|retrieval[- ]augmented generation/i,
  "English proficiency": /\bEnglish\b.*\b(?:C[12]|B[12]|A[12]|advanced|fluent|proficient)\b/i,
  "Credit risk": /credit risk|credit scoring|loan default risk|credit underwriting/i,
  "IFRS 9": /\bIFRS\s*9\b|expected credit losses?|\bECL\b/i,
  "AI agents": /\bAI agents?\b|\bAI agent\b/i,
}

const labelPatterns: Record<string, RegExp> = {
  "Python": /\bpython\b/i,
  "SQL": /\bSQL\b|\bPostgreSQL\b|\bPostgres\b|\bMySQL\b|\bSQLite\b/i,
  "Statistics": /\bstatistics\b|\bstatistical\b/i,
  "Machine learning": /\bmachine learning\b|\bML\b/i,
  "GenAI and LLMs": /\bGenAI\b|generative AI|\bLLMs?\b|large language models?/i,
  "Prompt engineering": /prompt engineering/i,
  "RAG": /\bRAG\b|retrieval[- ]augmented generation/i,
  "English proficiency": /\bEnglish\b|\blanguage proficiency\b/i,
  "Credit risk": /credit risk|credit scoring|loan default risk|credit underwriting/i,
  "IFRS 9": /\bIFRS\s*9\b|expected credit losses?|\bECL\b/i,
  "AI agents": /\bAI agents?\b/i,
}

const callGemini = async (item: Case): Promise<Analysis> => {
  const response = await fetch(`${AI_SERVICE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({ cv_text: item.cv, job_description: item.job }),
  })
  if (!response.ok) throw new Error(`AI service returned HTTP ${response.status}`)
  return await response.json() as Analysis
}

const callOllama = async (item: Case): Promise<Analysis> => analyzeWithOllama(item.cv, item.job, [{
  chunk_id: 1,
  section: "benchmark synthetic CV",
  text: item.cv,
  similarity: 1,
}])

const runProvider = async (name: string, model: string, call: (item: Case) => Promise<Analysis>) => {
  const start = performance.now()
  const outputs: Analysis[] = []
  for (const [index, item] of cases.entries()) {
    console.log(`${name}: running ${index + 1}/${cases.length} (${item.id})...`)
    try {
      outputs.push(await call(item))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error"
      throw new Error(`${item.id}: ${message}`)
    }
    console.log(`${name}: completed ${index + 1}/${cases.length}`)
  }
  return { name, model, elapsedMs: performance.now() - start, outputs } satisfies ProviderResult
}

const supports = (text: string, pattern: RegExp) => pattern.test(text)

const score = (result: ProviderResult) => {
  let tp = 0, fp = 0, fn = 0, tn = 0, covered = 0, totalEvidence = 0, validEvidence = 0
  for (const [index, output] of result.outputs.entries()) {
    const item = cases[index]
    const matched = output.matchingSkills || []
    const missing = output.missingRequirements || []
    const evidenceByCategory = new Set<string>()

    for (const skill of matched) {
      const evidence = skill.match(/[“"]([^”"]+)[”"]/)?.[1] || ""
      if (evidence) {
        totalEvidence++
        if (item.cv.toLocaleLowerCase().includes(evidence.toLocaleLowerCase())) validEvidence++
      }
      for (const category of categories) {
        const labelMatch = labelPatterns[category].test(skill)
        const evidenceMatch = supports(evidence, evidencePatterns[category])
        if (labelMatch) covered++
        if (labelMatch && evidenceMatch) evidenceByCategory.add(category)
      }
    }

    const missingCategories = new Set<string>()
    for (const requirement of missing) {
      for (const category of categories) {
        if (labelPatterns[category].test(requirement)) {
          missingCategories.add(category)
          covered++
        }
      }
    }

    for (const category of categories) {
      const actual = item.matched.includes(category)
      const predicted = evidenceByCategory.has(category)
      if (predicted && actual) tp++
      else if (predicted && !actual) fp++
      else if (!predicted && actual) fn++
      else tn++
    }
  }

  const precision = tp + fp ? tp / (tp + fp) : 0
  const recall = tp + fn ? tp / (tp + fn) : 0
  const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0
  const accuracy = (tp + tn) / (tp + fp + fn + tn)
  return {
    provider: result.name,
    model: result.model,
    examples: cases.length,
    labeledDecisions: cases.length * categories.length,
    accuracy: +(accuracy * 100).toFixed(1),
    precision: +(precision * 100).toFixed(1),
    recall: +(recall * 100).toFixed(1),
    f1: +(f1 * 100).toFixed(1),
    requirementCoverage: +Math.min(100, (covered / (cases.length * categories.length)) * 100).toFixed(1),
    evidenceQuoteValidity: totalEvidence ? +((validEvidence / totalEvidence) * 100).toFixed(1) : null,
    meanLatencySeconds: +((result.elapsedMs / cases.length) / 1000).toFixed(2),
    confusion: { truePositive: tp, falsePositive: fp, falseNegative: fn, trueNegative: tn },
  }
}

const run = async () => {
  console.log(`Synthetic evaluation: ${cases.length} CV/job pairs; ${cases.length * categories.length} labeled requirement decisions per provider.`)
  console.log(`Provider: ${selectedProvider}; Ollama timeout: ${ollamaTimeoutSeconds}s; Ollama output-token limit: ${process.env.OLLAMA_NUM_PREDICT}.`)
  console.log("Ollama is evaluated through the application analysis function with the full synthetic CV supplied as one retrieved excerpt; vector retrieval quality is not included.")
  const results: Record<string, unknown>[] = []
  const providers = [
    ["Gemini", process.env.GEMINI_MODEL || "configured AI service model", callGemini],
    ["Ollama", process.env.OLLAMA_MODEL || "qwen3:4b", callOllama],
  ] as const
  for (const [name, model, call] of providers.filter(([name]) => selectedProvider === "both" || name.toLowerCase() === selectedProvider)) {
    try {
      results.push(score(await runProvider(name, model, call)))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error"
      results.push({ provider: name, status: "unavailable_or_failed", error: message })
    }
  }
  console.log(JSON.stringify({ dataset: "synthetic; human-authored labels", results }, null, 2))
}

await run()
