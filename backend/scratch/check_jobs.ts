import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  })
  console.log('--- Recent Jobs ---')
  jobs.forEach(j => {
    console.log(`- ${j.title} @ ${j.company} (ID: ${j.id})`)
  })
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
