// Combined Price Service - Finnhub primary, Alpha Vantage fallback
import { API_KEY as FINNHUB_KEY } from './finnhub'

const ALPHA_VANTAGE_KEY = 'URF2ZWCAUMR701W5'
const ALPHA_BASE_URL = 'https://www.alphavantage.co/query'

export interface PriceData {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: number
  source: 'finnhub' | 'alphavantage'
}

// Cache to avoid redundant API calls
const priceCache: Map<string, { data: PriceData; timestamp: number }> = new Map()
const CACHE_TTL = 60000 // 1 minute

// Try Finnhub first, then Alpha Vantage
export async function getPriceWithFallback(symbol: string): Promise<PriceData | null> {
  const upperSymbol = symbol.toUpperCase()
  const cacheKey = upperSymbol
  
  // Check cache first
  const cached = priceCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Using cached price for ${symbol}`)
    return cached.data
  }
  
  // Try Finnhub first
  const finnhubPrice = await getPriceFromFinnhub(upperSymbol)
  if (finnhubPrice) {
    priceCache.set(cacheKey, { data: finnhubPrice, timestamp: Date.now() })
    return finnhubPrice
  }
  
  // Fallback to Alpha Vantage
  console.log(`Finnhub failed for ${symbol}, trying Alpha Vantage...`)
  const alphaPrice = await getPriceFromAlphaVantage(upperSymbol)
  if (alphaPrice) {
    priceCache.set(cacheKey, { data: alphaPrice, timestamp: Date.now() })
    return alphaPrice
  }
  
  // Both failed - return cached if available (even if expired)
  if (cached) {
    console.log(`Using stale cache for ${symbol}`)
    return cached.data
  }
  
  return null
}

// Get price from Finnhub
async function getPriceFromFinnhub(symbol: string): Promise<PriceData | null> {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`,
      { timeout: 5000 } as any
    )
    
    if (!response.ok) return null
    
    const data = await response.json()
    if (!data.c) return null
    
    return {
      symbol,
      price: data.c,
      change: data.d || 0,
      changePercent: data.dp || 0,
      volume: data.v || 0,
      timestamp: Date.now(),
      source: 'finnhub'
    }
  } catch (error) {
    console.error(`Finnhub error for ${symbol}:`, error)
    return null
  }
}

// Get price from Alpha Vantage
async function getPriceFromAlphaVantage(symbol: string): Promise<PriceData | null> {
  try {
    const response = await fetch(
      `${ALPHA_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`,
      { timeout: 5000 } as any
    )
    
    if (!response.ok) return null
    
    const data = await response.json()
    const quote = data['Global Quote']
    
    if (!quote || Object.keys(quote).length === 0) return null
    
    return {
      symbol,
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent']?.replace('%', '')),
      volume: parseInt(quote['06. volume']),
      timestamp: Date.now(),
      source: 'alphavantage'
    }
  } catch (error) {
    console.error(`Alpha Vantage error for ${symbol}:`, error)
    return null
  }
}

// Batch fetch with fallback for multiple symbols
export async function getMultiplePricesWithFallback(symbols: string[]): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>()
  
  for (const symbol of symbols) {
    const data = await getPriceWithFallback(symbol)
    if (data) {
      results.set(symbol.toUpperCase(), data)
    }
    // Small delay between calls
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  return results
}

// Get API status
export function getPriceServiceStatus(): {
  cacheSize: number
  cachedTickers: string[]
} {
  return {
    cacheSize: priceCache.size,
    cachedTickers: Array.from(priceCache.keys())
  }
}

// Clear cache (useful for testing)
export function clearPriceCache(): void {
  priceCache.clear()
}