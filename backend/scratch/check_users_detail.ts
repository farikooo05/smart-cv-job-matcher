import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany()
  console.log('--- User Details ---')
  users.forEach(u => {
    console.log({
      id: u.id,
      name: u.name,
      email: u.email,
      hasPassword: !!u.password,
      cvKeywords: u.cvKeywords
    })
  })
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
