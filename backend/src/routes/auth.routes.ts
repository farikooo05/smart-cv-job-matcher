import { Router } from "express"
import {
  register,
  login,
  refreshToken,
  getMe,
} from "../controllers/auth.controller.js"
import { authMiddleware } from "../middleware/auth.js"
import { validate } from "../middleware/validate.middleware.js"
import { registerSchema, loginSchema } from "../validators/auth.validator.js"
import { catchAsync } from "../lib/catchAsync.js"

const router = Router()

router.post("/register", validate(registerSchema), catchAsync(register))
router.post("/login", validate(loginSchema), catchAsync(login))
router.post("/refresh", catchAsync(refreshToken))
router.get("/me", authMiddleware, catchAsync(getMe))

export default router
