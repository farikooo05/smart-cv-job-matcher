import type { Request, Response, NextFunction } from "express"
import { ZodError } from "zod"

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // If the error is a Zod validation error, return a 400 with details
  if (err instanceof ZodError) {
    const formattedErrors = (err as any).errors.map((e: any) => ({
      field: e.path.join("."),
      message: e.message,
    }))
    
    return res.status(400).json({
      error: "Validation Error",
      details: formattedErrors,
    })
  }

  // Handle specific known errors (e.g. JWT errors, Prisma errors)
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: "Invalid token" })
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: "Token expired" })
  }

  // Generic fallback
  console.error("🔥 [Global Error Handler]:", err.message || err)
  
  const statusCode = err.statusCode || 500
  const message = err.message || "Internal Server Error"

  res.status(statusCode).json({ error: message })
}
