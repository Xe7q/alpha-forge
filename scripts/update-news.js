// Daily News Updater Script
// This script fetches fresh financial news and updates curated-news.json
// Run via: node scripts/update-news.js

const fs = require('fs')
const path = require('path')

const NEWS_FILE = path.join(__dirname, '../public/curated-news.json')

// Sample news generator (in production, this would fetch from news APIs)
function generateDailyNews() {
  const today = new Date().toISOString().split('T')[0]
  
  return [
    {
      id: `daily-${today}-1`,
      title: "Markets Update: Stocks Mixed as Earnings Season Continues",
      description: "Major indices showing mixed performance as investors digest corporate earnings reports. Tech sector leading while energy lags.",
      source: "Market Watch",
      url: "https://www.marketwatch.com",
      publishedAt: new Date().toISOString(),
      sentiment: "neutral"
    },
    {
      id: `daily-${today}-2`,
      title: "Fed Policy Outlook: Rates Expected to Hold Steady",
      description: "Federal Reserve officials signal patience on rate cuts as inflation remains above target. Markets pricing in gradual easing.",
      source: "Reuters",
      url: "https://www.reuters.com",
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      sentiment: "neutral"
    },
    {
      id: `daily-${today}-3`,
      title: "AI Investment Boom Drives Chipmaker Stocks Higher",
      description: "Semiconductor companies seeing strong demand as AI infrastructure buildout accelerates. NVDA, AMD leading gains.",
      source: "Bloomberg",
      url: "https://www.bloomberg.com",
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      ticker: "NVDA",
      sentiment: "positive"
    }
  ]
}

function updateNews() {
  console.log('Updating curated news...')
  
  try {
    const news = generateDailyNews()
    fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2))
    console.log(`✅ Updated ${NEWS_FILE} with ${news.length} articles`)
  } catch (error) {
    console.error('❌ Failed to update news:', error)
    process.exit(1)
  }
}

updateNews()