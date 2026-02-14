import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, TrendingDown, Wallet, Bell, PieChart, 
  Activity, Shield, Globe, Zap, BarChart3, ArrowUpRight,
  ArrowDownRight, Plus, Trash2, AlertTriangle, Target, RefreshCw
} from 'lucide-react'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import { 
  initWebSocket, 
  subscribeToSymbol, 
  unsubscribeFromSymbol, 
  closeWebSocket,
  getQuote,
  getMultipleQuotes,
  getWebSocketStatus,
  PriceData 
} from './services/finnhub'
import { getNewsForTickers, NewsArticle } from './services/newsApi'
import { calculateRiskMetrics, RiskMetrics, getRiskLevelColor, getRiskLevelBg } from './services/riskAnalysis'
import { getChartData, getPerformanceMetrics, savePortfolioSnapshot } from './services/portfolioHistory'
import { getTaxSummary, findTaxLossOpportunities, calculateTaxEstimate } from './services/taxReporting'
import { analyzePortfolio, getInvestmentAdvice } from './services/aiAdvisor'

// Types
interface Position {
  id: string
  ticker: string
  name: string
  shares: number
  avgPrice: number
  currentPrice: number
  sector: string
  type: 'stock' | 'crypto' | 'etf' | 'bond'
}

interface Alert {
  id: string
  type: 'news' | 'price' | 'risk' | 'opportunity'
  title: string
  message: string
  impact: number // 1-10
  timestamp: Date
  read: boolean
}

interface NewsItem {
  id: string
  title: string
  source: string
  impact: number
  category: string
  timestamp: Date
}

interface PriceAlert {
  id: string
  ticker: string
  targetPrice: number
  condition: 'above' | 'below'
  triggered: boolean
  createdAt: Date
}

// No mock prices - must fetch from API
const INITIAL_POSITIONS: Position[] = [
  { id: '1', ticker: 'AAPL', name: 'Apple Inc.', shares: 100, avgPrice: 175.50, currentPrice: 0, sector: 'Technology', type: 'stock' },
  { id: '2', ticker: 'MSFT', name: 'Microsoft Corp.', shares: 50, avgPrice: 380.00, currentPrice: 0, sector: 'Technology', type: 'stock' },
  { id: '3', ticker: 'NVDA', name: 'NVIDIA Corp.', shares: 25, avgPrice: 480.00, currentPrice: 0, sector: 'Technology', type: 'stock' },
  { id: '4', ticker: 'BTC', name: 'Bitcoin', shares: 0.5, avgPrice: 42000, currentPrice: 0, sector: 'Crypto', type: 'crypto' },
  { id: '5', ticker: 'SPY', name: 'SPDR S&P 500 ETF', shares: 200, avgPrice: 445.00, currentPrice: 0, sector: 'ETF', type: 'etf' },
]

const MOCK_NEWS: NewsItem[] = [
  { id: '1', title: 'Fed Signals Potential Rate Cuts in Q3', source: 'Bloomberg', impact: 8, category: 'Macro', timestamp: new Date() },
  { id: '2', title: 'NVDA Announces Next-Gen AI Chips', source: 'Reuters', impact: 9, category: 'Earnings', timestamp: new Date() },
  { id: '3', title: 'Tech Sector Faces Regulatory Pressure', source: 'WSJ', impact: 6, category: 'Regulatory', timestamp: new Date() },
  { id: '4', title: 'Bitcoin ETF Inflows Reach Record High', source: 'CoinDesk', impact: 7, category: 'Crypto', timestamp: new Date() },
]

const PERFORMANCE_DATA = [
  { month: 'Jan', portfolio: 100000, benchmark: 100000 },
  { month: 'Feb', portfolio: 108500, benchmark: 103200 },
  { month: 'Mar', portfolio: 112000, benchmark: 105800 },
  { month: 'Apr', portfolio: 109500, benchmark: 104200 },
  { month: 'May', portfolio: 118000, benchmark: 107500 },
  { month: 'Jun', portfolio: 125000, benchmark: 110200 },
]

const SECTOR_DATA = [
  { name: 'Technology', value: 65, color: '#2979ff' },
  { name: 'Crypto', value: 20, color: '#00c853' },
  { name: 'ETF', value: 15, color: '#ffd700' },
]

