/**
 * Core professional synonyms for the emergency fallback engine.
 * This ensures matching works for common terms even if AI is offline 
 * during the initial CV upload.
 */
export const CORE_TRANSLATIONS: Record<string, string[]> = {
  "sales": ["satış", "satiş", "продажи", "satıcı"],
  "marketing": ["marketinq", "маркетинг"],
  "management": ["idarəetmə", "idareetme", "менеджмент"],
  "customer": ["müştəri", "muşteri", "клиент"],
  "retail": ["pərakəndə", "perakende", "розница"],
  "mobile": ["mobil", "мобильный", "ios", "android", "flutter", "react native"],
  "electronics": ["elektronika", "электроника"],
  "software": ["proqram", "программное"],
  "hardware": ["avadanlıq", "оборудование"],
  "network": ["şəbəkə", "сеть"],
  "cloud": ["bulud", "облако"],
  "education": ["bakalavr", "magistr", "бакалавр", "магистр"],
  "experience": ["təcrübə", "tecrube", "опыт"],
  "project": ["layihə", "layihe", "проект"],
  "team": ["komanda", "команда"],
  "tender": ["tendər", "тендер"],
  "coordinator": ["koordinator", "координатор"],
  "analytical": ["analitik", "аналитик"],
	"driver": ["sürücü", "surucu", "водитель"],
	"accountant": ["mühasib", "muhasib", "бухгалтер"],
  "react": ["reactjs", "react.js"],
  "node": ["nodejs", "node.js"],
  "javascript": ["js"],
  "typescript": ["ts"],
  "python": ["django", "flask"],
  "sql": ["postgresql", "mysql", "databases", "verilənlər", "baza"],
  "aws": ["amazon", "cloud"],
  "docker": ["containers", "kubernetes", "k8s"],
  "git": ["github", "gitlab"],
  "html": ["frontend", "angular", "vue", "svelte"],
  "css": ["tailwind", "sass", "less"],
  "communication": ["ünsiyyət", "unsiyyet", "общение"],
  "azerbaijani": ["azərbaycanca", "azəri"],
  "russian": ["rusca", "русский"],
  "english": ["ingiliscə", "английский"],
  "backend": ["back-end", "server-side", "arxa-plan"],
  "frontend": ["front-end", "client-side", "ön-plan"],
  "fullstack": ["full-stack"],
  "ai": ["artificial intelligence", "süni intellekt", "искусственный интеллект", "ml", "machine learning"],
  "nlp": ["natural language processing", "təbii dilin emalı"],
  "data": ["data science", "analytics", "big data", "verilənlər", "данные"],
  "devops": ["ci/cd", "automation", "sysadmin"],
  "security": ["cybersecurity", "təhlükəsizlik", "безопасность"],
  "api": ["rest", "graphql", "integration"],
  "java": ["spring", "springboot", "kotlin"],
  "csharp": ["c#", ".net", "dotnet"],
  "php": ["laravel", "symfony"],
  "qa": ["testing", "testləşdirmə", "тестирование"],
  "architect": ["system design", "memar", "архитектор"],
	"office": ["excel", "word", "powerpoint", "ofis"]
}

export const findSynonyms = (word: string): string[] => {
  const low = word.toLowerCase()
  for (const [en, synonyms] of Object.entries(CORE_TRANSLATIONS)) {
    if (en === low || synonyms.includes(low)) {
      return [en, ...synonyms]
    }
  }
  return [word]
}
