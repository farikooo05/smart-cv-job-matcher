import "dotenv/config"
import express from "express"
import cors from "cors"
import authRoutes from "./routes/auth.routes.js"
import analysisRoutes from "./routes/analysis.routes.js"
import userRoutes from "./routes/user.routes.js"
import { initCronJobs } from "./cron.js"
import { errorHandler } from "./middleware/error.middleware.js"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = parseInt(process.env.PORT || "5000")

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}))
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Serve static uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/analysis", analysisRoutes)
app.use("/api/user", userRoutes)

// Root route
app.get("/", (_req, res) => {
  res.send("🚀 OptiJob API is running correctly. Please use the Frontend at http://localhost:5173")
})

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// Global error handler
app.use(errorHandler)

// Initialize services (Set to run once a day at 12 PM Noon)
initCronJobs()

app.listen(PORT, () => {
  console.log(`🚀 OptiJob API running on http://localhost:${PORT}`)
})
