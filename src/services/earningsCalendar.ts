// Earnings Calendar Service
import { Position } from '../App'

export interface EarningsEvent {
  ticker: string
  companyName: string
  reportDate: string
  reportTime: 'before' | 'after' | 'during'
  epsEstimate: number
  revenueEstimate: number
  epsActual?: number
  revenueActual?: number
  surprise?: number // % surprise vs estimate
  historicalBeatRate: number // % of time they beat estimates
}

export interface EarningsSummary {
  thisWeek: EarningsEvent[]
  nextWeek: EarningsEvent[]
  thisMonth: EarningsEvent[]
  totalUpcoming: number
  highImpactEvents: EarningsEvent[]
}

// Mock earnings data
const EARNINGS_DATA: Record<string, Partial<EarningsEvent>> = {
  'AAPL': { companyName: 'Apple Inc.', epsEstimate: 2.10, revenueEstimate: 119_000_000_000, historicalBeatRate: 72 },
  'MSFT': { companyName: 'Microsoft Corp.', epsEstimate: 3.15, revenueEstimate: 66_000_000_000, historicalBeatRate: 78 },
  'NVDA': { companyName: 'NVIDIA Corp.', epsEstimate: 4.55, revenueEstimate: 28_000_000_000, historicalBeatRate: 85 },
  'TSLA': { companyName: 'Tesla Inc.', epsEstimate: 0.85, revenueEstimate: 26_000_000_000, historicalBeatRate: 55 },
  'AMZN': { companyName: 'Amazon.com Inc.', epsEstimate: 1.45, revenueEstimate: 166_000_000_000, historicalBeatRate: 65 },
  'GOOGL': { companyName: 'Alphabet Inc.', epsEstimate: 1.85, revenueEstimate: 86_000_000_000, historicalBeatRate: 70 },
  'META': { companyName: 'Meta Platforms', epsEstimate: 5.25, revenueEstimate: 46_000_000_000, historicalBeatRate: 68 },
  'NFLX': { companyName: 'Netflix Inc.', epsEstimate: 4.75, revenueEstimate: 10_000_000_000, historicalBeatRate: 62 },
  'AMD': { companyName: 'Advanced Micro Devices', epsEstimate: 0.95, revenueEstimate: 7_500_000_000, historicalBeatRate: 75 },
  'INTC': { companyName: 'Intel Corp.', epsEstimate: 0.12, revenueEstimate: 14_000_000_000, historicalBeatRate: 45 },
  'CRM': { companyName: 'Salesforce Inc.', epsEstimate: 2.65, revenueEstimate: 9_800_000_000, historicalBeatRate: 73 },
  'ORCL': { companyName: 'Oracle Corp.', epsEstimate: 1.45, revenueEstimate: 14_500_000_000, historicalBeatRate: 68 },
  'JPM': { companyName: 'JPMorgan Chase', epsEstimate: 4.85, revenueEstimate: 43_000_000_000, historicalBeatRate: 80 },
  'BAC': { companyName: 'Bank of America', epsEstimate: 0.82, revenueEstimate: 25_500_000_000, historicalBeatRate: 75 },
  'V': { companyName: 'Visa Inc.', epsEstimate: 2.65, revenueEstimate: 9_500_000_000, historicalBeatRate: 82 },
  'MA': { companyName: 'Mastercard Inc.', epsEstimate: 3.45, revenueEstimate: 7_200_000_000, historicalBeatRate: 85 },
  'JNJ': { companyName: 'Johnson & Johnson', epsEstimate: 2.75, revenueEstimate: 22_000_000_000, historicalBeatRate: 70 },
  'PFE': { companyName: 'Pfizer Inc.', epsEstimate: 0.65, revenueEstimate: 15_000_000_000, historicalBeatRate: 60 },
  'XOM': { companyName: 'Exxon Mobil', epsEstimate: 2.15, revenueEstimate: 95_000_000_000, historicalBeatRate: 72 },
  'CVX': { companyName: 'Chevron Corp.', epsEstimate: 3.25, revenueEstimate: 52_000_000_000, historicalBeatRate: 74 },
  'KO': { companyName: 'Coca-Cola', epsEstimate: 0.72, revenueEstimate: 11_500_000_000, historicalBeatRate: 78 },
  'WMT': { companyName: 'Walmart Inc.', epsEstimate: 1.65, revenueEstimate: 176_000_000_000, historicalBeatRate: 71 },
  'DIS': { companyName: 'Walt Disney', epsEstimate: 1.25, revenueEstimate: 24_500_000_000, historicalBeatRate: 58 },
  'NKE': { companyName: 'Nike Inc.', epsEstimate: 0.85, revenueEstimate: 13_000_000_000, historicalBeatRate: 76 },
  'UBER': { companyName: 'Uber Technologies', epsEstimate: 0.45, revenueEstimate: 11_500_000_000, historicalBeatRate: 48 },
  'ABNB': { companyName: 'Airbnb Inc.', epsEstimate: 1.15, revenueEstimate: 2_800_000_000, historicalBeatRate: 55 },
}

