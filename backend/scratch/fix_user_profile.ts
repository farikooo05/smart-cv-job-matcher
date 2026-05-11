
import { PrismaClient } from '@prisma/client'
import { GoogleGenerativeAI } from "@google/generative-ai"
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'farid.fv1@gmail.com' }
  })
  
  if (!user || !user.cvText) {
    console.log("User or CV text not found")
    return
  }

  console.log("Re-extracting profile for:", user.email)
  
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" })
  const prompt = `
    Extract the professional profile from this CV text. 
    Identify key technical skills.
    For each skill identified, provide its English, Azerbaijani, and Russian equivalents.
    
    CV TEXT:
    ${user.cvText}

    Return a JSON object:
    {
        "keywords": string[],
        "multilingualSkills": [
            { "en": string, "az": string, "ru": string }
        ],
        "summary": string
    }
  `

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  const profile = JSON.parse(cleaned)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      cvKeywords: JSON.stringify(profile.keywords),
      cvSkillsMultilingual: JSON.stringify(profile.multilingualSkills),
      cvSummary: profile.summary
    }
  })

  console.log("Profile updated with Sales keywords.")
  console.log("Keywords:", profile.keywords.join(", "))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
