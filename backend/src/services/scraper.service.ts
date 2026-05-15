import axios from "axios"
import * as cheerio from "cheerio"
import prisma from "../lib/prisma.js"

interface ScrapedJob {
  title: string
  company: string
  location: string
  url: string
  source: string
  description?: string
  salary?: string
}

export const scrapeGlorri = async (): Promise<ScrapedJob[]> => {
  try {
    const { data } = await axios.get("https://api.glorri.az/job-service-v2/jobs/public?offset=0&limit=20", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    })
    
    // Glorri API returns { entities: [...] }
    const items = data.entities || []
    const jobs: ScrapedJob[] = items.map((item: any) => ({
      title: item.title,
      company: item.company?.name || "Glorri Partner",
      location: item.location || "Baku, Azerbaijan",
      // Corrected URL structure: vacancies are on jobs.glorri.com
      url: `https://jobs.glorri.com/vacancies/${item.company?.slug || "portal"}/${item.slug}`,
      source: "glorri"
    }))

    console.log(`[Scraper] Glorri: Found ${jobs.length} items`)
    return jobs
  } catch (error) {
    console.error("Glorri scrape error:", error)
    return []
  }
}

export const scrapeJobSearch = async (): Promise<ScrapedJob[]> => {
  try {
    const { data } = await axios.get("https://jobsearch.az/vacancies", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    })
    const $ = cheerio.load(data)
    const jobs: ScrapedJob[] = []

    // Updated selectors for the new JobSearch.az structure
    $(".list__item").each((_, el) => {
      // Skip advertisement items
      if ($(el).hasClass("list__item--reklam")) return

      const linkEl = $(el).find("a.list__item__text")
      const titleEl = $(el).find(".list__item__title")
      
      const title = titleEl.text().trim()
      const url = linkEl.attr("href")
      
      // The company name is usually the text node sibling to the h3 title within the same link
      // We can get it by taking the full link text and removing the title text
      const fullLinkText = linkEl.text().trim()
      const company = fullLinkText.replace(title, "").trim()

      if (title && url) {
        jobs.push({
          title,
          company: company || "Unknown Company",
          location: "Azerbaijan",
          url: url.startsWith("http") ? url : `https://jobsearch.az${url}`,
          source: "jobsearch"
        })
      }
    })

    console.log(`[Scraper] JobSearch: Found ${jobs.length} items`)
    return jobs
  } catch (error) {
    console.error("JobSearch scrape error:", error)
    return []
  }
}

export const scrapeBusyAz = async (): Promise<ScrapedJob[]> => {
  try {
    const { data } = await axios.get("https://busy.az/api/bff/api/vacancies?page=1&per_page=48", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    })
    
    // Busy.az API returns { vacancies: [...] }
    const items = data.vacancies || []
    const jobs: ScrapedJob[] = items.map((item: any) => ({
      title: item.job_title || item.title,
      company: item.company?.title || item.employer?.name || "Busy.az Partner",
      location: "Azerbaijan",
      url: `https://busy.az/vacancies/${item.slug}`,
      source: "busy"
    }))

    console.log(`[Scraper] Busy.az: Found ${jobs.length} items`)
    return jobs
  } catch (error) {
    console.error("Busy.az scrape error:", error)
    return []
  }
}

export const runFullScrape = async (): Promise<void> => {
  console.log("[Scraper] Starting full API pulse cycle...")
  
  const [glorri, jobsearch, busy] = await Promise.all([
    scrapeGlorri(),
    scrapeJobSearch(),
    scrapeBusyAz()
  ])

  const allJobs = [...glorri, ...jobsearch, ...busy]

  const result = await prisma.job.createMany({
    data: allJobs.map(job => ({
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      source: job.source,
      description: job.description || "Refer to job portal for details"
    })),
    skipDuplicates: true
  })

  console.log(`[Scraper] Cycle complete. Synced ${allJobs.length} potential jobs. Added ${result.count} new records.`)
}
