// Multi-Portfolio Management
import { Position } from '../App'

export interface Portfolio {
  id: string
  name: string
  type: 'taxable' | 'ira' | 'roth' | 'crypto' | '401k'
  positions: Position[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'alpha-forge-portfolios'

// Get all portfolios
export function getAllPortfolios(): Portfolio[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : [createDefaultPortfolio()]
  } catch {
    return [createDefaultPortfolio()]
  }
}

// Create default portfolio
function createDefaultPortfolio(): Portfolio {
  return {
    id: 'default',
    name: 'Main Portfolio',
    type: 'taxable',
    positions: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

// Get active portfolio ID
export function getActivePortfolioId(): string {
  try {
    return localStorage.getItem('alpha-forge-active-portfolio') || 'default'
  } catch {
    return 'default'
  }
}

// Set active portfolio
export function setActivePortfolioId(id: string): void {
  localStorage.setItem('alpha-forge-active-portfolio', id)
}

// Get portfolio by ID
export function getPortfolio(id: string): Portfolio | null {
  const portfolios = getAllPortfolios()
  return portfolios.find(p => p.id === id) || null
}

// Create new portfolio
export function createPortfolio(name: string, type: Portfolio['type']): Portfolio {
  const portfolio: Portfolio = {
    id: `portfolio-${Date.now()}`,
    name,
    type,
    positions: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  
  const portfolios = getAllPortfolios()
  portfolios.push(portfolio)
  savePortfolios(portfolios)
  
  return portfolio
}

// Update portfolio
export function updatePortfolio(id: string, updates: Partial<Portfolio>): Portfolio | null {
  const portfolios = getAllPortfolios()
  const index = portfolios.findIndex(p => p.id === id)
  
  if (index === -1) return null
  
  portfolios[index] = {
    ...portfolios[index],
    ...updates,
    updatedAt: Date.now()
  }
  
  savePortfolios(portfolios)
  return portfolios[index]
}

// Delete portfolio
export function deletePortfolio(id: string): boolean {
  const portfolios = getAllPortfolios()
  const filtered = portfolios.filter(p => p.id !== id)
  
  if (filtered.length === portfolios.length) return false
  
  savePortfolios(filtered)
  
  // Switch to another portfolio if deleted one was active
  if (getActivePortfolioId() === id) {
    setActivePortfolioId(filtered[0]?.id || 'default')
  }
  
  return true
}

// Save portfolios to localStorage
function savePortfolios(portfolios: Portfolio[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolios))
}

// Get combined view of all portfolios
export function getCombinedPortfolio(): Portfolio {
  const portfolios = getAllPortfolios()
  
  const combinedPositions: Position[] = []
  const positionMap = new Map<string, Position>()
  
  portfolios.forEach(portfolio => {
    portfolio.positions.forEach(pos => {
      const key = pos.ticker
      if (positionMap.has(key)) {
        const existing = positionMap.get(key)!
        const totalShares = existing.shares + pos.shares
        const totalCost = (existing.shares * existing.avgPrice) + (pos.shares * pos.avgPrice)
        positionMap.set(key, {
          ...existing,
          shares: totalShares,
          avgPrice: totalCost / totalShares,
          currentPrice: pos.currentPrice || existing.currentPrice
        })
      } else {
        positionMap.set(key, { ...pos, id: `combined-${pos.ticker}` })
      }
    })
  })
  
  return {
    id: 'combined',
    name: 'All Portfolios (Combined)',
    type: 'taxable',
    positions: Array.from(positionMap.values()),
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

// Get portfolio type label
export function getPortfolioTypeLabel(type: Portfolio['type']): string {
  const labels: Record<string, string> = {
    taxable: 'Taxable Account',
    ira: 'Traditional IRA',
    roth: 'Roth IRA',
    crypto: 'Crypto Wallet',
    '401k': '401(k)'
  }
  return labels[type] || type
}

// Get portfolio type color
export function getPortfolioTypeColor(type: Portfolio['type']): string {
  const colors: Record<string, string> = {
    taxable: 'bg-hf-blue',
    ira: 'bg-hf-green',
    roth: 'bg-purple-500',
    crypto: 'bg-orange-500',
    '401k': 'bg-hf-gold'
  }
  return colors[type] || 'bg-gray-500'
}