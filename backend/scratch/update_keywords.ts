import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function updateKeywords() {
  const email = "farid.fv1@gmail.com"
  const newKeywords = [
    "Sales", "Satış", "Consultant", "Məsləhətçi", 
    "Müştəri xidməti", "Retail", "Customer Service",
    "POS Terminals", "Merchandising"
  ]
  
  console.log(`🚀 Updating keywords for ${email}...`)
  
  try {
    await prisma.user.update({
      where: { email },
      data: {
        cvKeywords: JSON.stringify(newKeywords)
      }
    })
    console.log("✅ Keywords updated! The matching engine will now detect Sales vacancies.")
  } catch (error) {
    console.error("❌ Update failed:", error)
  } finally {
    await prisma.$disconnect()
  }
}

updateKeywords()
