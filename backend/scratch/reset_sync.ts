import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function resetSync() {
  const email = "farid.fv1@gmail.com"
  console.log(`🔄 Resetting sync timer for: ${email}`)
  
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { lastManualSyncAt: null }
    })
    console.log("✅ Sync timer reset! You can now perform a manual sync in the dashboard.")
  } catch (error) {
    console.error("❌ Failed to reset sync timer:", error)
  } finally {
    await prisma.$disconnect()
  }
}

resetSync()
