// Dividend Tracking Service
import { Position } from '../App'

export interface DividendEvent {
  ticker: string
  exDate: string
  payDate: string
  amount: number
  yield: number
  frequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual'
}

export interface DividendSummary {
  annualIncome: number
  monthlyAverage: number
  portfolioYield: number
  yieldOnCost: number
  upcomingEvents: DividendEvent[]
  recentPayments: DividendEvent[]
}

// Mock dividend data for popular stocks
const DIVIDEND_DATA: Record<string, Partial<DividendEvent>> = {
  'AAPL': { amount: 0.25, frequency: 'quarterly', yield: 0.5 },
  'MSFT': { amount: 0.75, frequency: 'quarterly', yield: 0.7 },
  'JNJ': { amount: 1.24, frequency: 'quarterly', yield: 2.9 },
  'KO': { amount: 0.48, frequency: 'quarterly', yield: 3.1 },
  'WMT': { amount: 0.83, frequency: 'quarterly', yield: 1.4 },
  'XOM': { amount: 0.95, frequency: 'quarterly', yield: 3.2 },
  'CVX': { amount: 1.63, frequency: 'quarterly', yield: 4.1 },
  'JPM': { amount: 1.25, frequency: 'quarterly', yield: 2.4 },
  'BAC': { amount: 0.26, frequency: 'quarterly', yield: 2.5 },
  'V': { amount: 0.62, frequency: 'quarterly', yield: 0.7 },
  'MA': { amount: 0.66, frequency: 'quarterly', yield: 0.5 },
  'PFE': { amount: 0.42, frequency: 'quarterly', yield: 5.9 },
  'T': { amount: 0.28, frequency: 'quarterly', yield: 6.5 },
  'VZ': { amount: 0.67, frequency: 'quarterly', yield: 6.8 },
  'SPY': { amount: 1.58, frequency: 'quarterly', yield: 1.3 },
  'VOO': { amount: 1.54, frequency: 'quarterly', yield: 1.3 },
  'QQQ': { amount: 0.54, frequency: 'quarterly', yield: 0.6 },
  'SCHD': { amount: 0.65, frequency: 'quarterly', yield: 3.4 },
  'VYM': { amount: 0.85, frequency: 'quarterly', yield: 2.9 },
}

// Generate upcoming dividend dates
function generateDividendDates(ticker: string): { exDate: string; payDate: string } {
  const today = new Date()
  const data = DIVIDEND_DATA[ticker]
  const frequency = data?.frequency || 'quarterly'
  
  // Base ex-date pattern based on ticker hash
  const hash = ticker.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
  const baseDay = (hash % 28) + 1
  
  let months: number[]
  switch (frequency) {
    case 'monthly':
      months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      break
    case 'quarterly':
      months = [2, 5, 8, 11] // Mar, Jun, Sep, Dec
      break
    case 'semi-annual':
      months = [5, 11] // Jun, Dec
      break
    default:
      months = [11] // Dec
  }
  
  // Find next ex-dividend date
  let nextExDate: Date | null = null
  for (const month of months) {
    const candidate = new Date(today.getFullYear(), month, baseDay)
    if (candidate > today) {
      nextExDate = candidate
      break
    }
  }
  
  // If no date this year, use first month of next year
  if (!nextExDate) {
    nextExDate = new Date(today.getFullYear() + 1, months[0], baseDay)
  }
  
  // Pay date is typically 2-4 weeks after ex-date
  const payDate = new Date(nextExDate)
  payDate.setDate(payDate.getDate() + 21)
  
  return {
    exDate: nextExDate.toISOString().split('T')[0],
    payDate: payDate.toISOString().split('T')[0]
  }
}

// Get dividend summary for portfolio
export function getDividendSummary(positions: Position[]): DividendSummary {
  let annualIncome = 0
  let totalCost = 0
  let totalValue = 0
  const upcomingEvents: DividendEvent[] = []
  const recentPayments: DividendEvent[] = []
  
  const today = new Date()
  
  positions.forEach(pos => {
    const divData = DIVIDEND_DATA[pos.ticker]
    if (!divData) return
    
    const positionValue = pos.shares * (pos.currentPrice || pos.avgPrice)
    const positionCost = pos.shares * pos.avgPrice
    
    totalValue += positionValue
    totalCost += positionCost
    
    // Calculate annual income
    const frequency = divData.frequency || 'quarterly'
    const paymentsPerYear = frequency === 'monthly' ? 12 : 
                            frequency === 'quarterly' ? 4 : 
                            frequency === 'semi-annual' ? 2 : 1
    
    const annualDividend = (divData.amount || 0) * paymentsPerYear * pos.shares
    annualIncome += annualDividend
    
    // Generate upcoming event
    const dates = generateDividendDates(pos.ticker)
    upcomingEvents.push({
      ticker: pos.ticker,
      exDate: dates.exDate,
      payDate: dates.payDate,
      amount: divData.amount || 0,
      yield: divData.yield || 0,
      frequency
    })
    
    // Generate recent payment (for display)
    const recentExDate = new Date(dates.exDate)
    recentExDate.setMonth(recentExDate.getMonth() - (12 / paymentsPerYear))
    const recentPayDate = new Date(dates.payDate)
    recentPayDate.setMonth(recentPayDate.getMonth() - (12 / paymentsPerYear))
    
    if (recentPayDate < today) {
      recentPayments.push({
        ticker: pos.ticker,
        exDate: recentExDate.toISOString().split('T')[0],
        payDate: recentPayDate.toISOString().split('T')[0],
        amount: divData.amount || 0,
        yield: divData.yield || 0,
        frequency
      })
    }
  })
  
  // Sort upcoming by date
  upcomingEvents.sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime())
  recentPayments.sort((a, b) => new Date(b.payDate).getTime() - new Date(a.payDate).getTime())
  
  return {
    annualIncome,
    monthlyAverage: annualIncome / 12,
    portfolioYield: totalValue > 0 ? (annualIncome / totalValue) * 100 : 0,
    yieldOnCost: totalCost > 0 ? (annualIncome / totalCost) * 100 : 0,
    upcomingEvents: upcomingEvents.slice(0, 10),
    recentPayments: recentPayments.slice(0, 5)
  }
}

// Get dividend calendar for next 3 months
export function getDividendCalendar(positions: Position[]): DividendEvent[] {
  const events: DividendEvent[] = []
  
  positions.forEach(pos => {
    const divData = DIVIDEND_DATA[pos.ticker]
    if (!divData) return
    
    const dates = generateDividendDates(pos.ticker)
    const frequency = divData.frequency || 'quarterly'
    
    // Generate next 2 occurrences
    for (let i = 0; i < 2; i++) {
      const exDate = new Date(dates.exDate)
      const payDate = new Date(dates.payDate)
      
      if (i > 0) {
        const monthsToAdd = frequency === 'monthly' ? 1 : 
                           frequency === 'quarterly' ? 3 : 
                           frequency === 'semi-annual' ? 6 : 12
        exDate.setMonth(exDate.getMonth() + (monthsToAdd * i))
        payDate.setMonth(payDate.getMonth() + (monthsToAdd * i))
      }
      
      events.push({
        ticker: pos.ticker,
        exDate: exDate.toISOString().split('T')[0],
        payDate: payDate.toISOString().split('T')[0],
        amount: divData.amount || 0,
        yield: divData.yield || 0,
        frequency
      })
    }
  })
  
  return events.sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime())
}