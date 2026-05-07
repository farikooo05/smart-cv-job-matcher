import type { Request, Response } from "express"
import prisma from "../lib/prisma.js"
import { extractCvProfile, type CvProfileResult } from "../services/gemini.service.js"
import { runBasicProfileExtraction } from "../services/fallback.service.js"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        cvFileName: true,
        cvKeywords: true,
        cvSummary: true,
        cvUpdatedAt: true,
        lastManualSyncAt: true,
        createdAt: true,
      }
    })

    if (!user) {
      res.status(404).json({ error: "User not found" })
      return
    }

    // Safe parsing of keywords
    let keywords: string[] = []
    try {
      if (user.cvKeywords) {
        const parsed = JSON.parse(user.cvKeywords)
        keywords = Array.isArray(parsed) ? parsed : []
      }
    } catch (e) {
      console.warn(`[Profile] Failed to parse keywords for user ${userId}, defaulting to empty array`)
    }

    res.json({
      user: {
        ...user,
        cvKeywords: keywords,
      }
    })
  } catch (error) {
    console.error("Get user profile error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const updateMasterCv = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string
    const file = req.file

    if (!file) {
      res.status(400).json({ error: "CV file is required" })
      return
    }

    console.log(`[Profile] Extracting Master CV profile for User: ${userId}`)
    let profile: CvProfileResult
    
    try {
      profile = await extractCvProfile(file.buffer, file.mimetype)
    } catch (aiError: any) {
      // Check for Gemini Quota, Transient Error, or Local Test Mode
      const isTransient = 
        aiError.status === 429 || 
        aiError.status === 503 || 
        aiError.message?.includes("429") || 
        aiError.message?.includes("503") || 
        aiError.message?.includes("quota") ||
        aiError.message?.includes("AI_FORCE_OFFLINE")
      
      if (isTransient) {
        console.warn(`[Profile] Gemini forced offline or limit hit. Falling back to basic extraction...`)
        profile = await runBasicProfileExtraction(file.buffer)
      } else {
        throw aiError
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        cvFileName: file.originalname,
        cvText: profile.parsedText,
        cvKeywords: JSON.stringify(profile.keywords),
        cvSkillsMultilingual: JSON.stringify(profile.multilingualSkills),
        cvSummary: profile.summary,
        cvUpdatedAt: new Date(),
      }
    })

    // SEND WELCOME EMAIL (as requested by user in Turn 73)
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: user.email,
        subject: "✓ CV Indexed: background matching active!",
        html: `
          <h1>Your CV is ready!</h1>
          <p>Hi ${user.name || 'there'},</p>
          <p>We've successfully indexed your Master CV. Our automated agent will now search for jobs matching these skills:</p>
          <p><strong>Keywords identified:</strong> ${profile.keywords.join(', ')}</p>
          <p>We'll notify you as soon as we find a match!</p>
        `
      })
    }

    res.json({
      message: "Master CV updated successfully",
      profile: {
        keywords: profile.keywords,
        summary: profile.summary,
      }
    })
  } catch (error: any) {
    console.error("Update master CV error:", error)
    
    // Check for Gemini Quota Error
    if (error.status === 429 || error.message?.includes("429") || error.message?.includes("quota")) {
      res.status(429).json({ 
        error: "The AI engine is currently reaching its free tier limit. Please wait about 60 seconds before trying again." 
      })
      return
    }

    res.status(500).json({ error: "Failed to process CV" })
  }
}

export const updateCvKeywords = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string
    const { keywords } = req.body

    if (!Array.isArray(keywords)) {
      res.status(400).json({ error: "Keywords must be an array" })
      return
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        cvKeywords: JSON.stringify(keywords)
      }
    })

    res.json({ message: "Skills updated successfully" })
  } catch (error) {
    console.error("Update keywords error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string
    const { name } = req.body

    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: "Name is required" })
      return
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      }
    })

    res.json({
      message: "Profile updated successfully",
      user
    })
  } catch (error) {
    console.error("Update profile error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const updateAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string
    const file = req.file

    if (!file) {
      console.warn("📸 [Avatar Controller] Request reached controller but no file was attached.")
      res.status(400).json({ error: "No image file provided" })
      return
    }

    console.log(`📸 [Avatar Controller] Processing file: ${file.originalname} | Type: ${file.mimetype} | Size: ${(file.size / 1024).toFixed(2)} KB`)

    // Create the public URL path
    const baseUrl = process.env.API_URL || "http://localhost:5000"
    const avatarUrl = `${baseUrl}/uploads/avatars/${file.filename}`
    
    console.log(`📸 [Avatar Controller] File saved to disk. URL: ${avatarUrl}. Saving to DB...`)

    await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl }
    })

    console.log("📸 [Avatar Controller] DB update successful.")
    res.json({
      message: "Avatar updated successfully",
      avatar: avatarUrl
    })
  } catch (error) {
    console.error("📸 [Avatar Controller] ERROR:", error)
    res.status(500).json({ error: "Internal server error while saving avatar" })
  }
}


