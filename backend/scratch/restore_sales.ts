import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  const user = await (p.user as any).findUnique({
    where: { email: 'farid.fv1@gmail.com' },
    select: { id: true, cvSkillsMultilingual: true }
  })
  
  if (!user) {
    console.error('User not found')
    return
  }

  let skills = JSON.parse(user.cvSkillsMultilingual || '[]')
  
  // Check if sales is already there (unlikely given our audit)
  const hasSales = skills.some((s: any) => s.en.toLowerCase() === 'sales')
  
  if (!hasSales) {
    console.log('Restoring "Sales" skill to profile...')
    skills.push({
      en: 'sales',
      az: 'satış',
      ru: 'продажи'
    })
    
    await (p.user as any).update({
      where: { id: user.id },
      data: {
        cvSkillsMultilingual: JSON.stringify(skills)
      }
    })
    console.log('Restoration complete.')
  } else {
    console.log('Sales skill already present.')
  }
}

main().catch(console.error).finally(() => p.$disconnect())
