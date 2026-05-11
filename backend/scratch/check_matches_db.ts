
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'farid.fv1@gmail.com' }
  })
  
  if (!user) {
    console.log("User not found")
    return
  }

  const matches = await prisma.jobMatch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { job: true }
  })

  console.log(`User: ${user.email}`)
  console.log(`Sync Status: ${user.syncStatus}`)
  console.log(`Total Matches: ${matches.length}`)
  if (matches.length > 0) {
    console.log("Latest Match:", matches[0].job.title, "at", matches[0].job.company, "Score:", matches[0].score)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
