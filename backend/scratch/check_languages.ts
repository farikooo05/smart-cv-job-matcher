import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const jobs = await prisma.job.findMany({
    take: 50,
    select: {
      title: true,
      description: true
    }
  })

  console.log('Sample Job Descriptions:')
  jobs.forEach((job, i) => {
    console.log(`${i+1}. [${job.title}] - ${job.description?.substring(0, 100)}...`)
  })
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
