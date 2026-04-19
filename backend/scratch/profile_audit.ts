import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  const user = await (p.user as any).findUnique({
    where: { email: 'farid.fv1@gmail.com' },
    select: { cvSkillsMultilingual: true }
  })
  
  if (!user) return
  const skills = JSON.parse(user.cvSkillsMultilingual || '[]')
  console.log(`CURRENT_SKILL_COUNT: ${skills.length}`)
  console.log('--- SKILLS LIST ---')
  console.log(skills.map((s: any) => s.en).join(', '))
}

main().finally(() => p.$disconnect())
