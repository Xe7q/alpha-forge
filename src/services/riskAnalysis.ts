// Risk Analysis Utilities
import { Position } from '../App'

export interface RiskMetrics {
  // Portfolio-level metrics
  portfolioBeta: number
  portfolioVolatility: number
  sharpeRatio: number
  maxDrawdown: number
  var95: number // Value at Risk (95% confidence)
  
  // Position-level metrics
  positionRisks: PositionRisk[]
  
  // Sector analysis
  sectorConcentration: SectorConcentration[]
  
  // Correlation matrix
  correlations: CorrelationMatrix
}

export interface PositionRisk {
  ticker: string
  weight: number // % of portfolio
  beta: number
  volatility: number
  contribution: number // Risk contribution to portfolio
}

export interface SectorConcentration {
  sector: string
  weight: number
  riskLevel: 'low' | 'moderate' | 'high' | 'extreme'
}

export interface CorrelationMatrix {
  tickers: string[]
  matrix: number[][] // -1 to 1
}

// Mock beta values for common stocks
const BETA_MAP: Record<string, number> = {
  'AAPL': 1.20,
  'MSFT': 0.90,
  'NVDA': 1.75,
  'TSLA': 2.00,
  'AMZN': 1.15,
  'GOOGL': 1.05,
  'META': 1.35,
  'NFLX': 1.25,
  'AMD': 1.85,
  'INTC': 0.85,
  'CRM': 1.10,
  'ORCL': 0.95,
  'JPM': 1.15,
  'BAC': 1.30,
  'V': 0.95,
  'MA': 0.90,
  'JNJ': 0.60,
  'PFE': 0.65,
  'UNH': 0.80,
  'XOM': 0.90,
  'CVX': 0.85,
  'KO': 0.55,
  'WMT': 0.45,
  'DIS': 1.10,
  'NKE': 0.85,
  'BTC': 1.50, // Crypto treated as high beta
  'ETH': 1.60,
  'SPY': 1.00, // Market beta
  'VOO': 1.00,
  'QQQ': 1.15,
}

// Calculate risk metrics
export function calculateRiskMetrics(positions: Position[]): RiskMetrics {
  if (positions.length === 0) {
    return {
      portfolioBeta: 0,
      portfolioVolatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      var95: 0,
      positionRisks: [],
      sectorConcentration: [],
      correlations: { tickers: [], matrix: [] }
    }
  }

  // Calculate portfolio value
  const totalValue = positions.reduce((sum, p) => 
    sum + (p.shares * (p.currentPrice || p.avgPrice)), 0
  )
  
  // Calculate position weights and risks
  const positionRisks: PositionRisk[] = positions.map(pos => {
    const positionValue = pos.shares * (pos.currentPrice || pos.avgPrice)
    const weight = (positionValue / totalValue) * 100
    const beta = BETA_MAP[pos.ticker] || 1.0
    const volatility = beta * 15 // Rough estimate: beta * market volatility
    
    return {
      ticker: pos.ticker,
      weight,
      beta,
      volatility,
      contribution: weight * beta / 100 // Contribution to portfolio beta
    }
  })
  
  // Portfolio beta (weighted average)
  const portfolioBeta = positionRisks.reduce((sum, pr) => 
    sum + pr.contribution, 0
  )
  
  // Estimated portfolio volatility
  const portfolioVolatility = portfolioBeta * 15 // Simplified calculation
  
  // Sharpe ratio estimate (assuming 2% risk-free rate)
  const estimatedReturn = portfolioBeta * 10 // Market return * beta
  const riskFreeRate = 2
  const sharpeRatio = portfolioVolatility > 0 
    ? (estimatedReturn - riskFreeRate) / portfolioVolatility 
    : 0
  
  // Value at Risk (95% confidence) - simplified
  const var95 = totalValue * (portfolioVolatility / 100) * 1.65
  
  // Max drawdown estimate
  const maxDrawdown = -portfolioVolatility * 1.5
  
  // Sector concentration
  const sectorMap = new Map<string, number>()
  positions.forEach(pos => {
    const value = pos.shares * (pos.currentPrice || pos.avgPrice)
    sectorMap.set(pos.sector, (sectorMap.get(pos.sector) || 0) + value)
  })
  
  const sectorConcentration: SectorConcentration[] = Array.from(sectorMap.entries())
    .map(([sector, value]) => {
      const weight = (value / totalValue) * 100
      let riskLevel: 'low' | 'moderate' | 'high' | 'extreme'
      if (weight > 60) riskLevel = 'extreme'
      else if (weight > 40) riskLevel = 'high'
      else if (weight > 25) riskLevel = 'moderate'
      else riskLevel = 'low'
      
      return { sector, weight, riskLevel }
    })
    .sort((a, b) => b.weight - a.weight)
  
  // Mock correlation matrix
  const tickers = positions.map(p => p.ticker)
  const matrix = tickers.map((t1, i) => 
    tickers.map((t2, j) => {
      if (i === j) return 1.0
      // Simple correlation based on sector
      const s1 = positions.find(p => p.ticker === t1)?.sector
      const s2 = positions.find(p => p.ticker === t2)?.sector
      if (s1 === s2) return 0.7 + Math.random() * 0.2
      return 0.3 + Math.random() * 0.3
    })
  )
  
  return {
    portfolioBeta,
    portfolioVolatility,
    sharpeRatio,
    maxDrawdown,
    var95,
    positionRisks,
    sectorConcentration,
    correlations: { tickers, matrix }
  }
}

// Get risk level color
export function getRiskLevelColor(level: string): string {
  switch (level) {
    case 'low': return 'text-hf-green'
    case 'moderate': return 'text-hf-gold'
    case 'high': return 'text-orange-500'
    case 'extreme': return 'text-hf-red'
    default: return 'text-gray-400'
  }
}

// Get risk level bg color
export function getRiskLevelBg(level: string): string {
  switch (level) {
    case 'low': return 'bg-hf-green/20'
    case 'moderate': return 'bg-hf-gold/20'
    case 'high': return 'bg-orange-500/20'
    case 'extreme': return 'bg-hf-red/20'
    default: return 'bg-gray-500/20'
  }
}