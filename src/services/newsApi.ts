// NewsAPI Service for financial news
const API_KEY = '978915d1fcbe404ab5c25266df3a2667'
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

interface NewsAPIResponse {
  status: string
  articles: Array<{
    title: string
    description: string
    source: { name: string }
    url: string
    publishedAt: string
    urlToImage?: string
  }>
}

// Fetch real news from NewsAPI
export async function getNewsForTickers(tickers: string[]): Promise<NewsArticle[]> {
  try {
    // Build search query - include tickers and company names
    const query = tickers.length > 0 
      ? tickers.join(' OR ')
      : 'stock market finance'
    
    const url = `${BASE_URL}/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${API_KEY}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error('NewsAPI error:', response.status)
      return getFallbackNews(tickers)
    }
    
    const data: NewsAPIResponse = await response.json()
    
    if (data.status !== 'ok' || !data.articles) {
      return getFallbackNews(tickers)
    }
    
    // Transform to our format
    return data.articles.map((article, index) => {
      const sentiment = analyzeSentiment(article.title + ' ' + (article.description || ''))
      const ticker = tickers.find(t => 
        article.title.toLowerCase().includes(t.toLowerCase()) ||
        (article.description && article.description.toLowerCase().includes(t.toLowerCase()))
      )
      
      return {
        id: `news-${index}-${Date.now()}`,
        title: article.title,
        description: article.description || '',
        source: article.source.name,
        url: article.url,
        publishedAt: article.publishedAt,
        urlToImage: article.urlToImage,
        ticker,
        sentiment
      }
    })
  } catch (error) {
    console.error('Failed to fetch news:', error)
    return getFallbackNews(tickers)
  }
}

// Fetch general market news
export async function getMarketNews(): Promise<NewsArticle[]> {
  return getNewsForTickers([])
}

// Fallback news if API fails
function getFallbackNews(tickers: string[]): NewsArticle[] {
  const fallback: NewsArticle[] = [
    {
      id: '1',
      title: 'Markets Open Mixed Amid Earnings Season',
      description: 'Major indices showing varied performance as companies report quarterly results.',
      source: 'Market Watch',
      url: '#',
      publishedAt: new Date().toISOString(),
      sentiment: 'neutral'
    },
    {
      id: '2',
      title: 'Fed Watch: Interest Rate Decision Looming',
      description: 'Investors await Federal Reserve announcement on monetary policy direction.',
      source: 'Reuters',
      url: '#',
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      sentiment: 'neutral'
    }
  ]
  
  if (!tickers.length) return fallback
  
  return fallback.map(news => ({
    ...news,
    ticker: tickers[0]
  }))
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
  const positive = ['surge', 'rally', 'gain', 'profit', 'growth', 'beat', 'exceed', 'record', 'high', 'bull', 'upgrade', 'buy', 'outperform', 'moon', 'rocket', 'soar']
  const negative = ['crash', 'plunge', 'loss', 'decline', 'drop', 'miss', 'fall', 'low', 'bear', 'downgrade', 'sell', 'underperform', 'investigation', 'lawsuit', 'fraud', 'crash', 'dump']
  
  const textLower = text.toLowerCase()
  let posCount = positive.filter(w => textLower.includes(w)).length
  let negCount = negative.filter(w => textLower.includes(w)).length
  
  if (posCount > negCount) return 'positive'
  if (negCount > posCount) return 'negative'
  return 'neutral'
}