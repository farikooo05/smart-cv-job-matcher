import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: 'desc' }
  })
  if (!user) {
    console.log('No user found.')
    return
  }
  console.log('--- User Keywords ---')
  console.log(`Email: ${user.email}`)
  console.log(`Keywords: ${user.cvKeywords}`)
  console.log(`Summary: ${user.cvSummary}`)
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
