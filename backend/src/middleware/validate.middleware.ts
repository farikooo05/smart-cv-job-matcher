import type { Request, Response, NextFunction } from "express"
import { ZodSchema, ZodError } from "zod"

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })
      next()
    } catch (error) {
      // Pass the Zod error to the global error handler
      next(error)
    }
  }
}
