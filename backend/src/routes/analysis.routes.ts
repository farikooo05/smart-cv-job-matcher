import { Router } from "express"
import {
  createAnalysis,
  getAnalyses,
  getAnalysisById,
  deleteAnalysis,
  getStats,
  getMatches,
  triggerScrape,
  deleteMatch,
  syncUserMatches,
} from "../controllers/analysis.controller.js"
import { authMiddleware } from "../middleware/auth.js"
import { upload } from "../middleware/upload.js"

const router = Router()

// All analysis routes require authentication
router.use(authMiddleware)

router.post("/", upload.single("cv"), createAnalysis)
router.get("/", getAnalyses)
router.get("/stats", getStats)
router.get("/matches", getMatches)
router.delete("/matches/:id", deleteMatch)
router.post("/scrape", triggerScrape)
router.post("/sync", syncUserMatches)
router.get("/:id", getAnalysisById)
router.delete("/:id", deleteAnalysis)

export default router
