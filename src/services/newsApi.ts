// NewsAPI Service for financial news
const API_KEY = 'YOUR_NEWSAPI_KEY' // Get from https://newsapi.org
const BASE_URL = 'https://newsapi.org/v2'

export interface NewsArticle {
  id: string
  title: string
  description: string
  source: string
  url: string
  publishedAt: string
  urlToImage?: string
  ticker?: string
  sentiment: 'positive' | 'negative' | 'neutral'
}

// Mock news data for demo (until API key added)
const MOCK_NEWS: NewsArticle[] = [
  {
    id: '1',
    title: 'Fed Signals Potential Rate Cuts in Q3',
    description: 'Federal Reserve officials hint at possible interest rate reductions later this year as inflation shows signs of cooling.',
    source: 'Bloomberg',
    url: '#',
    publishedAt: new Date().toISOString(),
    sentiment: 'positive',
    ticker: 'SPY'
  },
  {
    id: '2',
    title: 'NVIDIA Announces Next-Gen AI Chips',
    description: 'New Blackwell architecture promises 30x performance improvement for AI workloads.',
    source: 'Reuters',
    url: '#',
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    sentiment: 'positive',
    ticker: 'NVDA'
  },
  {
    id: '3',
    title: 'Apple Vision Pro Sales Exceed Expectations',
    description: 'Early adopters praise mixed-reality headset as company ramps production.',
    source: 'TechCrunch',
    url: '#',
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    sentiment: 'positive',
    ticker: 'AAPL'
  },
  {
    id: '4',
    title: 'Tech Sector Faces Regulatory Pressure',
    description: 'EU and US regulators announce new antitrust investigations targeting major tech companies.',
    source: 'WSJ',
    url: '#',
    publishedAt: new Date(Date.now() - 10800000).toISOString(),
    sentiment: 'negative',
    ticker: 'MSFT'
  },
  {
    id: '5',
    title: 'Bitcoin ETF Inflows Reach Record High',
    description: 'Institutional investors pour billions into newly approved spot Bitcoin ETFs.',
    source: 'CoinDesk',
    url: '#',
    publishedAt: new Date(Date.now() - 14400000).toISOString(),
    sentiment: 'positive',
    ticker: 'BTC'
  }
]

// Fetch news for specific tickers
export async function getNewsForTickers(tickers: string[]): Promise<NewsArticle[]> {
  // For now, return mock data filtered by tickers
  // In production, use: `${BASE_URL}/everything?q=${tickers.join(' OR ')}&apiKey=${API_KEY}`
  
  if (!tickers.length) return MOCK_NEWS
  
  return MOCK_NEWS.filter(news => 
    tickers.some(ticker => 
      news.ticker === ticker || 
      news.title.toLowerCase().includes(ticker.toLowerCase())
    )
  )
}

// Fetch general market news
export async function getMarketNews(): Promise<NewsArticle[]> {
  return MOCK_NEWS
}

// Get news impact score (1-10)
export function getImpactScore(article: NewsArticle): number {
  const keywords: Record<string, number> = {
    'earnings': 8,
    'revenue': 7,
    'profit': 7,
    'loss': 7,
    'merger': 9,
    'acquisition': 9,
    'ipo': 9,
    'bankruptcy': 10,
    'lawsuit': 8,
    'investigation': 8,
    'fda': 9,
    'approval': 8,
    'ban': 9,
    'tariff': 7,
    'sanctions': 8,
    'rate cut': 8,
    'rate hike': 8,
    'inflation': 7,
    'recession': 9
  }
  
  const titleLower = article.title.toLowerCase()
  let score = 5 // Default
  
  for (const [keyword, impact] of Object.entries(keywords)) {
    if (titleLower.includes(keyword)) {
      score = Math.max(score, impact)
    }
  }
  
  return score
}

// Simple sentiment analysis
export function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const positive = ['surge', 'rally', 'gain', 'profit', 'growth', 'beat', 'exceed', 'record', 'high', 'bull', 'upgrade', 'buy', 'outperform']
  const negative = ['crash', 'plunge', 'loss', 'decline', 'drop', 'miss', 'fall', 'low', 'bear', 'downgrade', 'sell', 'underperform', 'investigation', 'lawsuit', 'fraud']
  
  const textLower = text.toLowerCase()
  let posCount = positive.filter(w => textLower.includes(w)).length
  let negCount = negative.filter(w => textLower.includes(w)).length
  
  if (posCount > negCount) return 'positive'
  if (negCount > posCount) return 'negative'
  return 'neutral'
}