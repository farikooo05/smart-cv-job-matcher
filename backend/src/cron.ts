import cron from "node-cron"
import { runFullScrape } from "./services/scraper.service.js"
import { runMatchingCycle } from "./services/matching.service.js"

export const initCronJobs = () => {
  // Run Scraper once a day at 20:00 (8:00 PM)
  cron.schedule("0 20 * * *", async () => {
    try {
      await runFullScrape()
      // Wait 5 minutes for jobs to settle, then run matching
      setTimeout(async () => {
        await runMatchingCycle()
      }, 5 * 60 * 1000)
    } catch (error) {
      console.error("[Cron] Full cycle error:", error)
    }
  })

  // Manual trigger is available via the frontend or API during development

  console.log("⏰ Cron jobs initialized")
}
