import { Router } from "express"
import {
  getProfile,
  updateMasterCv,
  updateCvKeywords,
  updateProfile,
  updateAvatar,
} from "../controllers/user.controller.js"
import { authMiddleware } from "../middleware/auth.js"
import { upload, avatarUpload } from "../middleware/upload.js"

const router = Router()

// All user routes require authentication
router.use(authMiddleware)

router.get("/profile", getProfile)
router.put("/profile", updateProfile)
router.post("/cv", upload.single("cv"), updateMasterCv)

// Custom wrapper for avatar upload to catch Multer errors and log details
router.post("/avatar", (req, res, next) => {
  console.log("📸 [Avatar] Incoming upload request received.")
  const uploadMiddleware = avatarUpload.single("avatar")
  
  uploadMiddleware(req, res, (err: any) => {
    if (err) {
      console.error("📸 [Avatar] Multer Error:", err.message || err)
      return res.status(400).json({ error: `Upload error: ${err.message || 'Unknown file processing error'}` })
    }
    console.log("📸 [Avatar] File parsed successfully by Multer. Passing to controller...")
    next()
  })
}, updateAvatar)

router.put("/keywords", updateCvKeywords)

export default router
