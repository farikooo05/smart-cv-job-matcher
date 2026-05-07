import multer from "multer"
import path from "path"
import crypto from "crypto"

// Memory storage for PDFs (so they can be passed to Gemini without saving to disk)
const memoryStorage = multer.memoryStorage()

export const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true)
    } else {
      cb(new Error("Only PDF files are allowed for CV upload"))
    }
  },
})

// Disk storage for Avatars
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, "uploads/avatars")
  },
  filename: (_req, file, cb) => {
    // Generate unique filename to avoid collisions
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`
    const ext = path.extname(file.originalname)
    cb(null, `avatar-${uniqueSuffix}${ext}`)
  }
})

export const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error("Only image files (JPG, PNG, WebP) are allowed for avatars"))
    }
  },
})
