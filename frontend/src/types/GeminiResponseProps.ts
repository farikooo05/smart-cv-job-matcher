export interface SuggestionsProps {
    type: "improvement" | "warning" | "positive",
    title: string,
    description: string,
    actionLabel: string,
    actionUrl: string
}

export interface GeminiResponseProps {
    job: {
        title: string,
        company: string,
        date: string
    },
    compatibilityScore: number,
    skillsSummary: {
        matched: number,
        missing: number
    },
    cvKeywords: string[],
    jdKeywords: string[],
    matchingSkills: string[],
    missingRequirements: string[],
    suggestions: SuggestionsProps[],
    summary: string
}