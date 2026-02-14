// Portfolio History & Performance Tracking
import { Position } from '../App'

export interface PortfolioSnapshot {
  timestamp: number
  date: string
  totalValue: number
  totalCost: number
  positions: Position[]
}

export interface PerformanceMetrics {
  totalReturn: number
  totalReturnPercent: number
  annualizedReturn: number
  bestDay: { date: string; return: number }
  worstDay: { date: string; return: number }
  volatility: number
  alpha: number // vs benchmark
  beta: number
}

const STORAGE_KEY = 'alpha-forge-portfolio-history'
const MAX_SNAPSHOTS = 90 // 90 days of history

// Save current portfolio snapshot
export function savePortfolioSnapshot(positions: Position[]): void {
  const totalValue = positions.reduce((sum, p) => 
    sum + (p.shares * (p.currentPrice || p.avgPrice)), 0
  )
  const totalCost = positions.reduce((sum, p) => 
    sum + (p.shares * p.avgPrice), 0
  )
  
  const snapshot: PortfolioSnapshot = {
    timestamp: Date.now(),
    date: new Date().toISOString().split('T')[0],
    totalValue,
    totalCost,
    positions: JSON.parse(JSON.stringify(positions)) // Deep copy
  }
  
  const history = getPortfolioHistory()
  
  // Check if we already have a snapshot for today
  const todayIndex = history.findIndex(h => h.date === snapshot.date)
  if (todayIndex >= 0) {
    history[todayIndex] = snapshot // Update today's snapshot
  } else {
    history.push(snapshot)
  }
  
  // Keep only last 90 days
  if (history.length > MAX_SNAPSHOTS) {
    history.shift()
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}

// Get portfolio history
export function getPortfolioHistory(): PortfolioSnapshot[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Get performance vs S&P 500 benchmark
export function getPerformanceMetrics(): PerformanceMetrics {
  const history = getPortfolioHistory()
  
  if (history.length < 2) {
    return {
      totalReturn: 0,
      totalReturnPercent: 0,
      annualizedReturn: 0,
      bestDay: { date: '-', return: 0 },
      worstDay: { date: '-', return: 0 },
      volatility: 0,
      alpha: 0,
      beta: 1
    }
  }
  
  const first = history[0]
  const last = history[history.length - 1]
  
  const totalReturn = last.totalValue - first.totalCost
  const totalReturnPercent = (totalReturn / first.totalCost) * 100
  
  // Calculate daily returns
  const dailyReturns: { date: string; return: number }[] = []
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]
    const curr = history[i]
    const dailyReturn = ((curr.totalValue - prev.totalValue) / prev.totalValue) * 100
    dailyReturns.push({ date: curr.date, return: dailyReturn })
  }
  
  // Best and worst days
  const sorted = [...dailyReturns].sort((a, b) => b.return - a.return)
  const bestDay = sorted[0] || { date: '-', return: 0 }
  const worstDay = sorted[sorted.length - 1] || { date: '-', return: 0 }
  
  // Volatility (standard deviation of daily returns)
  const avgReturn = dailyReturns.reduce((sum, d) => sum + d.return, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((sum, d) => sum + Math.pow(d.return - avgReturn, 2), 0) / dailyReturns.length
  const volatility = Math.sqrt(variance) * Math.sqrt(252) // Annualized
  
  // Days since first snapshot
  const days = (last.timestamp - first.timestamp) / (1000 * 60 * 60 * 24)
  const years = days / 365
  
  // Annualized return
  const annualizedReturn = years > 0 
    ? (Math.pow(1 + totalReturnPercent / 100, 1 / years) - 1) * 100
    : 0
  
  return {
    totalReturn,
    totalReturnPercent,
    annualizedReturn,
    bestDay,
    worstDay,
    volatility,
    alpha: totalReturnPercent - 10, // Simplified: vs 10% market return
    beta: 1 // Would need market correlation
  }
}

// Get chart data for portfolio vs benchmark
export function getChartData(): { date: string; portfolio: number; benchmark: number }[] {
  const history = getPortfolioHistory()
  
  if (history.length === 0) {
    // Generate 30 days of mock data if no history
    const data = []
    let portfolioValue = 100000
    let benchmarkValue = 100000
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      
      // Random daily returns
      const portfolioReturn = (Math.random() - 0.45) * 2 // Slight upward bias
      const benchmarkReturn = (Math.random() - 0.45) * 1.5
      
      portfolioValue *= (1 + portfolioReturn / 100)
      benchmarkValue *= (1 + benchmarkReturn / 100)
      
      data.push({
        date: date.toISOString().split('T')[0].slice(5), // MM-DD
        portfolio: Math.round(portfolioValue),
        benchmark: Math.round(benchmarkValue)
      })
    }
    
    return data
  }
  
  // Use real history
  const startValue = history[0].totalValue || 100000
  
  return history.map(h => {
    const date = new Date(h.timestamp)
    return {
      date: date.toISOString().split('T')[0].slice(5),
      portfolio: Math.round(h.totalValue),
      benchmark: Math.round(startValue * (1 + 0.10 * (h.timestamp - history[0].timestamp) / (365 * 24 * 60 * 60 * 1000))) // 10% annual benchmark
    }
  })
}

// Clear history (for testing)
export function clearPortfolioHistory(): void {
  localStorage.removeItem(STORAGE_KEY)
}