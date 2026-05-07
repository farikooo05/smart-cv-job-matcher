import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// CHANGE THIS EMAIL to the user you want to delete
const EMAIL_TO_DELETE = 'farid.fv1@gmail.coma'

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: EMAIL_TO_DELETE }
    })

    if (!user) {
      console.log(`❌ User with email ${EMAIL_TO_DELETE} not found.`)
      return
    }

    await prisma.user.delete({
      where: { email: EMAIL_TO_DELETE }
    })

    console.log(`✅ Successfully deleted user: ${user.name} (${EMAIL_TO_DELETE})`)
  } catch (error) {
    console.error('❌ Error deleting user:', error)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
