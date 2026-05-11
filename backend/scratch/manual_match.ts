
import { runMatchingCycle } from '../src/services/matching.service.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("Starting manual matching cycle for Farid...")
  await runMatchingCycle('cmovzbmco0000h82bomsq31pv')
  const count = await prisma.jobMatch.count({ where: { userId: 'cmovzbmco0000h82bomsq31pv' } })
  console.log(`Total matches for Farid now: ${count}`)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
