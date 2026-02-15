// CSV Import/Export Service
import { Position } from '../App'

export interface CsvPosition {
  ticker: string
  name: string
  shares: number
  avgPrice: number
  sector: string
  type: 'stock' | 'crypto' | 'etf' | 'bond'
}

// Export positions to CSV
export function exportToCsv(positions: Position[]): string {
  if (positions.length === 0) {
    return 'Ticker,Name,Shares,Avg Price,Current Price,Sector,Type,P&L,P&L %,Value\n'
  }
  
  // Header
  let csv = 'Ticker,Name,Shares,Avg Price,Current Price,Sector,Type,P&L,P&L %,Value\n'
  
  // Data rows
  positions.forEach(pos => {
    const value = pos.shares * (pos.currentPrice || pos.avgPrice)
    const cost = pos.shares * pos.avgPrice
    const pnl = value - cost
    const pnlPercent = (pnl / cost) * 100
    
    const row = [
      pos.ticker,
      `"${pos.name.replace(/"/g, '""')}"`, // Escape quotes
      pos.shares,
      pos.avgPrice.toFixed(2),
      (pos.currentPrice || 0).toFixed(2),
      pos.sector,
      pos.type,
      pnl.toFixed(2),
      pnlPercent.toFixed(2),
      value.toFixed(2)
    ]
    
    csv += row.join(',') + '\n'
  })
  
  // Summary row
  const totalValue = positions.reduce((sum, p) => sum + (p.shares * (p.currentPrice || p.avgPrice)), 0)
  const totalCost = positions.reduce((sum, p) => sum + (p.shares * p.avgPrice), 0)
  const totalPnl = totalValue - totalCost
  const totalPnlPercent = (totalPnl / totalCost) * 100
  
  csv += `\nTOTAL,,,,,,,${totalPnl.toFixed(2)},${totalPnlPercent.toFixed(2)},${totalValue.toFixed(2)}\n`
  
  return csv
}

// Download CSV file
export function downloadCsv(positions: Position[], filename?: string): void {
  const csv = exportToCsv(positions)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  const date = new Date().toISOString().split('T')[0]
  link.download = filename || `alpha-forge-portfolio-${date}.csv`
  link.href = URL.createObjectURL(blob)
  link.style.display = 'none'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Parse CSV string to positions
export function parseCsv(csvText: string): { positions: CsvPosition[]; errors: string[] } {
  const positions: CsvPosition[] = []
  const errors: string[] = []
  
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) {
    errors.push('CSV file is empty or has no data')
    return { positions, errors }
  }
  
  // Parse header
  const headers = parseCsvLine(lines[0])
  
  // Find column indices
  const tickerIdx = headers.findIndex(h => h.toLowerCase().includes('ticker') || h.toLowerCase().includes('symbol'))
  const nameIdx = headers.findIndex(h => h.toLowerCase().includes('name'))
  const sharesIdx = headers.findIndex(h => h.toLowerCase().includes('shares') || h.toLowerCase().includes('quantity'))
  const priceIdx = headers.findIndex(h => h.toLowerCase().includes('price') || h.toLowerCase().includes('cost'))
  const sectorIdx = headers.findIndex(h => h.toLowerCase().includes('sector'))
  const typeIdx = headers.findIndex(h => h.toLowerCase().includes('type'))
  
  if (tickerIdx === -1 || sharesIdx === -1 || priceIdx === -1) {
    errors.push('CSV must have columns: Ticker, Shares, and Price/Avg Price')
    return { positions, errors }
  }
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.toLowerCase().startsWith('total')) continue
    
    const values = parseCsvLine(line)
    
    const ticker = values[tickerIdx]?.trim().toUpperCase()
    const shares = parseFloat(values[sharesIdx])
    const avgPrice = parseFloat(values[priceIdx])
    
    if (!ticker) {
      errors.push(`Row ${i}: Missing ticker`)
      continue
    }
    
    if (isNaN(shares) || shares <= 0) {
      errors.push(`Row ${i}: Invalid shares for ${ticker}`)
      continue
    }
    
    if (isNaN(avgPrice) || avgPrice <= 0) {
      errors.push(`Row ${i}: Invalid price for ${ticker}`)
      continue
    }
    
    positions.push({
      ticker,
      name: nameIdx >= 0 ? values[nameIdx]?.replace(/"/g, '').trim() || ticker : ticker,
      shares,
      avgPrice,
      sector: sectorIdx >= 0 ? values[sectorIdx]?.trim() || 'Unknown' : 'Unknown',
      type: (typeIdx >= 0 ? values[typeIdx]?.trim().toLowerCase() : 'stock') as any
    })
  }
  
  return { positions, errors }
}

// Parse a single CSV line (handles quoted fields)
function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  values.push(current.trim())
  return values
}

// Import positions from CSV file
export async function importFromCsv(file: File): Promise<{ positions: CsvPosition[]; errors: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) {
        resolve({ positions: [], errors: ['Failed to read file'] })
        return
      }
      
      const result = parseCsv(text)
      resolve(result)
    }
    
    reader.onerror = () => {
      resolve({ positions: [], errors: ['Failed to read file'] })
    }
    
    reader.readAsText(file)
  })
}

// Generate sample CSV template
export function generateCsvTemplate(): string {
  return `Ticker,Name,Shares,Avg Price,Sector,Type
AAPL,Apple Inc.,100,175.50,Technology,stock
MSFT,Microsoft Corp.,50,380.00,Technology,stock
NVDA,NVIDIA Corp.,25,480.00,Technology,stock
BTC,Bitcoin,0.5,42000,Crypto,crypto
SPY,SPDR S&P 500 ETF,200,445.00,ETF,etf
JNJ,Johnson & Johnson,75,155.00,Healthcare,stock`
}

// Download template
export function downloadTemplate(): void {
  const csv = generateCsvTemplate()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  link.download = 'alpha-forge-template.csv'
  link.href = URL.createObjectURL(blob)
  link.style.display = 'none'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}