// Generate realistic earnings dates
function generateEarningsDate(ticker: string): { date: string; time: 'before' | 'after' | 'during' } {
  const today = new Date()
  const hash = ticker.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
  
  // Most companies report on specific weeks
  const earningsWeeks = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34, 37, 40, 43, 46, 49, 52]
  const currentWeek = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
  
  // Find next earnings week
  let nextWeek = earningsWeeks.find(w => w > currentWeek)
  if (!nextWeek) nextWeek = earningsWeeks[0] + 52 // Next year
  
  // Generate date in that week
  const year = nextWeek > 52 ? today.getFullYear() + 1 : today.getFullYear()
  const weekOfYear = nextWeek > 52 ? nextWeek - 52 : nextWeek
  const date = new Date(year, 0, 1 + (weekOfYear - 1) * 7 + (hash % 5))
  
  // Report time based on ticker hash
  const times: ('before' | 'after' | 'during')[] = ['before', 'after', 'during']
  const time = times[hash % 3]
  
  return { date: date.toISOString().split('T')[0], time }
}

// Get earnings calendar for portfolio
export function getEarningsCalendar(positions: Position[]): EarningsSummary {
  const today = new Date()
  const oneWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  const twoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
  const oneMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  
  const allEvents: EarningsEvent[] = []
  
  positions.forEach(pos => {
    const earningsData = EARNINGS_DATA[pos.ticker]
    if (!earningsData) return
    
    const { date, time } = generateEarningsDate(pos.ticker)
    
    allEvents.push({
      ticker: pos.ticker,
      companyName: earningsData.companyName || pos.name,
      reportDate: date,
      reportTime: time,
      epsEstimate: earningsData.epsEstimate || 0,
      revenueEstimate: earningsData.revenueEstimate || 0,
      historicalBeatRate: earningsData.historicalBeatRate || 50
    })
  })
  
  // Sort by date
  allEvents.sort((a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime())
  
  // Categorize
  const thisWeek = allEvents.filter(e => new Date(e.reportDate) <= oneWeek)
  const nextWeek = allEvents.filter(e => {
    const date = new Date(e.reportDate)
    return date > oneWeek && date <= twoWeeks
  })
  const thisMonth = allEvents.filter(e => new Date(e.reportDate) <= oneMonth)
  
  // High impact = reporting this week with high beat rate or popular stocks
  const highImpactEvents = thisWeek.filter(e => 
    e.historicalBeatRate > 75 || 
    ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META'].includes(e.ticker)
  )
  
  return {
    thisWeek,
    nextWeek,
    thisMonth,
    totalUpcoming: allEvents.length,
    highImpactEvents
  }
}

// Get next earnings date for a ticker
export function getNextEarningsDate(ticker: string): EarningsEvent | null {
  const data = EARNINGS_DATA[ticker]
  if (!data) return null
  
  const { date, time } = generateEarningsDate(ticker)
  
  return {
    ticker,
    companyName: data.companyName || ticker,
    reportDate: date,
    reportTime: time,
    epsEstimate: data.epsEstimate || 0,
    revenueEstimate: data.revenueEstimate || 0,
    historicalBeatRate: data.historicalBeatRate || 50
  }
}

// Get earnings impact badge color
export function getEarningsImpactColor(beatRate: number): string {
  if (beatRate >= 80) return 'text-hf-green'
  if (beatRate >= 65) return 'text-hf-gold'
  if (beatRate >= 50) return 'text-gray-400'
  return 'text-hf-red'
}

// Get earnings time badge
export function getEarningsTimeLabel(time: 'before' | 'after' | 'during'): string {
  switch (time) {
    case 'before': return 'Pre-Market'
    case 'after': return 'After Hours'
    case 'during': return 'During Market'
  }
}