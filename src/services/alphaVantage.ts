const API_KEY = 'URF2ZWCAUMR701W5'
const BASE_URL = 'https://www.alphavantage.co/query'

interface PriceData {
  price: number
  change: number
  changePercent: number
  lastUpdated: string
}

// Cache prices to avoid API limits (5 calls per minute)
const priceCache: Map<string, { data: PriceData; timestamp: number }> = new Map()
const CACHE_DURATION = 60000 // 1 minute

export async function getStockPrice(symbol: string): Promise<PriceData | null> {
  const cacheKey = symbol.toUpperCase()
  const cached = priceCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  try {
    const response = await fetch(
      `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${cacheKey}&apikey=${API_KEY}`
    )
    const data = await response.json()
    
    const quote = data['Global Quote']
    if (!quote || Object.keys(quote).length === 0) {
      console.warn(`No data for ${symbol}`)
      return null
    }

    const priceData: PriceData = {
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
      lastUpdated: quote['07. latest trading day']
    }

    priceCache.set(cacheKey, { data: priceData, timestamp: Date.now() })
    return priceData
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error)
    return null
  }
}

// Get multiple prices with rate limiting
export async function getMultiplePrices(symbols: string[]): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>()
  
  for (const symbol of symbols) {
    const data = await getStockPrice(symbol)
    if (data) {
      results.set(symbol.toUpperCase(), data)
    }
    // Rate limit: wait 12 seconds between calls (5 per minute max)
    if (symbols.indexOf(symbol) < symbols.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 12000))
    }
  }
  
  return results
}

// Crypto prices (Alpha Vantage supports crypto too)
export async function getCryptoPrice(symbol: string): Promise<PriceData | null> {
  const cacheKey = `CRYPTO_${symbol.toUpperCase()}`
  const cached = priceCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  try {
    const response = await fetch(
      `${BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbol}&to_currency=USD&apikey=${API_KEY}`
    )
    const data = await response.json()
    
    const rate = data['Realtime Currency Exchange Rate']
    if (!rate) return null

    const priceData: PriceData = {
      price: parseFloat(rate['5. Exchange Rate']),
      change: 0, // Not provided in this endpoint
      changePercent: 0,
      lastUpdated: rate['6. Last Refreshed']
    }

    priceCache.set(cacheKey, { data: priceData, timestamp: Date.now() })
    return priceData
  } catch (error) {
    console.error(`Error fetching crypto ${symbol}:`, error)
    return null
  }
}