import type { Request, Response } from "express"
import bcrypt from "bcryptjs"
import prisma from "../lib/prisma.js"
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt.js"

import { logger } from "../lib/logger.js"

export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body
  logger.auth(`Registration attempt: ${email}`)

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    logger.warn(`Registration failed: Email already exists: ${email}`)
    res.status(409).json({ error: "Email already registered" })
    return
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
  })

  logger.success(`User registered successfully: ${email} (ID: ${user.id})`)
  const accessToken = generateAccessToken(user.id)
  const refreshToken = generateRefreshToken(user.id)

  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    },
    accessToken,
    refreshToken,
  })
}

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body
  logger.auth(`Login attempt: ${email} from IP: ${req.ip}`)

  const user = await prisma.user.findUnique({ where: { email } })
  
  if (!user || !user.password) {
    logger.warn(`Login failed: User not found or no password set: ${email}`)
    res.status(401).json({ error: "There is no such user with this email." })
    return
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    logger.warn(`Login failed: Invalid password for ${email}`)
    res.status(401).json({ error: "The password you entered is incorrect." })
    return
  }

  logger.success(`Login successful: ${email}`)

  const accessToken = generateAccessToken(user.id)
  const refreshToken = generateRefreshToken(user.id)

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    },
    accessToken,
    refreshToken,
  })
}

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
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
}

export const getMe = async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      createdAt: true,
    },
  })

  if (!user) {
    res.status(404).json({ error: "User not found" })
    return
  }

  res.json({ user })
}

