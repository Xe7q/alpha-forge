// Enhanced Alpha Vantage service with auto-refresh and better rate limiting
const API_KEY = 'URF2ZWCAUMR701W5'
const BASE_URL = 'https://www.alphavantage.co/query'

interface PriceData {
  price: number
  change: number
  changePercent: number
  volume?: number
  lastUpdated: string
}

interface CachedPrice {
  data: PriceData
  timestamp: number
}

// Cache with 60 second TTL to respect rate limits
const priceCache: Map<string, CachedPrice> = new Map()
const CACHE_TTL = 60000 // 1 minute
const RATE_LIMIT_DELAY = 12000 // 12 seconds between calls (5 calls/min max)

let lastRequestTime = 0
let consecutiveErrors = 0

// Rate limited fetch with queue
async function rateLimitedFetch(url: string): Promise<Response | null> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }
  
  try {
    lastRequestTime = Date.now()
    const response = await fetch(url)
    
    if (response.status === 429) {
      console.warn('Rate limit hit, backing off...')
      consecutiveErrors++
      return null
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    consecutiveErrors = 0
    return response
  } catch (error) {
    console.error('Fetch error:', error)
    consecutiveErrors++
    return null
  }
}

export async function getStockPrice(symbol: string): Promise<PriceData | null> {
  const cacheKey = symbol.toUpperCase()
  const cached = priceCache.get(cacheKey)
  
  // Return cached data if still fresh
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Using cached price for ${symbol}`)
    return cached.data
  }

  const response = await rateLimitedFetch(
    `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${cacheKey}&apikey=${API_KEY}`
  )
  
  if (!response) return cached?.data || null

  try {
    const data = await response.json()
    const quote = data['Global Quote']
    
    if (!quote || Object.keys(quote).length === 0) {
      console.warn(`No data for ${symbol}`)
      return cached?.data || null
    }

    const priceData: PriceData = {
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent']?.replace('%', '') || '0'),
      volume: parseInt(quote['06. volume']),
      lastUpdated: quote['07. latest trading day']
    }

    priceCache.set(cacheKey, { data: priceData, timestamp: Date.now() })
    return priceData
  } catch (error) {
    console.error(`Error parsing ${symbol}:`, error)
    return cached?.data || null
  }
}

// Batch fetch multiple stocks with rate limiting
export async function getMultiplePrices(symbols: string[]): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>()
  
  for (const symbol of symbols) {
    const data = await getStockPrice(symbol)
    if (data) {
      results.set(symbol.toUpperCase(), data)
    }
  }
  
  return results
}

// Get API status
export function getApiStatus(): { 
  isRateLimited: boolean 
  consecutiveErrors: number
  lastRequestTime: number
} {
  return {
    isRateLimited: consecutiveErrors > 2,
    consecutiveErrors,
    lastRequestTime
  }
}

// Reset error count (call after successful batch)
export function resetErrorCount() {
  consecutiveErrors = 0
}

// Get cache info
export function getCacheInfo(): { size: number; oldestEntry: number } {
  let oldest = Date.now()
  priceCache.forEach((cached) => {
    if (cached.timestamp < oldest) oldest = cached.timestamp
  })
  return {
    size: priceCache.size,
    oldestEntry: oldest
  }
}