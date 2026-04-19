import type { Request, Response } from "express"
import bcrypt from "bcryptjs"
import prisma from "../lib/prisma.js"
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt.js"

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required" })
      return
    }

    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" })
      return
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      res.status(409).json({ error: "Email already registered" })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        provider: "email",
      },
    })

    const accessToken = generateAccessToken(user.id)
    const refreshToken = generateRefreshToken(user.id)

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
      },
      accessToken,
      refreshToken,
    })
  } catch (error) {
    console.error("Register error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" })
      return
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password) {
      res.status(401).json({ error: "Invalid email or password" })
      return
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid email or password" })
      return
    }

    const accessToken = generateAccessToken(user.id)
    const refreshToken = generateRefreshToken(user.id)

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
      },
      accessToken,
      refreshToken,
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential } = req.body

    if (!credential) {
      res.status(400).json({ error: "Google credential is required" })
      return
    }

    // Fetch user info using the Google access token
    const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${credential}` },
    })

    if (!googleRes.ok) {
      res.status(400).json({ error: "Invalid Google token" })
      return
    }

    const googleUser = await googleRes.json() as {
      sub: string
      name: string
      email: string
      picture?: string
    }

    if (!googleUser.email) {
      res.status(400).json({ error: "Could not retrieve email from Google" })
      return
    }

    let user = await prisma.user.findUnique({
      where: { email: googleUser.email },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: googleUser.name || "User",
          email: googleUser.email,
          avatar: googleUser.picture || null,
          provider: "google",
          providerId: googleUser.sub,
        },
      })
    } else if (user.provider !== "google") {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          avatar: user.avatar || googleUser.picture || null,
          providerId: googleUser.sub,
        },
      })
    }

    const accessToken = generateAccessToken(user.id)
    const refreshToken = generateRefreshToken(user.id)

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
      },
      accessToken,
      refreshToken,
    })
  } catch (error) {
    console.error("Google auth error:", error)
    res.status(500).json({ error: "Google authentication failed" })
  }
}

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body

    if (!token) {
      res.status(400).json({ error: "Refresh token is required" })
      return
    }

    const payload = verifyRefreshToken(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      res.status(401).json({ error: "User not found" })
      return
    }

    const newAccessToken = generateAccessToken(user.id)
    const newRefreshToken = generateRefreshToken(user.id)

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    })
  } catch {
    res.status(401).json({ error: "Invalid refresh token" })
  }
}

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        provider: true,
        createdAt: true,
      },
    })

    if (!user) {
      res.status(404).json({ error: "User not found" })
      return
    }

    res.json({ user })
  } catch (error) {
    console.error("Get me error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}
