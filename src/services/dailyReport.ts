// Daily Portfolio Report Generator
// This script generates and sends daily portfolio summaries via Telegram

import { getStockPrice, getCryptoPrice } from '../services/alphaVantage'

interface Position {
  ticker: string
  shares: number
  avgPrice: number
  currentPrice: number
  type: 'stock' | 'crypto' | 'etf' | 'bond'
}

// User's portfolio - this should match the dashboard
const PORTFOLIO: Position[] = [
  { ticker: 'AAPL', shares: 100, avgPrice: 175.50, currentPrice: 185.25, type: 'stock' },
  { ticker: 'MSFT', shares: 50, avgPrice: 380.00, currentPrice: 412.75, type: 'stock' },
  { ticker: 'NVDA', shares: 25, avgPrice: 480.00, currentPrice: 725.50, type: 'stock' },
  { ticker: 'BTC', shares: 0.5, avgPrice: 42000, currentPrice: 51250, type: 'crypto' },
  { ticker: 'SPY', shares: 200, avgPrice: 445.00, currentPrice: 478.25, type: 'etf' },
]

// Fetch latest prices for all positions
async function fetchPortfolioPrices(): Promise<Position[]> {
  const updated = [...PORTFOLIO]
  
  for (let i = 0; i < updated.length; i++) {
    const pos = updated[i]
    if (pos.type === 'crypto') {
      const data = await getCryptoPrice(pos.ticker)
      if (data) updated[i] = { ...pos, currentPrice: data.price }
    } else {
      const data = await getStockPrice(pos.ticker)
      if (data) updated[i] = { ...pos, currentPrice: data.price }
    }
    // Rate limit
    if (i < updated.length - 1) await new Promise(r => setTimeout(r, 12000))
  }
  
  return updated
}

// Generate portfolio summary
async function generateReport(): Promise<string> {
  const positions = await fetchPortfolioPrices()
  
  const totalValue = positions.reduce((sum, p) => sum + (p.shares * p.currentPrice), 0)
  const totalCost = positions.reduce((sum, p) => sum + (p.shares * p.avgPrice), 0)
  const totalPnL = totalValue - totalCost
  const totalPnLPercent = (totalPnL / totalCost) * 100
  
  const date = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  })
  
  let report = `📊 **DAILY PORTFOLIO REPORT**\n`
  report += `${date}\n`
  report += `━`.repeat(30) + `\n\n`
  
  report += `💰 **Total Value:** $${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2})}\n`
  report += `📈 **Total P&L:** ${totalPnL >= 0 ? '+' : ''}$${Math.abs(totalPnL).toLocaleString('en-US', {minimumFractionDigits: 2})} (${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}%)\n\n`
  
  report += `**POSITIONS:**\n`
  positions.forEach(p => {
    const value = p.shares * p.currentPrice
    const cost = p.shares * p.avgPrice
    const pnl = value - cost
    const pnlPct = (pnl / cost) * 100
    const emoji = pnl >= 0 ? '🟢' : '🔴'
    report += `${emoji} **${p.ticker}**: $${p.currentPrice.toFixed(2)} | P&L: ${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%\n`
  })
  
  report += `\n**🔔 ACTIVE ALERTS:**\n`
  report += `• Lovable IPO monitoring: ACTIVE\n`
  report += `• Price alerts: Check dashboard\n\n`
  
  report += `Open dashboard: http://localhost:5173`
  
  return report
}

// News summary (mock - would integrate with real news API)
async function generateNewsReport(): Promise<string> {
  let report = `📰 **MARKET INTELLIGENCE**\n`
  report += `━`.repeat(30) + `\n\n`
  
  report += `**🔴 HIGH IMPACT (8-10):**\n`
  report += `• Fed Signals Potential Rate Cuts in Q3\n`
  report += `• NVDA Announces Next-Gen AI Chips\n\n`
  
  report += `**🟡 MODERATE IMPACT (5-7):**\n`
  report += `• Tech Sector Faces Regulatory Pressure\n`
  report += `• Bitcoin ETF Inflows Reach Record High\n\n`
  
  report += `**🎯 PRIORITY WATCH:**\n`
  report += `• Lovable IPO: No updates\n`
  
  return report
}

// Main function to generate full report
export async function generateDailyReport(): Promise<{ portfolio: string; news: string }> {
  return {
    portfolio: await generateReport(),
    news: await generateNewsReport()
  }
}

// For testing
if (import.meta.main) {
  generateDailyReport().then(report => {
    console.log(report.portfolio)
    console.log('\n' + report.news)
  })
}