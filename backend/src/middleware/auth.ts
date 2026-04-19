import type { Request, Response, NextFunction } from "express"
import { verifyAccessToken } from "../lib/jwt.js"

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Access token required" })
    return
  }

  const token = authHeader.split(" ")[1]

  try {
    const payload = verifyAccessToken(token)
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" })
    return
  }
}
