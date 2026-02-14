// Finnhub API Service - Real-time price streaming
const API_KEY = 'd687159r01qi2if71n70d687159r01qi2if71n7g'
const BASE_URL = 'https://finnhub.io/api/v1'
const WS_URL = `wss://ws.finnhub.io?token=${API_KEY}`

export interface PriceData {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: number
}

// WebSocket for real-time streaming
let ws: WebSocket | null = null
let subscribedSymbols: Set<string> = new Set()
let priceCallbacks: Map<string, ((price: PriceData) => void)[]> = new Map()
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5

// Initialize WebSocket connection
export function initWebSocket(
  onPriceUpdate: (data: PriceData) => void,
  onConnect?: () => void,
  onDisconnect?: () => void
): WebSocket | null {
  if (ws?.readyState === WebSocket.OPEN) {
    return ws
  }

  try {
    ws = new WebSocket(WS_URL)
    
    ws.onopen = () => {
      console.log('Finnhub WebSocket connected')
      reconnectAttempts = 0
      
      // Resubscribe to previous symbols
      subscribedSymbols.forEach(symbol => {
        ws?.send(JSON.stringify({ type: 'subscribe', symbol }))
      })
      
      onConnect?.()
    }
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'trade') {
        data.data.forEach((trade: any) => {
          const priceData: PriceData = {
            symbol: trade.s,
            price: trade.p,
            change: 0, // Will calculate separately
            changePercent: 0,
            volume: trade.v,
            timestamp: trade.t
          }
          
          onPriceUpdate(priceData)
          
          // Notify specific callbacks
          const callbacks = priceCallbacks.get(trade.s) || []
          callbacks.forEach(cb => cb(priceData))
        })
      }
    }
    
    ws.onclose = () => {
      console.log('Finnhub WebSocket disconnected')
      onDisconnect?.()
      
      // Attempt to reconnect
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++
        setTimeout(() => {
          console.log(`Reconnecting... attempt ${reconnectAttempts}`)
          initWebSocket(onPriceUpdate, onConnect, onDisconnect)
        }, 3000 * reconnectAttempts)
      }
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    return ws
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error)
    return null
  }
}

// Subscribe to symbol for real-time updates
export function subscribeToSymbol(symbol: string): void {
  const upperSymbol = symbol.toUpperCase()
  
  if (!subscribedSymbols.has(upperSymbol)) {
    subscribedSymbols.add(upperSymbol)
    
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'subscribe', symbol: upperSymbol }))
    }
  }
}

// Unsubscribe from symbol
export function unsubscribeFromSymbol(symbol: string): void {
  const upperSymbol = symbol.toUpperCase()
  
  subscribedSymbols.delete(upperSymbol)
  
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'unsubscribe', symbol: upperSymbol }))
  }
}

// Close WebSocket connection
export function closeWebSocket(): void {
  ws?.close()
  ws = null
  subscribedSymbols.clear()
  priceCallbacks.clear()
}

// Get quote via REST API (fallback)
export async function getQuote(symbol: string): Promise<PriceData | null> {
  try {
    const response = await fetch(
      `${BASE_URL}/quote?symbol=${symbol.toUpperCase()}&token=${API_KEY}`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.c) {
      return null
    }
    
    return {
      symbol: symbol.toUpperCase(),
      price: data.c,
      change: data.d || 0,
      changePercent: data.dp || 0,
      volume: data.v || 0,
      timestamp: Date.now()
    }
  } catch (error) {
    console.error(`Failed to fetch ${symbol}:`, error)
    return null
  }
}

// Batch get quotes for multiple symbols
export async function getMultipleQuotes(symbols: string[]): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>()
  
  // Finnhub allows 60 calls/minute, so we can batch efficiently
  for (const symbol of symbols) {
    const data = await getQuote(symbol)
    if (data) {
      results.set(symbol.toUpperCase(), data)
    }
    // Small delay to be respectful (1 call per second = well under 60/min)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  return results
}

// Search for symbols
export async function searchSymbols(query: string): Promise<any[]> {
  try {
    const response = await fetch(
      `${BASE_URL}/search?q=${encodeURIComponent(query)}&token=${API_KEY}`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data.result || []
  } catch (error) {
    console.error('Search failed:', error)
    return []
  }
}

// Get company profile
export async function getCompanyProfile(symbol: string): Promise<any | null> {
  try {
    const response = await fetch(
      `${BASE_URL}/stock/profile2?symbol=${symbol.toUpperCase()}&token=${API_KEY}`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Failed to get company profile:', error)
    return null
  }
}

// Get connection status
export function getWebSocketStatus(): 'connected' | 'connecting' | 'disconnected' {
  if (!ws) return 'disconnected'
  if (ws.readyState === WebSocket.OPEN) return 'connected'
  if (ws.readyState === WebSocket.CONNECTING) return 'connecting'
  return 'disconnected'
}

// Get subscribed symbols
export function getSubscribedSymbols(): string[] {
  return Array.from(subscribedSymbols)
}