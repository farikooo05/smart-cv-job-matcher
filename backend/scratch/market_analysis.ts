import { PrismaClient } from '@prisma/client'
import { CORE_TRANSLATIONS } from '../src/data/translations.ts'

const prisma = new PrismaClient()

async function main() {
  const jobs = await prisma.job.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
    select: { title: true, description: true }
  })

  const skillCounts: Record<string, number> = {}
  
  jobs.forEach(job => {
    const text = (job.title + ' ' + (job.description || '')).toLowerCase()
    
    // Check against our professional dictionary
    Object.entries(CORE_TRANSLATIONS).forEach(([en, synonyms]) => {
      const allTerms = [en, ...synonyms]
      if (allTerms.some(term => text.includes(term.toLowerCase()))) {
        skillCounts[en] = (skillCounts[en] || 0) + 1
      }
    })
  })

  const sortedSkills = Object.entries(skillCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)

  console.log('--- MARKET BOOSTERS ---')
  sortedSkills.forEach(([skill, count]) => {
    console.log(`${skill}: ${count}% demand`)
  })
}

main().finally(() => prisma.$disconnect())
