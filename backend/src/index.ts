import "dotenv/config"
import express from "express"
import cors from "cors"
import authRoutes from "./routes/auth.routes.js"
import analysisRoutes from "./routes/analysis.routes.js"
import userRoutes from "./routes/user.routes.js"
import { initCronJobs } from "./cron.js"

const app = express()
const PORT = parseInt(process.env.PORT || "5000")

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}))
app.use(express.json())

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
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err)
  res.status(500).json({ error: "Internal server error" })
})

// Initialize services (Set to run once a day at 12 PM Noon)
initCronJobs()

app.listen(PORT, () => {
  console.log(`🚀 OptiJob API running on http://localhost:${PORT}`)
})
