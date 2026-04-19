import axios from 'axios';
import * as cheerio from 'cheerio';

async function testScrape() {
  try {
    const { data } = await axios.get("https://jobsearch.az/vacancies", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const $ = cheerio.load(data);
    const items = $(".list__item").length;
    console.log(`Found ${items} items with .list__item`);
    
    $(".list__item").each((i, el) => {
        if (i < 3) {
            console.log(`Item ${i}:`, $(el).html().substring(0, 200));
        }
    });
  } catch (err) {
    console.error(err);
  }
}

testScrape();
