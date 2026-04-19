import { PrismaClient } from '@prisma/client'
import { runMatchingCycle } from '../src/services/matching.service.js'

async function main() {
  const user = await new PrismaClient().user.findUnique({
    where: { email: 'farid.fv1@gmail.com' }
  })
  
  if (!user) {
    console.error('User not found')
    return
  }
  
  console.log(`[Scratch] Manually triggering sync for ${user.email}...`)
  await runMatchingCycle(user.id)
  console.log('[Scratch] Sync complete.')
}

main().catch(console.error)
