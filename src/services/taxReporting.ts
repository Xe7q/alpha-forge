// Tax Reporting & Analysis
import { Position } from '../App'

export interface TaxLot {
  id: string
  ticker: string
  shares: number
  purchaseDate: string
  purchasePrice: number
  currentPrice: number
}

export interface TaxReport {
  year: number
  shortTermGains: number
  shortTermLosses: number
  longTermGains: number
  longTermLosses: number
  netGain: number
  estimatedTax: number
  washSales: WashSale[]
  taxLossOpportunities: TaxLossOpportunity[]
}

export interface WashSale {
  ticker: string
  lossAmount: number
  dateSold: string
  disallowedAmount: number
  replacementShares: number
  replacementDate: string
}

export interface TaxLossOpportunity {
  ticker: string
  currentLoss: number
  daysHeld: number
  recommendation: 'harvest' | 'hold' | 'avoid'
  reasoning: string
}

const TAX_RATE_SHORT = 0.37 // 37% max short-term rate
const TAX_RATE_LONG = 0.20  // 20% long-term rate
const WASH_SALE_DAYS = 30

// Calculate realized gains/losses (requires transaction history)
// For now, using current positions to estimate unrealized gains
export function calculateUnrealizedGains(positions: Position[]): {
  shortTerm: { ticker: string; gain: number; shares: number }[]
  longTerm: { ticker: string; gain: number; shares: number }[]
  totalUnrealizedGain: number
} {
  const shortTerm: { ticker: string; gain: number; shares: number }[] = []
  const longTerm: { ticker: string; gain: number; shares: number }[] = []
  let totalGain = 0
  
  positions.forEach(pos => {
    if (!pos.currentPrice) return
    
    const gain = (pos.currentPrice - pos.avgPrice) * pos.shares
    totalGain += gain
    
    // Assume all positions held > 1 year for simplicity
    // In real app, would track purchase date
    if (gain !== 0) {
      longTerm.push({
        ticker: pos.ticker,
        gain,
        shares: pos.shares
      })
    }
  })
  
  return { shortTerm, longTerm, totalUnrealizedGain: totalGain }
}

// Detect wash sales
export function detectWashSales(positions: Position[], transactions: any[] = []): WashSale[] {
  // Mock implementation - would need full transaction history
  return []
}

// Find tax-loss harvesting opportunities
export function findTaxLossOpportunities(positions: Position[]): TaxLossOpportunity[] {
  const opportunities: TaxLossOpportunity[] = []
  
  positions.forEach(pos => {
    if (!pos.currentPrice) return
    
    const loss = (pos.avgPrice - pos.currentPrice) * pos.shares
    
    if (loss > 0) {
      // Mock days held - would come from actual purchase history
      const daysHeld = Math.floor(Math.random() * 365) + 30
      
      let recommendation: 'harvest' | 'hold' | 'avoid'
      let reasoning: string
      
      if (daysHeld < 30) {
        recommendation = 'avoid'
        reasoning = `Wait ${30 - daysHeld} more days to avoid wash sale rules`
      } else if (loss > 10000) {
        recommendation = 'harvest'
        reasoning = `Significant loss of $${loss.toFixed(0)} can offset gains`
      } else if (loss > 3000) {
        recommendation = 'harvest'
        reasoning = 'Moderate loss worth harvesting for tax benefit'
      } else {
        recommendation = 'hold'
        reasoning = 'Loss too small to justify transaction costs'
      }
      
      opportunities.push({
        ticker: pos.ticker,
        currentLoss: loss,
        daysHeld,
        recommendation,
        reasoning
      })
    }
  })
  
  return opportunities.sort((a, b) => b.currentLoss - a.currentLoss)
}

// Calculate estimated tax
export function calculateTaxEstimate(
  positions: Position[],
  otherIncome: number = 100000
): {
  unrealizedGains: number
  estimatedTaxIfSoldNow: number
  effectiveTaxRate: number
  potentialSavings: number
} {
  const { totalUnrealizedGain } = calculateUnrealizedGains(positions)
  
  // Simplified tax bracket calculation
  const totalIncome = otherIncome + totalUnrealizedGain
  let taxRate = TAX_RATE_LONG
  
  if (totalIncome > 500000) taxRate = 0.238 // 20% + 3.8% NIIT
  else if (totalIncome > 200000) taxRate = 0.20
  else if (totalIncome > 40000) taxRate = 0.15
  else taxRate = 0
  
  const estimatedTax = totalUnrealizedGain * taxRate
  
  // Calculate potential savings from tax loss harvesting
  const opportunities = findTaxLossOpportunities(positions)
  const harvestableLosses = opportunities
    .filter(o => o.recommendation === 'harvest')
    .reduce((sum, o) => sum + o.currentLoss, 0)
  
  return {
    unrealizedGains: totalUnrealizedGain,
    estimatedTaxIfSoldNow: estimatedTax,
    effectiveTaxRate: taxRate * 100,
    potentialSavings: harvestableLosses * taxRate
  }
}

// Generate tax report
export function generateTaxReport(year: number, positions: Position[]): TaxReport {
  const { shortTerm, longTerm } = calculateUnrealizedGains(positions)
  
  const shortTermGains = shortTerm.filter(g => g.gain > 0).reduce((sum, g) => sum + g.gain, 0)
  const shortTermLosses = shortTerm.filter(g => g.gain < 0).reduce((sum, g) => sum + Math.abs(g.gain), 0)
  const longTermGains = longTerm.filter(g => g.gain > 0).reduce((sum, g) => sum + g.gain, 0)
  const longTermLosses = longTerm.filter(g => g.gain < 0).reduce((sum, g) => sum + Math.abs(g.gain), 0)
  
  const netShortTerm = shortTermGains - shortTermLosses
  const netLongTerm = longTermGains - longTermLosses
  const netGain = netShortTerm + netLongTerm
  
  const estimatedTax = Math.max(0, netShortTerm) * TAX_RATE_SHORT + 
                       Math.max(0, netLongTerm) * TAX_RATE_LONG
  
  return {
    year,
    shortTermGains,
    shortTermLosses,
    longTermGains,
    longTermLosses,
    netGain,
    estimatedTax,
    washSales: detectWashSales(positions),
    taxLossOpportunities: findTaxLossOpportunities(positions)
  }
}

// Get tax summary for display
export function getTaxSummary(positions: Position[]) {
  const { totalUnrealizedGain } = calculateUnrealizedGains(positions)
  const estimate = calculateTaxEstimate(positions)
  const opportunities = findTaxLossOpportunities(positions)
  
  // Calculate potential savings from tax loss harvesting
  const harvestableLosses = opportunities.filter(o => o.recommendation === 'harvest')
  const totalHarvestableLoss = harvestableLosses.reduce((sum, o) => sum + o.currentLoss, 0)
  const potentialSavings = totalHarvestableLoss * estimate.effectiveTaxRate / 100

  return {
    unrealizedGain: totalUnrealizedGain,
    unrealizedGainFormatted: totalUnrealizedGain >= 0 
      ? `+$${totalUnrealizedGain.toLocaleString()}` 
      : `-$${Math.abs(totalUnrealizedGain).toLocaleString()}`,
    estimatedTax: estimate.estimatedTaxIfSoldNow,
    effectiveRate: estimate.effectiveTaxRate,
    potentialSavings,
    harvestableLosses,
    totalOpportunities: opportunities.length
  }
}