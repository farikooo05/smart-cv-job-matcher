import { Router } from "express"
import {
  getProfile,
  updateMasterCv,
  updateCvKeywords,
} from "../controllers/user.controller.js"
import { authMiddleware } from "../middleware/auth.js"
import { upload } from "../middleware/upload.js"

const router = Router()

// All user routes require authentication
router.use(authMiddleware)

router.get("/profile", getProfile)
router.post("/cv", upload.single("cv"), updateMasterCv)
router.put("/keywords", updateCvKeywords)

export default router
