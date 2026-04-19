import { Router } from "express"
import {
  register,
  login,
  googleAuth,
  refreshToken,
  getMe,
} from "../controllers/auth.controller.js"
import { authMiddleware } from "../middleware/auth.js"

const router = Router()

router.post("/register", register)
router.post("/login", login)
router.post("/google", googleAuth)
router.post("/refresh", refreshToken)
router.get("/me", authMiddleware, getMe)

export default router
