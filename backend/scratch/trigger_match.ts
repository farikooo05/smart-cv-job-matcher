import { runMatchingCycle } from '../src/services/matching.service.js'
import prisma from '../src/lib/prisma.js'

async function main() {
  const user = await (prisma as any).user.findFirst({
    orderBy: { createdAt: 'desc' }
  })
  
  if (!user) {
    console.error('No user found to match.')
    return
  }

  console.log(`🚀 Triggering manual matching for: ${user.email}`)
  await runMatchingCycle(user.id)
  console.log('✅ Manual matching done.')
}

main().catch(console.error)
