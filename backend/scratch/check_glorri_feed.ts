import axios from "axios"

async function checkGlorri() {
  console.log("🔍 Fetching latest Glorri vacancies (Safe Mode)...")
  try {
    const { data } = await axios.get("https://api.glorri.az/job-service-v2/jobs/public?offset=0&limit=20", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    })
    
    const items = data.entities || []
    console.log(`\n✅ Found ${items.length} vacancies in the feed:\n`)
    
    items.forEach((item: any, index: number) => {
      console.log(`${index + 1}. [${item.company?.name || 'Company'}] ${item.title}`)
    })
    
  } catch (error: any) {
    console.error("❌ Glorri Feed Error:", error.message)
    if (error.response) {
      console.log("Status:", error.response.status)
      console.log("Data:", JSON.stringify(error.response.data))
    }
  }
}

checkGlorri()
