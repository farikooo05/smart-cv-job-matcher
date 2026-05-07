import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const users = await prisma.user.findMany()
    const count = users.length

    if (count === 0) {
      console.log('ℹ️ No users found in the database.')
      return
    }

    console.log(`⚠️  Preparing to delete ${count} users...`)
    
    await prisma.user.deleteMany()

    console.log(`✅ Successfully deleted all ${count} users.`)
  } catch (error) {
    console.error('❌ Error deleting users:', error)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
