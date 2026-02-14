// AI Advisor Service - Portfolio Analysis & Recommendations
import { Position } from '../App'
import { calculateRiskMetrics } from './riskAnalysis'

export interface AIRecommendation {
  type: 'buy' | 'sell' | 'hold' | 'rebalance' | 'alert'
  ticker: string
  confidence: number // 0-100
  reasoning: string
  action: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
}

export interface PortfolioAnalysis {
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  healthScore: number // 0-100
  strengths: string[]
  weaknesses: string[]
  recommendations: AIRecommendation[]
  scenarioAnalysis: ScenarioResult[]
}

export interface ScenarioResult {
  name: string
  description: string
  portfolioValue: number
  change: number
  changePercent: number
}

// Main AI analysis function
export function analyzePortfolio(positions: Position[]): PortfolioAnalysis {
  if (positions.length === 0) {
    return {
      overallHealth: 'critical',
      healthScore: 0,
      strengths: [],
      weaknesses: ['Portfolio is empty'],
      recommendations: [{
        type: 'alert',
        ticker: 'PORTFOLIO',
        confidence: 100,
        reasoning: 'No positions found. Start by adding stocks to your portfolio.',
        action: 'Add at least 5-10 diversified positions',
        urgency: 'high'
      }],
      scenarioAnalysis: []
    }
  }
  
  const riskMetrics = calculateRiskMetrics(positions)
  const recommendations: AIRecommendation[] = []
  const strengths: string[] = []
  const weaknesses: string[] = []
  
  // Calculate portfolio value
  const totalValue = positions.reduce((sum, p) => 
    sum + (p.shares * (p.currentPrice || p.avgPrice)), 0
  )
  
  // 1. Check diversification
  const sectorCount = riskMetrics.sectorConcentration.length
  const topSector = riskMetrics.sectorConcentration[0]
  
  if (sectorCount < 3) {
    weaknesses.push('Poor sector diversification')
    recommendations.push({
      type: 'rebalance',
      ticker: 'PORTFOLIO',
      confidence: 90,
      reasoning: `Only ${sectorCount} sectors represented. Consider adding positions in Healthcare, Energy, or Consumer sectors.`,
      action: 'Add 2-3 positions in underrepresented sectors',
      urgency: 'high'
    })
  } else {
    strengths.push('Good sector diversification')
  }
  
  if (topSector && topSector.weight > 50) {
    weaknesses.push(`Heavy concentration in ${topSector.sector} (${topSector.weight.toFixed(1)}%)`)
    recommendations.push({
      type: 'rebalance',
      ticker: topSector.sector,
      confidence: 85,
      reasoning: `${topSector.weight.toFixed(1)}% in one sector increases vulnerability to sector-specific downturns.`,
      action: `Reduce ${topSector.sector} exposure to under 40%`,
      urgency: 'medium'
    })
  }
  
  // 2. Check position sizing
  const largePositions = riskMetrics.positionRisks.filter(p => p.weight > 20)
  largePositions.forEach(pos => {
    weaknesses.push(`Oversized position: ${pos.ticker} (${pos.weight.toFixed(1)}%)`)
    recommendations.push({
      type: 'rebalance',
      ticker: pos.ticker,
      confidence: 80,
      reasoning: `Position exceeds 20% of portfolio. Consider trimming to reduce concentration risk.`,
      action: `Trim ${pos.ticker} to 15% or less of portfolio`,
      urgency: 'medium'
    })
  })
  
  // 3. Check beta/risk
  if (riskMetrics.portfolioBeta > 1.3) {
    weaknesses.push('High portfolio beta increases volatility')
    recommendations.push({
      type: 'rebalance',
      ticker: 'PORTFOLIO',
      confidence: 75,
      reasoning: `Beta of ${riskMetrics.portfolioBeta.toFixed(2)} means portfolio moves ${(riskMetrics.portfolioBeta * 100 - 100).toFixed(0)}% more than market.`,
      action: 'Add low-beta defensive stocks (utilities, consumer staples)',
      urgency: 'medium'
    })
  } else if (riskMetrics.portfolioBeta < 0.8) {
    strengths.push('Defensive portfolio with low market correlation')
  }
  
  // 4. Check individual positions for buy/sell signals
  positions.forEach(pos => {
    if (!pos.currentPrice) return
    
    const pnl = ((pos.currentPrice - pos.avgPrice) / pos.avgPrice) * 100
    
    // Take profits on big winners
    if (pnl > 50) {
      recommendations.push({
        type: 'sell',
        ticker: pos.ticker,
        confidence: 70,
        reasoning: `Up ${pnl.toFixed(1)}%. Consider taking partial profits to lock in gains.`,
        action: `Sell 25-50% of ${pos.ticker} position`,
        urgency: 'low'
      })
    }
    
    // Stop loss on big losers
    if (pnl < -30) {
      weaknesses.push(`${pos.ticker} showing significant losses`)
      recommendations.push({
        type: 'sell',
        ticker: pos.ticker,
        confidence: 75,
        reasoning: `Down ${Math.abs(pnl).toFixed(1)}%. Consider cutting losses or averaging down if thesis still valid.`,
        action: `Review ${pos.ticker} thesis - hold or cut losses`,
        urgency: 'high'
      })
    }
  })
  
  // 5. Health score calculation
  let healthScore = 70 // Base score
  healthScore += strengths.length * 5
  healthScore -= weaknesses.length * 8
  healthScore -= (riskMetrics.portfolioBeta - 1) * 10
  healthScore = Math.max(0, Math.min(100, healthScore))
  
  let overallHealth: PortfolioAnalysis['overallHealth']
  if (healthScore >= 80) overallHealth = 'excellent'
  else if (healthScore >= 65) overallHealth = 'good'
  else if (healthScore >= 50) overallHealth = 'fair'
  else if (healthScore >= 30) overallHealth = 'poor'
  else overallHealth = 'critical'
  
  // 6. Scenario analysis
  const scenarioAnalysis = runScenarioAnalysis(positions, totalValue)
  
  // Sort recommendations by urgency
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
  
  return {
    overallHealth,
    healthScore,
    strengths,
    weaknesses,
    recommendations,
    scenarioAnalysis
  }
}