// Components
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-hf-card border border-hf-border rounded-xl p-6 ${className}`}>
    {children}
  </div>
)

const Metric: React.FC<{ label: string; value: string; change?: number; prefix?: string; noData?: boolean }> = ({ 
  label, value, change, prefix = '', noData = false
}) => (
  <div>
    <p className="text-gray-400 text-sm">{label}</p>
    {noData ? (
      <p className="text-2xl font-bold mt-1 text-gray-600">No Data</p>
    ) : (
      <p className="text-2xl font-bold mt-1">{prefix}{value}</p>
    )}
    {change !== undefined && !noData && (
      <div className={`flex items-center gap-1 mt-1 text-sm ${change >= 0 ? 'text-hf-green' : 'text-hf-red'}`}>
        {change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        <span>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
      </div>
    )}
  </div>
)

const RiskMeter: React.FC<{ value: number }> = ({ value }) => {
  const color = value < 30 ? 'text-hf-green' : value < 70 ? 'text-hf-gold' : 'text-hf-red'
  const label = value < 30 ? 'LOW' : value < 70 ? 'MODERATE' : 'HIGH'
  
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 h-2 bg-hf-border rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${value < 30 ? 'bg-hf-green' : value < 70 ? 'bg-hf-gold' : 'bg-hf-red'}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`font-bold ${color}`}>{label}</span>
    </div>
  )
}

const ImpactBadge: React.FC<{ score: number }> = ({ score }) => {
  const color = score >= 8 ? 'bg-hf-red' : score >= 5 ? 'bg-hf-gold' : 'bg-hf-green'
  return (
    <span className={`${color} text-black text-xs font-bold px-2 py-1 rounded`}>
      IMPACT {score}/10
    </span>
  )
}

// Stock database for search
const STOCK_DATABASE = [
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', type: 'stock' },
  { ticker: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', type: 'stock' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology', type: 'stock' },
  { ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Technology', type: 'stock' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Technology', type: 'stock' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', type: 'stock' },
  { ticker: 'META', name: 'Meta Platforms', sector: 'Technology', type: 'stock' },
  { ticker: 'NFLX', name: 'Netflix Inc.', sector: 'Technology', type: 'stock' },
  { ticker: 'AMD', name: 'AMD', sector: 'Technology', type: 'stock' },
  { ticker: 'INTC', name: 'Intel Corp.', sector: 'Technology', type: 'stock' },
  { ticker: 'CRM', name: 'Salesforce Inc.', sector: 'Technology', type: 'stock' },
  { ticker: 'ORCL', name: 'Oracle Corp.', sector: 'Technology', type: 'stock' },
  { ticker: 'JPM', name: 'JPMorgan Chase', sector: 'Finance', type: 'stock' },
  { ticker: 'BAC', name: 'Bank of America', sector: 'Finance', type: 'stock' },
  { ticker: 'V', name: 'Visa Inc.', sector: 'Finance', type: 'stock' },
  { ticker: 'MA', name: 'Mastercard', sector: 'Finance', type: 'stock' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', type: 'stock' },
  { ticker: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare', type: 'stock' },
  { ticker: 'UNH', name: 'UnitedHealth', sector: 'Healthcare', type: 'stock' },
  { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', type: 'stock' },
  { ticker: 'CVX', name: 'Chevron Corp.', sector: 'Energy', type: 'stock' },
  { ticker: 'KO', name: 'Coca-Cola', sector: 'Consumer', type: 'stock' },
  { ticker: 'WMT', name: 'Walmart Inc.', sector: 'Consumer', type: 'stock' },
  { ticker: 'DIS', name: 'Walt Disney', sector: 'Consumer', type: 'stock' },
  { ticker: 'NKE', name: 'Nike Inc.', sector: 'Consumer', type: 'stock' },
  { ticker: 'BTC', name: 'Bitcoin', sector: 'Crypto', type: 'crypto' },
  { ticker: 'ETH', name: 'Ethereum', sector: 'Crypto', type: 'crypto' },
  { ticker: 'SOL', name: 'Solana', sector: 'Crypto', type: 'crypto' },
  { ticker: 'ADA', name: 'Cardano', sector: 'Crypto', type: 'crypto' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF', sector: 'ETF', type: 'etf' },
  { ticker: 'VOO', name: 'Vanguard S&P 500', sector: 'ETF', type: 'etf' },
  { ticker: 'QQQ', name: 'Invesco QQQ', sector: 'ETF', type: 'etf' },
  { ticker: 'VTI', name: 'Vanguard Total Market', sector: 'ETF', type: 'etf' },
  { ticker: 'ARKK', name: 'ARK Innovation', sector: 'ETF', type: 'etf' },
  { ticker: 'BND', name: 'Vanguard Total Bond', sector: 'Bond', type: 'bond' },
]

// Stock Search & Add Component
const StockSearchAdd: React.FC<{ onAdd: (pos: Omit<Position, 'id' | 'currentPrice'>) => void }> = ({ onAdd }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [selectedStock, setSelectedStock] = useState<typeof STOCK_DATABASE[0] | null>(null)
  const [shares, setShares] = useState('')
  const [avgPrice, setAvgPrice] = useState('')

  const filteredStocks = searchTerm.length >= 1
    ? STOCK_DATABASE.filter(s => 
        s.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 5)
    : []

  const handleSelect = (stock: typeof STOCK_DATABASE[0]) => {
    setSelectedStock(stock)
    setSearchTerm(`${stock.ticker} - ${stock.name}`)
    setShowResults(false)
  }

  const handleAdd = () => {
    if (!selectedStock || !shares || !avgPrice) return
    onAdd({
      ticker: selectedStock.ticker,
      name: selectedStock.name,
      shares: Number(shares),
      avgPrice: Number(avgPrice),
      sector: selectedStock.sector,
      type: selectedStock.type as any,
    })
    setSearchTerm('')
    setSelectedStock(null)
    setShares('')
    setAvgPrice('')
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setShowResults(true)
            if (e.target.value === '') setSelectedStock(null)
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Search ticker or company name..."
          className="w-full bg-hf-dark border border-hf-border rounded-lg p-3 pl-10"
        />
        <div className="absolute left-3 top-3.5 text-gray-500">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {showResults && filteredStocks.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-hf-card border border-hf-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredStocks.map((stock) => (
              <button
                key={stock.ticker}
                onClick={() => handleSelect(stock)}
                className="w-full px-4 py-2 text-left hover:bg-hf-border/50 flex items-center justify-between"
              >
                <div>
                  <span className="font-mono font-bold">{stock.ticker}</span>
                  <span className="text-sm text-gray-400 ml-2">{stock.name}</span>
                </div>
                <span className="text-xs bg-hf-border px-2 py-0.5 rounded">{stock.sector}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedStock && (
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            step="0.01"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="Shares"
            className="bg-hf-dark border border-hf-border rounded-lg p-2"
          />
          <input
            type="number"
            step="0.01"
            value={avgPrice}
            onChange={(e) => setAvgPrice(e.target.value)}
            placeholder="Avg Price ($)"
            className="bg-hf-dark border border-hf-border rounded-lg p-2"
          />
        </div>
      )}

      {selectedStock && (
        <button
          onClick={handleAdd}
          disabled={!shares || !avgPrice}
          className="w-full bg-hf-blue hover:bg-blue-600 disabled:bg-hf-border disabled:cursor-not-allowed py-2 rounded-lg font-medium transition-colors"
        >
          Add {selectedStock.ticker} to Portfolio
        </button>
      )}
    </div>
  )
}

export default function App() {
  const [positions, setPositions] = useState<Position[]>(INITIAL_POSITIONS)
  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'analysis' | 'performance' | 'tax' | 'ai' | 'news'>('overview')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  // Auto-refresh settings
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(5) // minutes
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([])
  const [showAlertModal, setShowAlertModal] = useState(false)

  // WebSocket connection status
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')
  
  // News state
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([])
  const [newsFilter, setNewsFilter] = useState<'all' | 'holdings'>('all')
  
  // Fetch real prices via REST API (fallback/initial load)
  const refreshPrices = async () => {
    setIsRefreshing(true)
    setRefreshError(null)
    
    const symbols = positions.map(p => p.ticker)
    const quotes = await getMultipleQuotes(symbols)
    
    if (quotes.size > 0) {
      const updatedPositions = positions.map(pos => {
        const quote = quotes.get(pos.ticker.toUpperCase())
        if (quote) {
          return { ...pos, currentPrice: quote.price }
        }
        return pos
      })
      
      setPositions(updatedPositions)
      setLastUpdate(new Date())
      
      // Subscribe to WebSocket for real-time updates
      subscribeAllToWebSocket()
    } else {
      setRefreshError('Failed to fetch prices. Please try again.')
    }
    
    setIsRefreshing(false)
  }
  
  // Subscribe all positions to WebSocket
  const subscribeAllToWebSocket = () => {
    positions.forEach(pos => {
      subscribeToSymbol(pos.ticker)
    })
  }
  
  // Handle real-time price updates
  const handlePriceUpdate = (priceData: PriceData) => {
    setPositions(prevPositions => {
      return prevPositions.map(pos => {
        if (pos.ticker.toUpperCase() === priceData.symbol.toUpperCase()) {
          return { ...pos, currentPrice: priceData.price }
        }
        return pos
      })
    })
    setLastUpdate(new Date())
  }

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = initWebSocket(
      handlePriceUpdate,
      () => setWsStatus('connected'),
      () => setWsStatus('disconnected')
    )
    
    if (ws) {
      setWsStatus('connecting')
    }
    
    return () => {
      closeWebSocket()
    }
  }, [])
  
  // Subscribe to symbols when positions change
  useEffect(() => {
    subscribeAllToWebSocket()
  }, [positions])
  
  // Auto-refresh effect (backup polling)
  useEffect(() => {
    if (!autoRefreshEnabled) return
    
    const intervalMs = refreshInterval * 60 * 1000
    const interval = setInterval(() => {
      refreshPrices()
    }, intervalMs)
    
    return () => clearInterval(interval)
  }, [autoRefreshEnabled, refreshInterval, positions])
  
  // Auto-fetch prices on component mount (with 3 second delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!lastUpdate) {
        refreshPrices()
      }
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [])
  
  // Fetch news when on news tab
  useEffect(() => {
    if (activeTab === 'news') {
      const fetchNews = async () => {
        const tickers = newsFilter === 'holdings' 
          ? positions.map(p => p.ticker)
          : []
        const articles = await getNewsForTickers(tickers)
        setNewsArticles(articles)
      }
      fetchNews()
    }
  }, [activeTab, newsFilter, positions])
  
  // Save portfolio snapshot for history tracking
  useEffect(() => {
    if (hasPriceData && positions.length > 0) {
      savePortfolioSnapshot(positions)
    }
  }, [positions, hasPriceData])

  // Check price alerts
  const checkPriceAlerts = (currentPositions: Position[]) => {
    priceAlerts.forEach(alert => {
      if (alert.triggered) return
      
      const position = currentPositions.find(p => p.ticker === alert.ticker)
      if (!position) return
      
      const shouldTrigger = 
        (alert.condition === 'above' && position.currentPrice >= alert.targetPrice) ||
        (alert.condition === 'below' && position.currentPrice <= alert.targetPrice)
      
      if (shouldTrigger) {
        setPriceAlerts(prev => prev.map(a => 
          a.id === alert.id ? { ...a, triggered: true } : a
        ))
        // Could add notification logic here
      }
    })
  }

  const addPriceAlert = (alert: Omit<PriceAlert, 'id' | 'triggered' | 'createdAt'>) => {
    setPriceAlerts([...priceAlerts, {
      ...alert,
      id: Date.now().toString(),
      triggered: false,
      createdAt: new Date()
    }])
    setShowAlertModal(false)
  }

  const removePriceAlert = (id: string) => {
    setPriceAlerts(priceAlerts.filter(a => a.id !== id))
  }

  // Check if we have any real price data
  const hasPriceData = positions.some(pos => pos.currentPrice > 0)
  
  // Calculations (only if we have data)
  const totalValue = hasPriceData 
    ? positions.reduce((sum, pos) => sum + (pos.shares * (pos.currentPrice || pos.avgPrice)), 0)
    : 0
  const totalCost = positions.reduce((sum, pos) => sum + (pos.shares * pos.avgPrice), 0)
  const totalPnL = hasPriceData ? totalValue - totalCost : 0
  const totalPnLPercent = hasPriceData && totalCost > 0 ? (totalPnL / totalCost) * 100 : 0
  
  // Risk Metrics (only calculated when data available)
  const riskMetrics: RiskMetrics = hasPriceData ? calculateRiskMetrics(positions) : {
    portfolioBeta: 0,
    portfolioVolatility: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    var95: 0,
    positionRisks: [],
    sectorConcentration: [],
    correlations: { tickers: [], matrix: [] }
  }

  const addPosition = (position: Omit<Position, 'id' | 'currentPrice'>) => {
    const newPosition: Position = {
      ...position,
      id: Date.now().toString(),
      currentPrice: position.avgPrice * (1 + (Math.random() * 0.1 - 0.05)),
    }
    setPositions([...positions, newPosition])
    setShowAddModal(false)
  }

  const removePosition = (id: string) => {
    setPositions(positions.filter(p => p.id !== id))
  }

  return (
    <div className="min-h-screen bg-hf-dark">
      {/* Header */}
      <header className="border-b border-hf-border bg-hf-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-hf-blue to-hf-green rounded-lg flex items-center justify-center">
                <TrendingUp className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold">ALPHA FORGE</h1>
                <p className="text-xs text-gray-400">Quantitative Strategy Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* WebSocket Status Badge */}
              <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                wsStatus === 'connected' ? 'bg-hf-green/20 text-hf-green' : 
                wsStatus === 'connecting' ? 'bg-hf-gold/20 text-hf-gold' : 
                'bg-hf-red/20 text-hf-red'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  wsStatus === 'connected' ? 'bg-hf-green animate-pulse' : 
                  wsStatus === 'connecting' ? 'bg-hf-gold' : 
                  'bg-hf-red'
                }`}></span>
                {wsStatus === 'connected' ? 'WebSocket Live' : 
                 wsStatus === 'connecting' ? 'Connecting...' : 
                 'Disconnected'}
              </div>
              
              <button 
                onClick={refreshPrices}
                disabled={isRefreshing}
                className="p-2 hover:bg-hf-border rounded-lg disabled:opacity-50"
                title="Refresh Prices (Finnhub)"
              >
                <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
              
              <button className="p-2 hover:bg-hf-border rounded-lg relative">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-hf-red rounded-full"></span>
              </button>
              
              <div className="text-right">
                <p className="text-sm text-gray-400">Portfolio Value</p>
                {hasPriceData ? (
                  <>
                    <p className="text-xl font-bold">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-gray-500">Updated: {lastUpdate?.toLocaleTimeString()}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-gray-600">No Data</p>
                    <p className="text-xs text-gray-500">Click refresh to fetch</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-hf-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6">
            {[
              { id: 'overview', label: 'Overview', icon: PieChart },
              { id: 'positions', label: 'Positions', icon: Wallet },
              { id: 'analysis', label: 'Analysis', icon: Activity },
              { id: 'performance', label: 'Performance', icon: BarChart3 },
              { id: 'tax', label: 'Tax Center', icon: Shield },
              { id: 'ai', label: 'AI Advisor', icon: Zap },
              { id: 'news', label: 'News', icon: Globe },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                  activeTab === id 
                    ? 'border-hf-blue text-hf-blue' 
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={18} />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Fetch Real Prices Banner */}
            {!lastUpdate && !isRefreshing && (
              <Card className="bg-gradient-to-r from-hf-blue/20 to-hf-green/20 border-hf-blue">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">🚀 Fetch Real-Time Prices</h3>
                    <p className="text-sm text-gray-400">No price data available. Click to fetch live prices from Finnhub (real-time streaming).</p>
                    {refreshError && <p className="text-sm text-hf-red mt-1">{refreshError}</p>}
                  </div>
                  <button 
                    onClick={refreshPrices}
                    className="bg-hf-blue hover:bg-blue-600 px-6 py-3 rounded-lg font-bold flex items-center gap-2"
                  >
                    <RefreshCw size={18} />
                    Fetch Live Prices
                  </button>
                </div>
              </Card>
            )}

            {isRefreshing && (
              <Card className="bg-hf-gold/10 border-hf-gold">
                <div className="flex items-center gap-3">
                  <RefreshCw size={20} className="animate-spin text-hf-gold" />
                  <span className="font-medium">Fetching real prices... (takes ~1 minute due to API rate limits)</span>
                </div>
              </Card>
            )}

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <Metric 
                  label="Total Value" 
                  value={totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} 
                  prefix="$"
                  noData={!hasPriceData}
                />
              </Card>
              <Card>
                <Metric 
                  label="Total P&L" 
                  value={Math.abs(totalPnL).toLocaleString('en-US', { minimumFractionDigits: 2 })} 
                  change={totalPnLPercent}
                  prefix={totalPnL >= 0 ? '+$' : '-$'}
                  noData={!hasPriceData}
                />
              </Card>
              <Card>
                <Metric 
                  label="Day's P&L" 
                  value="1,245.50" 
                  change={1.02}
                  prefix="+$"
                />
              </Card>
              <Card>
                <Metric 
                  label="Cash Available" 
                  value="45,230.00" 
                  prefix="$"
                />
              </Card>
            </div>

            {/* Risk Dashboard */}
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Shield size={20} className="text-hf-blue" />
                  Risk Metrics
                </h2>
                <span className="text-sm text-gray-400">Real-time Calculation</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-400">Portfolio Risk Level</span>
                      <span className={`font-bold ${hasPriceData ? 'text-hf-gold' : 'text-gray-600'}`}>
                        {hasPriceData ? 'MODERATE' : 'No Data'}
                      </span>
                    </div>
                    {hasPriceData ? <RiskMeter value={58} /> : <div className="h-2 bg-hf-border rounded-full" />}
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div>
                      <p className="text-sm text-gray-400">Sharpe Ratio</p>
                      <p className={`text-xl font-bold ${hasPriceData ? 'text-hf-green' : 'text-gray-600'}`}>
                        {hasPriceData ? sharpeRatio : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Portfolio Beta</p>
                      <p className={`text-xl font-bold ${hasPriceData ? '' : 'text-gray-600'}`}>
                        {hasPriceData ? portfolioBeta : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Max Drawdown</p>
                      <p className={`text-xl font-bold ${hasPriceData ? 'text-hf-red' : 'text-gray-600'}`}>
                        {hasPriceData ? `${maxDrawdown}%` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Volatility (30d)</p>
                      <p className={`text-xl font-bold ${hasPriceData ? '' : 'text-gray-600'}`}>
                        {hasPriceData ? `${volatility}%` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={PERFORMANCE_DATA}>
                      <defs>
                        <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2979ff" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#2979ff" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                      <XAxis dataKey="month" stroke="#666" />
                      <YAxis stroke="#666" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}
                      />
                      <Area type="monotone" dataKey="portfolio" stroke="#2979ff" fillOpacity={1} fill="url(#colorPortfolio)" />
                      <Area type="monotone" dataKey="benchmark" stroke="#666" fill="none" strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* Sector Allocation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <PieChart size={20} className="text-hf-blue" />
                  Sector Allocation
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={SECTOR_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {SECTOR_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  {SECTOR_DATA.map((sector) => (
                    <div key={sector.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sector.color }} />
                      <span className="text-sm">{sector.name} ({sector.value}%)</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Bell size={20} className="text-hf-gold" />
                    Price Alerts ({priceAlerts.filter(a => !a.triggered).length} active)
                  </h2>
                  <button 
                    onClick={() => setShowAlertModal(true)}
                    className="text-sm bg-hf-blue px-3 py-1 rounded-lg hover:bg-blue-600"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {priceAlerts.length === 0 ? (
                    <p className="text-gray-500 text-sm">No alerts set</p>
                  ) : (
                    priceAlerts.map(alert => (
                      <div key={alert.id} className={`p-3 border rounded-lg ${alert.triggered ? 'bg-hf-green/10 border-hf-green/30' : 'bg-hf-border/30 border-hf-border'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold">{alert.ticker}</span>
                            <span className="text-sm text-gray-400 ml-2">
                              {alert.condition === 'above' ? '≥' : '≤'} ${alert.targetPrice}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {alert.triggered && <span className="text-xs bg-hf-green text-black px-2 py-0.5 rounded">TRIGGERED</span>}
                            <button 
                              onClick={() => removePriceAlert(alert.id)}
                              className="text-gray-400 hover:text-hf-red"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* Settings Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <RefreshCw size={20} className="text-hf-blue" />
                  Auto-Refresh Settings
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Auto-refresh prices</span>
                    <button
                      onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors ${autoRefreshEnabled ? 'bg-hf-green' : 'bg-hf-border'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${autoRefreshEnabled ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
                    </button>
                  </div>
                  {autoRefreshEnabled && (
                    <div>
                      <label className="text-sm text-gray-400">Refresh every (minutes)</label>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {[1, 2, 5, 10, 15, 30].map(min => (
                          <button
                            key={min}
                            onClick={() => setRefreshInterval(min)}
                            className={`px-3 py-1 rounded-lg text-sm ${refreshInterval === min ? 'bg-hf-blue' : 'bg-hf-border hover:bg-gray-700'}`}
                          >
                            {min}m
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2 mt-2">
                        <p className="text-xs text-gray-500">
                          <strong>Finnhub:</strong> 60 calls/minute | WebSocket streaming active
                        </p>
                        <p className="text-xs text-gray-500">
                          {positions.length} positions monitored in real-time
                        </p>
                      </div>
                      <div className="mt-3 p-2 bg-hf-dark rounded-lg">
                        <p className="text-xs text-gray-400">
                          Last update: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          WebSocket: {wsStatus === 'connected' ? '● Connected (Live)' : wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Auto-refresh: {autoRefreshEnabled ? `${refreshInterval}min intervals` : 'Off'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-hf-gold" />
                  System Alerts
                </h2>
                <div className="space-y-3">
                  <div className="p-3 bg-hf-red/10 border border-hf-red/30 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-hf-red">HIGH VOLATILITY WARNING</p>
                        <p className="text-sm text-gray-400 mt-1">NVDA position showing 15% intraday swing</p>
                      </div>
                      <ImpactBadge score={8} />
                    </div>
                  </div>
                  <div className="p-3 bg-hf-gold/10 border border-hf-gold/30 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-hf-gold">REBALANCING OPPORTUNITY</p>
                        <p className="text-sm text-gray-400 mt-1">Tech sector overweight by 12%</p>
                      </div>
                      <ImpactBadge score={6} />
                    </div>
                  </div>
                  <div className="p-3 bg-hf-green/10 border border-hf-green/30 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-hf-green">ALPHA OPPORTUNITY</p>
                        <p className="text-sm text-gray-400 mt-1">BTC showing momentum breakout pattern</p>
                      </div>
                      <ImpactBadge score={7} />
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Portfolio Holdings</h2>
              <button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-hf-blue hover:bg-blue-600 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <Plus size={18} />
                Add Position
              </button>
            </div>

            {/* Quick Add Popular Stocks */}
            <Card>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Add Popular Stocks</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { ticker: 'AAPL', name: 'Apple', sector: 'Technology', type: 'stock' },
                  { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology', type: 'stock' },
                  { ticker: 'NVDA', name: 'NVIDIA', sector: 'Technology', type: 'stock' },
                  { ticker: 'TSLA', name: 'Tesla', sector: 'Technology', type: 'stock' },
                  { ticker: 'AMZN', name: 'Amazon', sector: 'Technology', type: 'stock' },
                  { ticker: 'GOOGL', name: 'Google', sector: 'Technology', type: 'stock' },
                  { ticker: 'META', name: 'Meta', sector: 'Technology', type: 'stock' },
                  { ticker: 'BTC', name: 'Bitcoin', sector: 'Crypto', type: 'crypto' },
                  { ticker: 'ETH', name: 'Ethereum', sector: 'Crypto', type: 'crypto' },
                  { ticker: 'SPY', name: 'S&P 500 ETF', sector: 'ETF', type: 'etf' },
                  { ticker: 'VOO', name: 'Vanguard S&P 500', sector: 'ETF', type: 'etf' },
                  { ticker: 'QQQ', name: 'Nasdaq-100', sector: 'ETF', type: 'etf' },
                ].map((stock) => (
                  <button
                    key={stock.ticker}
                    onClick={() => addPosition({
                      ticker: stock.ticker,
                      name: stock.name,
                      shares: 0,
                      avgPrice: 0,
                      sector: stock.sector,
                      type: stock.type as any,
                    })}
                    className="px-3 py-1.5 bg-hf-border/50 hover:bg-hf-blue/30 border border-hf-border hover:border-hf-blue rounded-lg text-sm font-medium transition-all"
                  >
                    + {stock.ticker}
                  </button>
                ))}
              </div>
            </Card>

            {/* Search & Add */}
            <Card>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Search & Add Stock</h3>
              <StockSearchAdd onAdd={addPosition} />
            </Card>

            <Card className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-hf-border text-left text-sm text-gray-400">
                    <th className="pb-4 pl-4">Ticker</th>
                    <th className="pb-4">Name</th>
                    <th className="pb-4">Shares</th>
                    <th className="pb-4">Avg Price</th>
                    <th className="pb-4">Current</th>
                    <th className="pb-4">P&L</th>
                    <th className="pb-4">P&L %</th>
                    <th className="pb-4">Value</th>
                    <th className="pb-4 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => {
                    const hasPrice = pos.currentPrice > 0
                    const value = hasPrice ? pos.shares * pos.currentPrice : 0
                    const cost = pos.shares * pos.avgPrice
                    const pnl = hasPrice ? value - cost : 0
                    const pnlPercent = hasPrice && cost > 0 ? (pnl / cost) * 100 : 0
                    
                    return (
                      <tr key={pos.id} className="border-b border-hf-border last:border-0 hover:bg-hf-border/30">
                        <td className="py-4 pl-4 font-mono font-bold">{pos.ticker}</td>
                        <td className="py-4">{pos.name}</td>
                        <td className="py-4">{pos.shares}</td>
                        <td className="py-4">${pos.avgPrice.toFixed(2)}</td>
                        <td className="py-4">
                          {hasPrice ? `$${pos.currentPrice.toFixed(2)}` : <span className="text-gray-600">No Data</span>}
                        </td>
                        <td className={`py-4 font-medium ${!hasPrice ? 'text-gray-600' : pnl >= 0 ? 'text-hf-green' : 'text-hf-red'}`}>
                          {hasPrice ? `${pnl >= 0 ? '+' : ''}${pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className={`py-4 font-medium ${!hasPrice ? 'text-gray-600' : pnl >= 0 ? 'text-hf-green' : 'text-hf-red'}`}>
                          {hasPrice ? `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%` : '—'}
                        </td>
                        <td className="py-4 font-bold">
                          {hasPrice ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : <span className="text-gray-600">No Data</span>}
                        </td>
                        <td className="py-4 pr-4">
                          <button 
                            onClick={() => removePosition(pos.id)}
                            className="p-2 hover:bg-hf-red/20 text-gray-400 hover:text-hf-red rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Technical & Fundamental Analysis</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <BarChart3 size={20} className="text-hf-blue" />
                  Technical Indicators: NVDA
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-400">RSI (14)</span>
                      <span className="text-hf-gold font-bold">68.5</span>
                    </div>
                    <RiskMeter value={68} />
                    <p className="text-xs text-gray-500 mt-1">Approaching overbought territory</p>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-400">MACD</span>
                      <span className="text-hf-green font-bold">BULLISH</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs bg-hf-green/20 text-hf-green px-2 py-1 rounded">Signal: Buy</span>
                      <span className="text-xs bg-hf-border text-gray-400 px-2 py-1 rounded">Histogram: ↑</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-400">Bollinger Bands</span>
                      <span className="font-bold">Upper Touch</span>
                    </div>
                    <p className="text-xs text-gray-500">Price at upper band - potential reversal zone</p>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Target size={20} className="text-hf-green" />
                  Advisory: NVDA
                </h3>
                <div className="space-y-4">
                  <div className="p-3 bg-hf-green/10 border border-hf-green/30 rounded-lg">
                    <p className="font-semibold text-hf-green mb-1">BULL CASE</p>
                    <p className="text-sm text-gray-300">AI chip demand surging. Next-gen Blackwell architecture gaining traction. Data center revenue up 427% YoY.</p>
                  </div>
                  <div className="p-3 bg-hf-red/10 border border-hf-red/30 rounded-lg">
                    <p className="font-semibold text-hf-red mb-1">BEAR CASE</p>
                    <p className="text-sm text-gray-300">Valuation stretched at 65x P/E. China export restrictions looming. Competition from AMD/Intel intensifying.</p>
                  </div>
                  <div className="p-3 bg-hf-blue/10 border border-hf-blue/30 rounded-lg">
                    <p className="font-semibold text-hf-blue mb-1">RECOMMENDED ACTION</p>
                    <p className="text-sm text-gray-300"><strong>HOLD</strong> — Trim 10% if RSI crosses 70. Set stop-loss at $680. Consider adding on pullback to $650.</p>
                  </div>
                </div>
              </Card>
            </div>
            
            {/* Risk Analysis Section */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Risk Analysis</h2>
              
              {/* Portfolio Risk Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <p className="text-sm text-gray-400">Portfolio Beta</p>
                  <p className="text-2xl font-bold mt-1">
                    {hasPriceData ? riskMetrics.portfolioBeta.toFixed(2) : <span className="text-gray-600">No Data</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {riskMetrics.portfolioBeta > 1.2 ? 'High volatility' : 
                     riskMetrics.portfolioBeta < 0.8 ? 'Defensive' : 'Market-like'}
                  </p>
                </Card>
                <Card>
                  <p className="text-sm text-gray-400">Volatility (Est.)</p>
                  <p className="text-2xl font-bold mt-1">
                    {hasPriceData ? `${riskMetrics.portfolioVolatility.toFixed(1)}%` : <span className="text-gray-600">No Data</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Annualized standard deviation</p>
                </Card>
                <Card>
                  <p className="text-sm text-gray-400">Sharpe Ratio</p>
                  <p className={`text-2xl font-bold mt-1 ${riskMetrics.sharpeRatio > 1 ? 'text-hf-green' : riskMetrics.sharpeRatio < 0 ? 'text-hf-red' : ''}`}>
                    {hasPriceData ? riskMetrics.sharpeRatio.toFixed(2) : <span className="text-gray-600">No Data</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {riskMetrics.sharpeRatio > 1 ? 'Good risk-adjusted returns' : 
                     riskMetrics.sharpeRatio < 0 ? 'Poor returns vs risk' : 'Average'}
                  </p>
                </Card>
                <Card>
                  <p className="text-sm text-gray-400">Value at Risk (95%)</p>
                  <p className="text-2xl font-bold mt-1 text-hf-red">
                    {hasPriceData ? `-$${(riskMetrics.var95 / 1000).toFixed(1)}k` : <span className="text-gray-600">No Data</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Max loss 95% confidence</p>
                </Card>
              </div>
              
              {/* Sector Concentration */}
              <Card>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <PieChart size={20} className="text-hf-blue" />
                  Sector Concentration Risk
                </h3>
                <div className="space-y-3">
                  {riskMetrics.sectorConcentration.length === 0 ? (
                    <p className="text-gray-400">No sector data available</p>
                  ) : (
                    riskMetrics.sectorConcentration.map((sector) => (
                      <div key={sector.sector} className="flex items-center justify-between p-3 bg-hf-dark rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{sector.sector}</span>
                          <span className="text-sm text-gray-400">{sector.weight.toFixed(1)}%</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded font-medium ${getRiskLevelBg(sector.riskLevel)} ${getRiskLevelColor(sector.riskLevel)}`}>
                          {sector.riskLevel.toUpperCase()} RISK
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {riskMetrics.sectorConcentration.some(s => s.riskLevel === 'high' || s.riskLevel === 'extreme') && (
                  <div className="mt-4 p-3 bg-hf-gold/10 border border-hf-gold/30 rounded-lg">
                    <p className="text-sm text-hf-gold">
                      ⚠️ <strong>Concentration Warning:</strong> Consider diversifying across more sectors to reduce risk.
                    </p>
                  </div>
                )}
              </Card>
              
              {/* Position Risk Contributions */}
              <Card>
                <h3 className="text-lg font-bold mb-4">Position Risk Contributions</h3>
                <div className="space-y-2">
                  {riskMetrics.positionRisks.length === 0 ? (
                    <p className="text-gray-400">No position data available</p>
                  ) : (
                    riskMetrics.positionRisks
                      .sort((a, b) => b.contribution - a.contribution)
                      .map((pos) => (
                        <div key={pos.ticker} className="flex items-center justify-between p-2 hover:bg-hf-border/30 rounded">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold">{pos.ticker}</span>
                            <span className="text-sm text-gray-400">{pos.weight.toFixed(1)}% of portfolio</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm">β {pos.beta.toFixed(2)}</span>
                            <div className="w-32 h-2 bg-hf-border rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${pos.contribution > 0.3 ? 'bg-hf-red' : pos.contribution > 0.2 ? 'bg-hf-gold' : 'bg-hf-green'}`}
                                style={{ width: `${Math.min(pos.contribution * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'news' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Market Intelligence</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {newsFilter === 'holdings' 
                    ? `Showing news for ${positions.length} holdings`
                    : 'Showing all market news'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-hf-card rounded-lg p-1">
                  <button
                    onClick={() => setNewsFilter('all')}
                    className={`px-3 py-1 rounded text-sm ${newsFilter === 'all' ? 'bg-hf-blue' : 'text-gray-400 hover:text-white'}`}
                  >
                    All News
                  </button>
                  <button
                    onClick={() => setNewsFilter('holdings')}
                    className={`px-3 py-1 rounded text-sm ${newsFilter === 'holdings' ? 'bg-hf-blue' : 'text-gray-400 hover:text-white'}`}
                  >
                    My Holdings
                  </button>
                </div>
                <span className="text-xs bg-hf-green/20 text-hf-green px-2 py-1 rounded font-bold">LIVE</span>
              </div>
            </div>

            <Card className="border-hf-gold">
              <div className="flex items-center gap-3 mb-4">
                <Zap size={24} className="text-hf-gold" />
                <div>
                  <h3 className="font-bold text-hf-gold">PRIORITY WATCH: LOVABLE IPO</h3>
                  <p className="text-sm text-gray-400">No new developments detected</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-hf-dark rounded-lg">
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-gray-500">IPO Status</p>
                </div>
                <div className="p-3 bg-hf-dark rounded-lg">
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-gray-500">Expected Date</p>
                </div>
                <div className="p-3 bg-hf-dark rounded-lg">
                  <p className="text-2xl font-bold text-hf-green">ACTIVE</p>
                  <p className="text-xs text-gray-500">Monitoring</p>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              {newsArticles.length === 0 ? (
                <Card className="text-center py-8">
                  <p className="text-gray-400">No news available</p>
                  <p className="text-sm text-gray-500 mt-1">Check back later for updates</p>
                </Card>
              ) : (
                newsArticles.map((news) => (
                  <Card key={news.id} className="hover:border-hf-blue transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {news.ticker && (
                            <span className="text-xs bg-hf-blue/30 text-hf-blue px-2 py-0.5 rounded font-mono">
                              {news.ticker}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            news.sentiment === 'positive' ? 'bg-hf-green/20 text-hf-green' :
                            news.sentiment === 'negative' ? 'bg-hf-red/20 text-hf-red' :
                            'bg-hf-border text-gray-400'
                          }`}>
                            {news.sentiment.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">{news.source}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(news.publishedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <h3 className="font-semibold mb-1">{news.title}</h3>
                        <p className="text-sm text-gray-400">{news.description}</p>
                      </div>
                      <a 
                        href={news.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-hf-blue hover:text-white text-sm"
                      >
                        Read →
                      </a>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Portfolio Performance</h2>
              <span className="text-xs bg-hf-blue px-2 py-1 rounded">vs S&P 500</span>
            </div>
            
            {/* Performance Metrics */}
            {(() => {
              const metrics = getPerformanceMetrics()
              return (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card>
                    <p className="text-sm text-gray-400">Total Return</p>
                    <p className={`text-2xl font-bold mt-1 ${metrics.totalReturnPercent >= 0 ? 'text-hf-green' : 'text-hf-red'}`}>
                      {metrics.totalReturnPercent >= 0 ? '+' : ''}{metrics.totalReturnPercent.toFixed(2)}%
                    </p>
                  </Card>
                  <Card>
                    <p className="text-sm text-gray-400">Annualized Return</p>
                    <p className={`text-2xl font-bold mt-1 ${metrics.annualizedReturn >= 0 ? 'text-hf-green' : 'text-hf-red'}`}>
                      {metrics.annualizedReturn >= 0 ? '+' : ''}{metrics.annualizedReturn.toFixed(2)}%
                    </p>
                  </Card>
                  <Card>
                    <p className="text-sm text-gray-400">Best Day</p>
                    <p className="text-2xl font-bold mt-1 text-hf-green">
                      +{metrics.bestDay.return.toFixed(2)}%
                    </p>
                    <p className="text-xs text-gray-500">{metrics.bestDay.date}</p>
                  </Card>
                  <Card>
                    <p className="text-sm text-gray-400">Worst Day</p>
                    <p className="text-2xl font-bold mt-1 text-hf-red">
                      {metrics.worstDay.return.toFixed(2)}%
                    </p>
                    <p className="text-xs text-gray-500">{metrics.worstDay.date}</p>
                  </Card>
                </div>
              )
            })()}
            
            {/* Performance Chart */}
            <Card>
              <h3 className="text-lg font-bold mb-4">Portfolio Value Over Time</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={getChartData()}>
                    <defs>
                      <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2979ff" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#2979ff" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffd700" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ffd700" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="date" stroke="#666" />
                    <YAxis stroke="#666" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                    />
                    <Area type="monotone" dataKey="portfolio" stroke="#2979ff" fillOpacity={1} fill="url(#colorPortfolio)" name="Your Portfolio" />
                    <Area type="monotone" dataKey="benchmark" stroke="#ffd700" fillOpacity={1} fill="url(#colorBenchmark)" name="S&P 500" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-hf-blue" />
                  <span className="text-sm">Your Portfolio</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-hf-gold" />
                  <span className="text-sm">S&P 500 Benchmark</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'tax' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Tax Center</h2>
            
            {(() => {
              const taxSummary = getTaxSummary(positions)
              const opportunities = findTaxLossOpportunities(positions)
              return (
                <>
                  {/* Tax Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                      <p className="text-sm text-gray-400">Unrealized Gain/Loss</p>
                      <p className={`text-2xl font-bold mt-1 ${taxSummary.unrealizedGain >= 0 ? 'text-hf-green' : 'text-hf-red'}`}>
                        {taxSummary.unrealizedGainFormatted}
                      </p>
                    </Card>
                    <Card>
                      <p className="text-sm text-gray-400">Est. Tax If Sold Now</p>
                      <p className="text-2xl font-bold mt-1 text-hf-red">
                        ${taxSummary.estimatedTax.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Effective rate: {taxSummary.effectiveRate.toFixed(1)}%</p>
                    </Card>
                    <Card>
                      <p className="text-sm text-gray-400">Tax Loss Opportunities</p>
                      <p className="text-2xl font-bold mt-1 text-hf-green">
                        {taxSummary.totalOpportunities}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Potential savings: ${taxSummary.potentialSavings.toLocaleString()}
                      </p>
                    </Card>
                  </div>
                  
                  {/* Tax Loss Harvesting */}
                  <Card>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <span className="text-hf-green">💡</span>
                      Tax Loss Harvesting Opportunities
                    </h3>
                    {opportunities.length === 0 ? (
                      <p className="text-gray-400">No tax loss opportunities at this time.</p>
                    ) : (
                      <div className="space-y-3">
                        {opportunities.map((opp) => (
                          <div key={opp.ticker} className={`p-3 rounded-lg border ${
                            opp.recommendation === 'harvest' 
                              ? 'bg-hf-green/10 border-hf-green/30' 
                              : opp.recommendation === 'avoid'
                              ? 'bg-hf-red/10 border-hf-red/30'
                              : 'bg-hf-border/30 border-hf-border'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-mono font-bold">{opp.ticker}</span>
                                <span className="text-sm text-gray-400 ml-2">
                                  Loss: -${opp.currentLoss.toLocaleString()}
                                </span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded ${
                                opp.recommendation === 'harvest'
                                  ? 'bg-hf-green text-black'
                                  : opp.recommendation === 'avoid'
                                  ? 'bg-hf-red text-white'
                                  : 'bg-hf-gold text-black'
                              }`}>
                                {opp.recommendation.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-400 mt-1">{opp.reasoning}</p>
                            <p className="text-xs text-gray-500 mt-1">Held for {opp.daysHeld} days</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                  
                  {/* Tax Tips */}
                  <Card>
                    <h3 className="text-lg font-bold mb-4">Tax Tips</h3>
                    <div className="space-y-2 text-sm text-gray-400">
                      <p>• <strong>Long-term gains</strong> (held &gt;1 year) taxed at lower rates (0%, 15%, or 20%)</p>
                      <p>• <strong>Wash sale rule:</strong> Can't claim loss if you buy same stock 30 days before/after sale</p>
                      <p>• <strong>Tax-loss harvesting:</strong> Offset gains with losses to reduce tax bill</p>
                      <p>• <strong>Max deduction:</strong> Can deduct up to $3,000 in net losses against ordinary income</p>
                    </div>
                  </Card>
                </>
              )
            })()}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">AI Portfolio Advisor</h2>
              {(() => {
                const analysis = analyzePortfolio(positions)
                const healthColors: Record<string, string> = {
                  excellent: 'bg-hf-green',
                  good: 'bg-hf-blue',
                  fair: 'bg-hf-gold',
                  poor: 'bg-orange-500',
                  critical: 'bg-hf-red'
                }
                return (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">Portfolio Health:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold text-black ${healthColors[analysis.overallHealth]}`}>
                      {analysis.overallHealth.toUpperCase()} ({analysis.healthScore}/100)
                    </span>
                  </div>
                )
              })()}
            </div>
            
            {(() => {
              const analysis = analyzePortfolio(positions)
              return (
                <>
                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <h3 className="text-lg font-bold mb-4 text-hf-green">✅ Strengths</h3>
                      {analysis.strengths.length === 0 ? (
                        <p className="text-gray-400">No major strengths identified.</p>
                      ) : (
                        <ul className="space-y-2">
                          {analysis.strengths.map((strength, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-hf-green">•</span>
                              <span>{strength}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                    <Card>
                      <h3 className="text-lg font-bold mb-4 text-hf-gold">⚠️ Areas to Improve</h3>
                      {analysis.weaknesses.length === 0 ? (
                        <p className="text-gray-400">No major weaknesses identified.</p>
                      ) : (
                        <ul className="space-y-2">
                          {analysis.weaknesses.map((weakness, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-hf-gold">•</span>
                              <span>{weakness}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  </div>
                  
                  {/* AI Recommendations */}
                  <Card>
                    <h3 className="text-lg font-bold mb-4">🤖 AI Recommendations</h3>
                    {analysis.recommendations.length === 0 ? (
                      <p className="text-gray-400">No recommendations at this time.</p>
                    ) : (
                      <div className="space-y-4">
                        {analysis.recommendations.slice(0, 5).map((rec, i) => (
                          <div key={i} className={`p-4 rounded-lg border ${
                            rec.urgency === 'critical' ? 'bg-hf-red/10 border-hf-red/30' :
                            rec.urgency === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                            rec.urgency === 'medium' ? 'bg-hf-gold/10 border-hf-gold/30' :
                            'bg-hf-border/30 border-hf-border'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold">{rec.ticker}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  rec.type === 'buy' ? 'bg-hf-green text-black' :
                                  rec.type === 'sell' ? 'bg-hf-red text-white' :
                                  rec.type === 'rebalance' ? 'bg-hf-gold text-black' :
                                  'bg-hf-blue text-white'
                                }`}>
                                  {rec.type.toUpperCase()}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  rec.urgency === 'critical' ? 'bg-hf-red text-white' :
                                  rec.urgency === 'high' ? 'bg-orange-500 text-white' :
                                  rec.urgency === 'medium' ? 'bg-hf-gold text-black' :
                                  'bg-gray-600 text-white'
                                }`}>
                                  {rec.urgency.toUpperCase()}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">{rec.confidence}% confidence</span>
                            </div>
                            <p className="text-sm mb-2">{rec.reasoning}</p>
                            <p className="text-sm text-hf-blue">→ {rec.action}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                  
                  {/* Scenario Analysis */}
                  <Card>
                    <h3 className="text-lg font-bold mb-4">📊 "What If" Scenario Analysis</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {analysis.scenarioAnalysis.map((scenario, i) => (
                        <div key={i} className="p-4 bg-hf-dark rounded-lg text-center">
                          <p className="font-bold mb-1">{scenario.name}</p>
                          <p className="text-xs text-gray-400 mb-2">{scenario.description}</p>
                          <p className={`text-xl font-bold ${scenario.change >= 0 ? 'text-hf-green' : 'text-hf-red'}`}>
                            {scenario.change >= 0 ? '+' : ''}{scenario.changePercent.toFixed(1)}%
                          </p>
                          <p className="text-sm text-gray-400">
                            ${(scenario.portfolioValue / 1000).toFixed(1)}k
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              )
            })()}
          </div>
        )}
      </main>

      {/* Add Position Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add New Position</h3>
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              addPosition({
                ticker: formData.get('ticker') as string,
                name: formData.get('name') as string,
                shares: Number(formData.get('shares')),
                avgPrice: Number(formData.get('avgPrice')),
                sector: formData.get('sector') as string,
                type: formData.get('type') as any,
              })
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Ticker</label>
                  <input name="ticker" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1" required />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Name</label>
                  <input name="name" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Shares</label>
                  <input name="shares" type="number" step="0.01" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1" required />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Avg Price ($)</label>
                  <input name="avgPrice" type="number" step="0.01" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Sector</label>
                  <select name="sector" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1">
                    <option>Technology</option>
                    <option>Finance</option>
                    <option>Healthcare</option>
                    <option>Energy</option>
                    <option>Consumer</option>
                    <option>Crypto</option>
                    <option>ETF</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Type</label>
                  <select name="type" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1">
                    <option value="stock">Stock</option>
                    <option value="crypto">Crypto</option>
                    <option value="etf">ETF</option>
                    <option value="bond">Bond</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 border border-hf-border rounded-lg hover:bg-hf-border transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2 bg-hf-blue hover:bg-blue-600 rounded-lg font-medium transition-colors">
                  Add Position
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Add Price Alert Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Set Price Alert</h3>
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              addPriceAlert({
                ticker: (formData.get('ticker') as string).toUpperCase(),
                targetPrice: Number(formData.get('targetPrice')),
                condition: formData.get('condition') as 'above' | 'below',
              })
            }} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Ticker Symbol</label>
                <input name="ticker" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1" placeholder="e.g., AAPL" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Condition</label>
                  <select name="condition" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1">
                    <option value="above">Goes Above</option>
                    <option value="below">Goes Below</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Target Price ($)</label>
                  <input name="targetPrice" type="number" step="0.01" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1" required />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAlertModal(false)} className="flex-1 py-2 border border-hf-border rounded-lg hover:bg-hf-border transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2 bg-hf-blue hover:bg-blue-600 rounded-lg font-medium transition-colors">
                  Set Alert
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}