// Run "What If" scenarios
function runScenarioAnalysis(positions: Position[], currentValue: number): ScenarioResult[] {
  const scenarios: ScenarioResult[] = []
  
  // Bull market scenario (+20%)
  scenarios.push({
    name: 'Bull Market',
    description: 'Market rallies 20% over next 12 months',
    portfolioValue: currentValue * 1.20,
    change: currentValue * 0.20,
    changePercent: 20
  })
  
  // Bear market scenario (-20%)
  scenarios.push({
    name: 'Bear Market',
    description: 'Market declines 20% over next 12 months',
    portfolioValue: currentValue * 0.80,
    change: -currentValue * 0.20,
    changePercent: -20
  })
  
  // Recession scenario (-35%)
  scenarios.push({
    name: 'Recession',
    description: 'Severe downturn, market drops 35%',
    portfolioValue: currentValue * 0.65,
    change: -currentValue * 0.35,
    changePercent: -35
  })
  
  // Tech boom scenario (+40% tech stocks)
  const techValue = positions
    .filter(p => p.sector === 'Technology')
    .reduce((sum, p) => sum + (p.shares * (p.currentPrice || p.avgPrice)), 0)
  const techWeight = techValue / currentValue
  const techBoomChange = techValue * 0.40
  
  scenarios.push({
    name: 'AI/Tech Boom',
    description: 'Technology sector surges 40%',
    portfolioValue: currentValue + techBoomChange,
    change: techBoomChange,
    changePercent: (techBoomChange / currentValue) * 100
  })
  
  return scenarios
}

// Generate personalized investment advice
export function getInvestmentAdvice(
  positions: Position[],
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
): string {
  const analysis = analyzePortfolio(positions)
  
  let advice = `Portfolio Health: ${analysis.overallHealth.toUpperCase()} (${analysis.healthScore}/100)\n\n`
  
  if (analysis.strengths.length > 0) {
    advice += `✅ Strengths:\n${analysis.strengths.map(s => `  • ${s}`).join('\n')}\n\n`
  }
  
  if (analysis.weaknesses.length > 0) {
    advice += `⚠️ Areas to Improve:\n${analysis.weaknesses.map(w => `  • ${w}`).join('\n')}\n\n`
  }
  
  advice += `📋 Top Recommendations:\n`
  analysis.recommendations
    .slice(0, 3)
    .forEach((rec, i) => {
      advice += `${i + 1}. [${rec.urgency.toUpperCase()}] ${rec.type.toUpperCase()} ${rec.ticker}\n`
      advice += `   ${rec.reasoning}\n`
      advice += `   → ${rec.action}\n\n`
    })
  
  // Risk tolerance specific advice
  advice += `🎯 For ${riskTolerance} investors:\n`
  switch (riskTolerance) {
    case 'conservative':
      advice += `  • Consider increasing bond/ETF allocation to 30-40%\n`
      advice += `  • Focus on dividend-paying stocks\n`
      advice += `  • Avoid high-beta (>1.5) positions\n`
      break
    case 'moderate':
      advice += `  • Maintain 60-70% stocks, 30-40% bonds/stable assets\n`
      advice += `  • Diversify across 15-20 positions\n`
      advice += `  • Rebalance quarterly\n`
      break
    case 'aggressive':
      advice += `  • Growth stocks and emerging sectors\n`
      advice += `  • Consider 10-15% in crypto/speculative\n`
      advice += `  • High conviction concentrated bets OK\n`
      break
  }
  
  return advice
}