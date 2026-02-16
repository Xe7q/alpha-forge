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
  getWebSocketStatus,
  PriceData as FinnhubPriceData
} from './services/finnhub'
import { getNewsForTickers, NewsArticle } from './services/newsApi'
import { getMultiplePricesWithFallback } from './services/priceService'
import { calculateRiskMetrics, RiskMetrics, getRiskLevelColor, getRiskLevelBg } from './services/riskAnalysis'
import { getChartData, getPerformanceMetrics, savePortfolioSnapshot } from './services/portfolioHistory'
import { getTaxSummary, findTaxLossOpportunities, calculateTaxEstimate } from './services/taxReporting'
import { analyzePortfolio, getInvestmentAdvice } from './services/aiAdvisor'
import { getDividendSummary, getDividendCalendar, DividendEvent } from './services/dividendTracker'
import { getEarningsCalendar, EarningsEvent, getEarningsImpactColor, getEarningsTimeLabel } from './services/earningsCalendar'
import { downloadCsv, importFromCsv, downloadTemplate, CsvPosition } from './services/csvImportExport'
import { 
  Task, createTask, updateTaskStatus, getTasks, saveTasks, 
  getTodaysTasks, getOverdueTasks, sortByPriority, getCompletionStats,
  getSuggestedFocusTask, suggestTimeBlocks,
  RecurringTaskTemplate, getRecurringTemplates, saveRecurringTemplate, 
  deleteRecurringTemplate, generateRecurringTasksForToday, initializeRecurringTasks,
  completeRecurringTask
} from './services/taskManager'
import { getPendingReminders, generateDailySummary, getFocusNotification } from './services/notifications'
import { 
  isGoogleAuthenticated, getGoogleAuthUrl, handleOAuthCallback,
  fetchTodaysEvents, fetchUpcomingEvents, fetchCalendars,
  eventToTask as googleEventToTask, CalendarEvent as GoogleCalendarEvent,
  getTimeUntilEvent as getGoogleTimeUntilEvent, formatEventTime as formatGoogleEventTime,
  clearGoogleToken
} from './services/calendarSync'
import {
  fetchICalFromUrl, getTodaysEvents as getTodaysICalEvents, getUpcomingEvents as getUpcomingICalEvents,
  iCalEventToTask, getTimeUntilEvent as getICalTimeUntilEvent, formatEventTime as formatICalEventTime,
  saveICalUrl, getICalUrl, clearICalData, saveICalEvents, getStoredICalEvents, shouldRefreshICal,
  parseICalData, ICalEvent
} from './services/iCalParser'

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

const CORRECT_PIN = '4520'

export default function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const authTime = localStorage.getItem('alpha-forge-auth-time')
    if (authTime) {
      const hoursSinceAuth = (Date.now() - parseInt(authTime)) / (1000 * 60 * 60)
      return hoursSinceAuth < 8 // Stay logged in for 8 hours
    }
    return false
  })
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  
  // Load positions from localStorage or use empty initial
  const [positions, setPositions] = useState<Position[]>(() => {
    try {
      const saved = localStorage.getItem('alpha-forge-positions')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'command' | 'analysis' | 'performance' | 'tax' | 'ai' | 'dividends' | 'earnings' | 'import' | 'news'>('overview')
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
  
  // Tasks state
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('mac-tasks')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [taskFilter, setTaskFilter] = useState<'all' | 'today' | 'overdue' | 'done'>('today')
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTaskTemplate[]>(getRecurringTemplates())
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([])
  const [iCalEvents, setICalEvents] = useState<ICalEvent[]>([])
  const [googleAuthed, setGoogleAuthed] = useState(false)
  const [calendars, setCalendars] = useState<Array<{ id: string; summary: string; primary?: boolean }>>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [iCalUrl, setICalUrl] = useState(getICalUrl() || '')
  const [calendarSource, setCalendarSource] = useState<'none' | 'google' | 'ical'>(() => {
    if (isGoogleAuthenticated()) return 'google'
    if (getICalUrl()) return 'ical'
    return 'none'
  })
  
  // Initialize recurring tasks and check calendar auth on mount
  useEffect(() => {
    initializeRecurringTasks()
    // Generate recurring tasks for today
    const newRecurring = generateRecurringTasksForToday()
    if (newRecurring.length > 0) {
      setTasks(prev => [...prev, ...newRecurring])
    }
    
    // Check for OAuth callback (Google)
    const token = handleOAuthCallback()
    if (token) {
      setGoogleAuthed(true)
      setCalendarSource('google')
      loadGoogleCalendarData()
    } else if (isGoogleAuthenticated()) {
      setGoogleAuthed(true)
      setCalendarSource('google')
      loadGoogleCalendarData()
    } else if (getICalUrl()) {
      setCalendarSource('ical')
      loadICalData()
    }
  }, [])
  
  // Load Google Calendar data
  const loadGoogleCalendarData = async () => {
    setCalendarLoading(true)
    try {
      const events = await fetchTodaysEvents()
      setCalendarEvents(events)
      const cals = await fetchCalendars()
      setCalendars(cals)
    } catch (error) {
      console.error('Failed to load Google calendar:', error)
    }
    setCalendarLoading(false)
  }
  
  // Load iCal data
  const loadICalData = async () => {
    const url = getICalUrl()
    if (!url) return
    
    setCalendarLoading(true)
    try {
      // Use cached data if fresh
      if (!shouldRefreshICal()) {
        const cached = getStoredICalEvents()
        setICalEvents(cached)
        setCalendarLoading(false)
        return
      }
      
      const events = await fetchICalFromUrl(url)
      saveICalEvents(events)
      setICalEvents(events)
    } catch (error) {
      console.error('Failed to load iCal:', error)
      // Fall back to cached data
      const cached = getStoredICalEvents()
      if (cached.length > 0) {
        setICalEvents(cached)
      }
    }
    setCalendarLoading(false)
  }
  
  // Connect Google Calendar
  const connectGoogleCalendar = () => {
    window.location.href = getGoogleAuthUrl()
  }
  
  // Disconnect Google Calendar
  const disconnectGoogleCalendar = () => {
    clearGoogleToken()
    setGoogleAuthed(false)
    setCalendarEvents([])
    setCalendars([])
    setCalendarSource('none')
  }
  
  // Connect iCal URL
  const connectICal = async (url: string) => {
    setCalendarLoading(true)
    try {
      const events = await fetchICalFromUrl(url)
      console.log('Successfully fetched', events.length, 'events')
      setICalEvents(events)
      saveICalEvents(events)
      setICalUrl(url)
      saveICalUrl(url)
      setCalendarSource('ical')
      setCalendarLoading(false)
      return true
    } catch (error) {
      console.error('Failed to connect iCal:', error)
      setCalendarLoading(false)
      alert(`Failed to connect calendar: ${(error as Error).message}`)
      return false
    }
  }
  
  // Disconnect iCal
  const disconnectICal = () => {
    clearICalData()
    setICalUrl('')
    setICalEvents([])
    setCalendarSource('none')
  }
  
  // Save tasks to localStorage
  useEffect(() => {
    localStorage.setItem('mac-tasks', JSON.stringify(tasks))
  }, [tasks])
  
  // Save positions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('alpha-forge-positions', JSON.stringify(positions))
  }, [positions])
  
  // Fetch real prices via REST API with fallback (Finnhub → Alpha Vantage)
  const refreshPrices = async () => {
    setIsRefreshing(true)
    setRefreshError(null)
    
    const symbols = positions.map(p => p.ticker)
    console.log('Fetching prices for:', symbols)
    
    // Use combined service with fallback
    const quotes = await getMultiplePricesWithFallback(symbols)
    
    console.log('Received quotes:', quotes.size, 'of', symbols.length)
    
    if (quotes.size > 0) {
      const updatedPositions = positions.map(pos => {
        const quote = quotes.get(pos.ticker.toUpperCase())
        if (quote) {
          console.log(`${pos.ticker}: $${quote.price} (from ${quote.source})`)
          return { ...pos, currentPrice: quote.price }
        }
        return pos
      })
      
      setPositions(updatedPositions)
      setLastUpdate(new Date())
      
      // Subscribe to WebSocket for real-time updates
      subscribeAllToWebSocket()
    } else {
      setRefreshError('Unable to fetch live prices. Both Finnhub and Alpha Vantage failed. Check internet connection.')
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
  const handlePriceUpdate = (priceData: FinnhubPriceData) => {
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
  
  // Check if we have any real price data (MOVED UP)
  const hasPriceData = positions.some(pos => pos.currentPrice > 0)
  
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
  
  // Handle CSV import
  const handleCsvUpload = async (file: File) => {
    const result = await importFromCsv(file)
    
    if (result.errors.length > 0) {
      alert('Import errors:\n' + result.errors.join('\n'))
    }
    
    if (result.positions.length > 0) {
      const newPositions = result.positions.map(pos => ({
        ...pos,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        currentPrice: 0
      }))
      
      setPositions([...positions, ...newPositions])
      alert(`Successfully imported ${newPositions.length} positions!`)
    }
  }
  
  // Handle iCal file upload
  const handleICalUpload = async (file: File) => {
    try {
      const text = await file.text()
      console.log('Uploaded iCal file, size:', text.length)
      const events = parseICalData(text)
      console.log('Parsed events:', events.length)
      
      if (events.length === 0) {
        alert('No events found in file. Make sure it\'s a valid .ics file.')
        return
      }
      
      setICalEvents(events)
      saveICalEvents(events)
      setCalendarSource('ical')
      
      const todayEvents = getTodaysICalEvents(events)
      alert(`Success! Imported ${events.length} events. ${todayEvents.length} events today.`)
    } catch (error) {
      alert(`Failed to parse file: ${(error as Error).message}`)
    }
  }
  
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

  // Handle PIN submission
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput === CORRECT_PIN) {
      setIsAuthenticated(true)
      setPinError(false)
      localStorage.setItem('alpha-forge-auth-time', Date.now().toString())
    } else {
      setPinError(true)
      setPinInput('')
    }
  }

  // Lock dashboard
  const handleLock = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('alpha-forge-auth-time')
    setPinInput('')
  }

  // Show lock screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-hf-dark flex items-center justify-center">
        <Card className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-hf-blue to-hf-green rounded-xl flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2">ALPHA FORGE</h1>
          <p className="text-gray-400 mb-6">Enter PIN to access your dashboard</p>
          
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-12 h-14 rounded-lg border-2 flex items-center justify-center text-xl font-bold ${
                    pinError ? 'border-hf-red bg-hf-red/10' : 'border-hf-border bg-hf-dark'
                  }`}
                >
                  {pinInput[i] ? '•' : ''}
                </div>
              ))}
            </div>
            
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                setPinError(false)
              }}
              className="opacity-0 absolute"
              autoFocus
            />
            
            {pinError && (
              <p className="text-hf-red text-sm">Incorrect PIN. Try again.</p>
            )}
            
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => pinInput.length < 4 && setPinInput(pinInput + num)}
                  className="h-14 rounded-lg bg-hf-border/50 hover:bg-hf-border text-xl font-medium transition-colors"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPinInput(pinInput.slice(0, -1))}
                className="h-14 rounded-lg bg-hf-border/50 hover:bg-hf-border text-sm transition-colors"
              >
                ⌫
              </button>
              <button
                type="button"
                onClick={() => pinInput.length < 4 && setPinInput(pinInput + '0')}
                className="h-14 rounded-lg bg-hf-border/50 hover:bg-hf-border text-xl font-medium transition-colors"
              >
                0
              </button>
              <button
                type="submit"
                className="h-14 rounded-lg bg-hf-green hover:bg-green-600 text-black font-bold transition-colors"
              >
                →
              </button>
            </div>
          </form>
          
          <p className="text-xs text-gray-500 mt-6">
            Secured • Session expires after 8 hours
          </p>
        </Card>
      </div>
    )
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
              
              <button 
                onClick={handleLock}
                className="p-2 hover:bg-hf-border rounded-lg text-gray-400 hover:text-white"
                title="Lock Dashboard"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
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
            {/* Main Tabs */}
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                activeTab === 'overview' 
                  ? 'border-hf-blue text-hf-blue' 
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <PieChart size={18} />
              <span className="font-medium">Overview</span>
            </button>
            
            <button
              onClick={() => setActiveTab('command')}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                activeTab === 'command' 
                  ? 'border-hf-gold text-hf-gold' 
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Zap size={18} />
              <span className="font-medium">Command Center</span>
            </button>
            
            {/* Financial Tools Dropdown */}
            <div className="relative group">
              <button
                className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                  ['positions', 'analysis', 'performance', 'tax', 'ai', 'dividends', 'earnings', 'import'].includes(activeTab)
                    ? 'border-hf-green text-hf-green' 
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Wallet size={18} />
                <span className="font-medium">Financial Tools</span>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Dropdown Menu */}
              <div className="absolute top-full left-0 mt-0 w-56 bg-hf-card border border-hf-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="py-2">
                  <p className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">Portfolio</p>
                  <button
                    onClick={() => setActiveTab('positions')}
                    className={`w-full text-left px-4 py-2 hover:bg-hf-border/50 flex items-center gap-3 ${activeTab === 'positions' ? 'text-hf-green bg-hf-green/10' : 'text-gray-300'}`}
                  >
                    <Wallet size={16} />
                    Positions
                  </button>
                  <button
                    onClick={() => setActiveTab('analysis')}
                    className={`w-full text-left px-4 py-2 hover:bg-hf-border/50 flex items-center gap-3 ${activeTab === 'analysis' ? 'text-hf-green bg-hf-green/10' : 'text-gray-300'}`}
                  >
                    <Activity size={16} />
                    Analysis
                  </button>
                  <button
                    onClick={() => setActiveTab('performance')}
                    className={`w-full text-left px-4 py-2 hover:bg-hf-border/50 flex items-center gap-3 ${activeTab === 'performance' ? 'text-hf-green bg-hf-green/10' : 'text-gray-300'}`}
                  >
                    <BarChart3 size={16} />
                    Performance
                  </button>
                  
                  <div className="border-t border-hf-border my-2"></div>
                  <p className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">Insights</p>
                  <button
                    onClick={() => setActiveTab('dividends')}
                    className={`w-full text-left px-4 py-2 hover:bg-hf-border/50 flex items-center gap-3 ${activeTab === 'dividends' ? 'text-hf-green bg-hf-green/10' : 'text-gray-300'}`}
                  >
                    <span className="text-sm">💰</span>
                    Dividends
                  </button>
                  <button
                    onClick={() => setActiveTab('earnings')}
                    className={`w-full text-left px-4 py-2 hover:bg-hf-border/50 flex items-center gap-3 ${activeTab === 'earnings' ? 'text-hf-green bg-hf-green/10' : 'text-gray-300'}`}
                  >
                    <span className="text-sm">📊</span>
                    Earnings
                  </button>
                  <button
                    onClick={() => setActiveTab('tax')}
                    className={`w-full text-left px-4 py-2 hover:bg-hf-border/50 flex items-center gap-3 ${activeTab === 'tax' ? 'text-hf-green bg-hf-green/10' : 'text-gray-300'}`}
                  >
                    <Shield size={16} />
                    Tax Center
                  </button>
                  <button
                    onClick={() => setActiveTab('ai')}
                    className={`w-full text-left px-4 py-2 hover:bg-hf-border/50 flex items-center gap-3 ${activeTab === 'ai' ? 'text-hf-green bg-hf-green/10' : 'text-gray-300'}`}
                  >
                    <Zap size={16} />
                    AI Advisor
                  </button>
                  
                  <div className="border-t border-hf-border my-2"></div>
                  <p className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">Data</p>
                  <button
                    onClick={() => setActiveTab('import')}
                    className={`w-full text-left px-4 py-2 hover:bg-hf-border/50 flex items-center gap-3 ${activeTab === 'import' ? 'text-hf-green bg-hf-green/10' : 'text-gray-300'}`}
                  >
                    <Globe size={16} />
                    Import / Export
                  </button>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setActiveTab('news')}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                activeTab === 'news' 
                  ? 'border-hf-blue text-hf-blue' 
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Globe size={18} />
              <span className="font-medium">News</span>
            </button>
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
                        {hasPriceData ? riskMetrics.sharpeRatio.toFixed(2) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Portfolio Beta</p>
                      <p className={`text-xl font-bold ${hasPriceData ? '' : 'text-gray-600'}`}>
                        {hasPriceData ? riskMetrics.portfolioBeta.toFixed(2) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Max Drawdown</p>
                      <p className={`text-xl font-bold ${hasPriceData ? 'text-hf-red' : 'text-gray-600'}`}>
                        {hasPriceData ? `${riskMetrics.maxDrawdown.toFixed(1)}%` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Volatility (30d)</p>
                      <p className={`text-xl font-bold ${hasPriceData ? '' : 'text-gray-600'}`}>
                        {hasPriceData ? `${riskMetrics.portfolioVolatility.toFixed(1)}%` : '—'}
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

        {activeTab === 'command' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">🎯 Mac's Command Center</h2>
                <p className="text-sm text-gray-400 mt-1">Tasks, Calendar & Daily Planning</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCalendarModal(true)}
                  className="flex items-center gap-2 bg-hf-card border border-hf-border hover:border-hf-blue px-4 py-2 rounded-lg font-medium"
                >
                  📅 Calendar
                </button>
                <button
                  onClick={() => setShowRecurringModal(true)}
                  className="flex items-center gap-2 bg-hf-card border border-hf-border hover:border-hf-blue px-4 py-2 rounded-lg font-medium"
                >
                  🔄 Recurring
                </button>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="flex items-center gap-2 bg-hf-blue hover:bg-blue-600 px-4 py-2 rounded-lg font-medium"
                >
                  <Plus size={18} />
                  Add Task
                </button>
              </div>
            </div>
            
            {(() => {
              const todaysTasks = getTodaysTasks()
              const overdue = getOverdueTasks()
              const stats = getCompletionStats()
              const focusTask = getSuggestedFocusTask()
              const filteredTasks = taskFilter === 'all' ? tasks :
                taskFilter === 'today' ? todaysTasks :
                taskFilter === 'overdue' ? overdue :
                tasks.filter(t => t.status === 'done')
              const sortedTasks = sortByPriority(filteredTasks)
              
              return (
                <>
                  {/* Stats Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card>
                      <p className="text-sm text-gray-400">Today's Tasks</p>
                      <p className="text-2xl font-bold mt-1">{todaysTasks.filter(t => t.status !== 'done').length}</p>
                      <p className="text-xs text-gray-500">{todaysTasks.filter(t => t.status === 'done').length} completed</p>
                    </Card>
                    <Card>
                      <p className="text-sm text-gray-400">Overdue</p>
                      <p className={`text-2xl font-bold mt-1 ${overdue.length > 0 ? 'text-hf-red' : ''}`}>{overdue.length}</p>
                      <p className="text-xs text-gray-500">needs attention</p>
                    </Card>
                    <Card>
                      <p className="text-sm text-gray-400">Weekly Done</p>
                      <p className="text-2xl font-bold mt-1 text-hf-green">{stats.week}</p>
                      <p className="text-xs text-gray-500">tasks completed</p>
                    </Card>
                    <Card>
                      <p className="text-sm text-gray-400">Completion Rate</p>
                      <p className="text-2xl font-bold mt-1">
                        {tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0}%
                      </p>
                      <p className="text-xs text-gray-500">all time</p>
                    </Card>
                  </div>
                  
                  {/* Today's Calendar */}
                  <Card>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">📅 Today's Schedule</h3>
                      {calendarSource === 'none' ? (
                        <button
                          onClick={() => setShowCalendarModal(true)}
                          className="text-sm bg-hf-blue hover:bg-blue-600 px-3 py-1 rounded"
                        >
                          Connect Calendar
                        </button>
                      ) : (
                        <button
                          onClick={() => calendarSource === 'google' ? loadGoogleCalendarData() : loadICalData()}
                          disabled={calendarLoading}
                          className="text-sm text-hf-blue hover:text-white disabled:opacity-50"
                        >
                          {calendarLoading ? 'Loading...' : 'Refresh'}
                        </button>
                      )}
                    </div>
                    
                    {calendarSource === 'none' ? (
                      <div className="text-center py-8">
                        <p className="text-4xl mb-2">📅</p>
                        <p className="text-gray-400 mb-4">Connect your calendar to see today's events</p>
                        <button
                          onClick={() => setShowCalendarModal(true)}
                          className="bg-hf-blue hover:bg-blue-600 px-6 py-2 rounded-lg font-medium"
                        >
                          Connect Calendar
                        </button>
                      </div>
                    ) : calendarLoading ? (
                      <div className="text-center py-8 text-gray-400">
                        <p>Loading your calendar...</p>
                      </div>
                    ) : calendarSource === 'google' ? (
                      // Google Calendar events
                      calendarEvents.length === 0 ? (
                        <p className="text-gray-400 text-center py-4">No events scheduled for today. Enjoy your free time! 🎉</p>
                      ) : (
                        <div className="space-y-2">
                          {calendarEvents.map((event) => (
                            <div key={event.id} className="flex items-center gap-4 p-3 bg-hf-dark rounded-lg">
                              <div className="text-center min-w-[70px]">
                                <p className="text-sm font-bold">
                                  {formatGoogleEventTime(event.startTime)}
                                </p>
                                <p className="text-xs text-gray-500">{getGoogleTimeUntilEvent(event)}</p>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{event.title}</p>
                                {event.location && (
                                  <p className="text-xs text-gray-400 truncate">📍 {event.location}</p>
                                )}
                                {event.isRecurring && (
                                  <span className="text-xs text-hf-blue">🔄 Recurring</span>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  const task = createTask(googleEventToTask(event))
                                  setTasks([...tasks, task])
                                }}
                                className="text-xs bg-hf-border/50 hover:bg-hf-blue px-3 py-1 rounded whitespace-nowrap"
                              >
                                + Task
                              </button>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      // iCal events
                      getTodaysICalEvents(iCalEvents).length === 0 ? (
                        <p className="text-gray-400 text-center py-4">No events scheduled for today. Enjoy your free time! 🎉</p>
                      ) : (
                        <div className="space-y-2">
                          {getTodaysICalEvents(iCalEvents).map((event) => (
                            <div key={event.uid} className="flex items-center gap-4 p-3 bg-hf-dark rounded-lg">
                              <div className="text-center min-w-[70px]">
                                <p className="text-sm font-bold">
                                  {formatICalEventTime(event.startTime)}
                                </p>
                                <p className="text-xs text-gray-500">{getICalTimeUntilEvent(event)}</p>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{event.summary}</p>
                                {event.location && (
                                  <p className="text-xs text-gray-400 truncate">📍 {event.location}</p>
                                )}
                                {event.isRecurring && (
                                  <span className="text-xs text-hf-blue">🔄 Recurring</span>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  const task = createTask(iCalEventToTask(event))
                                  setTasks([...tasks, task])
                                }}
                                className="text-xs bg-hf-border/50 hover:bg-hf-blue px-3 py-1 rounded whitespace-nowrap"
                              >
                                + Task
                              </button>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </Card>
                  
                  {/* Focus Task */}
                  {focusTask && (
                    <Card className="border-hf-gold/50 bg-hf-gold/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-hf-gold font-medium mb-1">🎯 FOCUS TASK</p>
                          <h3 className="text-xl font-bold">{focusTask.title}</h3>
                          {focusTask.description && (
                            <p className="text-gray-400 mt-1">{focusTask.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-3">
                            <span className={`text-xs px-2 py-1 rounded ${
                              focusTask.priority === 'urgent' ? 'bg-hf-red text-white' :
                              focusTask.priority === 'high' ? 'bg-hf-gold text-black' :
                              focusTask.priority === 'medium' ? 'bg-hf-blue text-white' :
                              'bg-gray-600 text-white'
                            }`}>
                              {focusTask.priority.toUpperCase()}
                            </span>
                            {focusTask.dueDate && (
                              <span className="text-sm text-gray-400">Due: {focusTask.dueDate}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setTasks(tasks.map(t => t.id === focusTask.id ? { ...t, status: 'done', completedAt: new Date().toISOString() } : t))
                          }}
                          className="bg-hf-green hover:bg-green-600 text-black px-6 py-3 rounded-lg font-bold"
                        >
                          ✓ Complete
                        </button>
                      </div>
                    </Card>
                  )}
                  
                  {/* Filter Tabs */}
                  <div className="flex items-center gap-2">
                    {(['today', 'all', 'overdue', 'done'] as const).map(filter => (
                      <button
                        key={filter}
                        onClick={() => setTaskFilter(filter)}
                        className={`px-4 py-2 rounded-lg font-medium capitalize ${
                          taskFilter === filter 
                            ? 'bg-hf-blue text-white' 
                            : 'bg-hf-card border border-hf-border hover:border-hf-blue'
                        }`}
                      >
                        {filter}
                        {filter === 'overdue' && overdue.length > 0 && (
                          <span className="ml-2 bg-hf-red text-white text-xs px-2 py-0.5 rounded-full">{overdue.length}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  
                  {/* Task List */}
                  <Card>
                    <h3 className="text-lg font-bold mb-4">
                      {taskFilter === 'today' ? "Today's Tasks" :
                       taskFilter === 'overdue' ? 'Overdue Tasks' :
                       taskFilter === 'done' ? 'Completed Tasks' :
                       'All Tasks'}
                    </h3>
                    
                    {sortedTasks.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-4xl mb-2">🎉</p>
                        <p>No tasks here! You're all caught up.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sortedTasks.map(task => (
                          <div 
                            key={task.id} 
                            className={`flex items-center gap-4 p-4 rounded-lg border ${
                              task.status === 'done' ? 'bg-hf-border/20 opacity-60' :
                              task.priority === 'urgent' ? 'bg-hf-red/10 border-hf-red/30' :
                              task.priority === 'high' ? 'bg-hf-gold/10 border-hf-gold/30' :
                              'bg-hf-dark border-hf-border'
                            }`}
                          >
                            <button
                              onClick={() => {
                                const newStatus = task.status === 'done' ? 'todo' : 'done'
                                setTasks(tasks.map(t => t.id === task.id ? { 
                                  ...t, 
                                  status: newStatus,
                                  completedAt: newStatus === 'done' ? new Date().toISOString() : undefined
                                } : t))
                              }}
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                                task.status === 'done' 
                                  ? 'bg-hf-green border-hf-green' 
                                  : 'border-gray-500 hover:border-hf-blue'
                              }`}
                            >
                              {task.status === 'done' && <span className="text-black text-sm">✓</span>}
                            </button>
                            
                            <div className="flex-1">
                              <p className={`font-medium ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-sm text-gray-400">{task.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  task.priority === 'urgent' ? 'bg-hf-red text-white' :
                                  task.priority === 'high' ? 'bg-hf-gold text-black' :
                                  task.priority === 'medium' ? 'bg-hf-blue text-white' :
                                  'bg-gray-600 text-white'
                                }`}>
                                  {task.priority}
                                </span>
                                {task.dueDate && (
                                  <span className={`text-xs ${
                                    task.dueDate < new Date().toISOString().split('T')[0] 
                                      ? 'text-hf-red' 
                                      : 'text-gray-400'
                                  }`}>
                                    {task.dueDate}
                                  </span>
                                )}
                                {task.tags.map(tag => (
                                  <span key={tag} className="text-xs bg-hf-border px-2 py-0.5 rounded text-gray-400">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => setTasks(tasks.filter(t => t.id !== task.id))}
                              className="text-gray-500 hover:text-hf-red p-2"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </>
              )
            })()}
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

        {activeTab === 'dividends' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Dividend Tracker</h2>
            
            {(() => {
              const summary = getDividendSummary(positions)
              const calendar = getDividendCalendar(positions)
              return (
                <>
                  {/* Dividend Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card>
                      <p className="text-sm text-gray-400">Annual Dividend Income</p>
                      <p className="text-2xl font-bold mt-1 text-hf-green">
                        ${summary.annualIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </Card>
                    <Card>
                      <p className="text-sm text-gray-400">Monthly Average</p>
                      <p className="text-2xl font-bold mt-1">
                        ${summary.monthlyAverage.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </Card>
                    <Card>
                      <p className="text-sm text-gray-400">Portfolio Yield</p>
                      <p className="text-2xl font-bold mt-1">
                        {summary.portfolioYield.toFixed(2)}%
                      </p>
                    </Card>
                    <Card>
                      <p className="text-sm text-gray-400">Yield on Cost</p>
                      <p className="text-2xl font-bold mt-1">
                        {summary.yieldOnCost.toFixed(2)}%
                      </p>
                    </Card>
                  </div>
                  
                  {/* Upcoming Dividends */}
                  <Card>
                    <h3 className="text-lg font-bold mb-4">📅 Upcoming Dividends</h3>
                    {calendar.length === 0 ? (
                      <p className="text-gray-400">No dividend-paying stocks in portfolio.</p>
                    ) : (
                      <div className="space-y-3">
                        {calendar.slice(0, 10).map((div, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-hf-dark rounded-lg">
                            <div className="flex items-center gap-4">
                              <span className="font-mono font-bold text-hf-blue">{div.ticker}</span>
                              <div>
                                <p className="text-sm">${div.amount.toFixed(2)}/share</p>
                                <p className="text-xs text-gray-400">{div.frequency}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm">Ex-Date: <span className="text-hf-gold">{div.exDate}</span></p>
                              <p className="text-xs text-gray-400">Pay Date: {div.payDate}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                  
                  {/* Recent Payments */}
                  <Card>
                    <h3 className="text-lg font-bold mb-4">💰 Recent Payments</h3>
                    {summary.recentPayments.length === 0 ? (
                      <p className="text-gray-400">No recent dividend payments.</p>
                    ) : (
                      <div className="space-y-2">
                        {summary.recentPayments.map((payment, i) => (
                          <div key={i} className="flex items-center justify-between p-2 hover:bg-hf-border/30 rounded">
                            <span className="font-mono">{payment.ticker}</span>
                            <span className="text-hf-green">+${payment.amount.toFixed(2)}</span>
                            <span className="text-sm text-gray-400">{payment.payDate}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </>
              )
            })()}
          </div>
        )}

        {activeTab === 'earnings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Earnings Calendar</h2>
            
            {(() => {
              const earnings = getEarningsCalendar(positions)
              return (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card>
                      <p className="text-sm text-gray-400">This Week</p>
                      <p className="text-2xl font-bold mt-1">{earnings.thisWeek.length}</p>
                      <p className="text-xs text-gray-500">companies reporting</p>
                    </Card>
                    <Card>
                      <p className="text-sm text-gray-400">Next Week</p>
                      <p className="text-2xl font-bold mt-1">{earnings.nextWeek.length}</p>
                    </Card>
                    <Card>
                      <p className="text-sm text-gray-400">This Month</p>
                      <p className="text-2xl font-bold mt-1">{earnings.thisMonth.length}</p>
                    </Card>
                    <Card>
                      <p className="text-sm text-gray-400">High Impact</p>
                      <p className="text-2xl font-bold mt-1 text-hf-gold">{earnings.highImpactEvents.length}</p>
                    </Card>
                  </div>
                  
                  {/* This Week's Earnings */}
                  <Card>
                    <h3 className="text-lg font-bold mb-4">📊 This Week</h3>
                    {earnings.thisWeek.length === 0 ? (
                      <p className="text-gray-400">No earnings reports this week.</p>
                    ) : (
                      <div className="space-y-3">
                        {earnings.thisWeek.map((event, i) => (
                          <div key={i} className="p-3 bg-hf-dark rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold">{event.ticker}</span>
                                <span className="text-sm text-gray-400">{event.companyName}</span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded ${
                                event.reportTime === 'before' ? 'bg-hf-green text-black' :
                                event.reportTime === 'after' ? 'bg-hf-blue text-white' :
                                'bg-hf-gold text-black'
                              }`}>
                                {getEarningsTimeLabel(event.reportTime)}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-400">EPS Est:</span>
                                <span className="ml-2">${event.epsEstimate.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Rev Est:</span>
                                <span className="ml-2">${(event.revenueEstimate / 1e9).toFixed(1)}B</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Beat Rate:</span>
                                <span className={`ml-2 ${getEarningsImpactColor(event.historicalBeatRate)}`}>
                                  {event.historicalBeatRate}%
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">{event.reportDate}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </>
              )
            })()}
          </div>
        )}

        {activeTab === 'import' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Import / Export</h2>
            
            {/* Export Section */}
            <Card>
              <h3 className="text-lg font-bold mb-4">📥 Export Portfolio</h3>
              <p className="text-sm text-gray-400 mb-4">
                Download your portfolio as CSV for backup or tax reporting.
              </p>
              <button 
                onClick={() => downloadCsv(positions)}
                className="bg-hf-blue hover:bg-blue-600 px-6 py-3 rounded-lg font-medium"
              >
                Download CSV
              </button>
            </Card>
            
            {/* Import Section */}
            <Card>
              <h3 className="text-lg font-bold mb-4">📤 Import Portfolio</h3>
              <p className="text-sm text-gray-400 mb-4">
                Upload positions from CSV file. Format: Ticker, Name, Shares, Avg Price, Sector, Type
              </p>
              
              <div className="space-y-4">
                <div 
                  className="border-2 border-dashed border-hf-border rounded-lg p-8 text-center hover:border-hf-blue cursor-pointer transition-colors"
                  onClick={() => document.getElementById('csv-upload')?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files[0]
                    if (file) handleCsvUpload(file)
                  }}
                >
                  <p className="text-gray-400">Click or drag CSV file here</p>
                  <input 
                    id="csv-upload" 
                    type="file" 
                    accept=".csv" 
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleCsvUpload(e.target.files[0])}
                  />
                </div>
                
                <button 
                  onClick={downloadTemplate}
                  className="text-sm text-hf-blue hover:text-white underline"
                >
                  Download CSV Template
                </button>
              </div>
            </Card>
            
            {/* Sample Format */}
            <Card>
              <h3 className="text-lg font-bold mb-4">CSV Format Example</h3>
              <pre className="bg-hf-dark p-4 rounded-lg text-sm overflow-x-auto">
{`Ticker,Name,Shares,Avg Price,Sector,Type
AAPL,Apple Inc.,100,175.50,Technology,stock
MSFT,Microsoft Corp.,50,380.00,Technology,stock
BTC,Bitcoin,0.5,42000,Crypto,crypto`}
              </pre>
            </Card>
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

      {/* Add Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add New Task</h3>
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const newTask = createTask({
                title: formData.get('title') as string,
                description: formData.get('description') as string,
                priority: formData.get('priority') as Task['priority'],
                dueDate: formData.get('dueDate') as string,
                tags: (formData.get('tags') as string).split(',').map(t => t.trim()).filter(Boolean),
                estimatedMinutes: Number(formData.get('estimatedMinutes')) || undefined
              })
              setTasks([...tasks, newTask])
              setShowTaskModal(false)
            }} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Task Title *</label>
                <input name="title" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1" placeholder="What needs to be done?" required />
              </div>
              <div>
                <label className="text-sm text-gray-400">Description</label>
                <textarea name="description" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1 h-20" placeholder="Add details..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Priority</label>
                  <select name="priority" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Due Date</label>
                  <input name="dueDate" type="date" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Tags (comma separated)</label>
                  <input name="tags" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1" placeholder="work, personal, urgent" />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Est. Minutes</label>
                  <input name="estimatedMinutes" type="number" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-1" placeholder="e.g., 30" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowTaskModal(false)} className="flex-1 py-2 border border-hf-border rounded-lg hover:bg-hf-border transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2 bg-hf-green hover:bg-green-600 text-black rounded-lg font-medium transition-colors">
                  Add Task
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Recurring Tasks Modal */}
      {showRecurringModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">🔄 Recurring Tasks</h3>
            <p className="text-sm text-gray-400 mb-4">Tasks that automatically repeat based on schedule</p>
            
            <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
              {recurringTemplates.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No recurring tasks set up yet.</p>
              ) : (
                recurringTemplates.map(template => (
                  <div key={template.id} className="flex items-center justify-between p-3 bg-hf-dark rounded-lg">
                    <div>
                      <p className="font-medium">{template.title}</p>
                      <p className="text-sm text-gray-400">
                        {template.recurrencePattern} • {template.priority} priority
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        deleteRecurringTemplate(template.id)
                        setRecurringTemplates(getRecurringTemplates())
                      }}
                      className="text-gray-500 hover:text-hf-red p-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              saveRecurringTemplate({
                title: formData.get('title') as string,
                description: formData.get('description') as string,
                priority: formData.get('priority') as Task['priority'],
                tags: (formData.get('tags') as string).split(',').map(t => t.trim()).filter(Boolean),
                recurrencePattern: formData.get('pattern') as RecurringTaskTemplate['recurrencePattern'],
                startDate: new Date().toISOString().split('T')[0],
                estimatedMinutes: Number(formData.get('estimatedMinutes')) || undefined
              })
              setRecurringTemplates(getRecurringTemplates())
              e.currentTarget.reset()
            }} className="border-t border-hf-border pt-4">
              <p className="text-sm font-medium mb-3">Add New Recurring Task</p>
              <div className="grid grid-cols-2 gap-3">
                <input name="title" placeholder="Task name" className="bg-hf-dark border border-hf-border rounded-lg p-2" required />
                <select name="pattern" className="bg-hf-dark border border-hf-border rounded-lg p-2">
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays only</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <select name="priority" className="bg-hf-dark border border-hf-border rounded-lg p-2">
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
                <input name="estimatedMinutes" type="number" placeholder="Minutes" className="bg-hf-dark border border-hf-border rounded-lg p-2" />
              </div>
              <input name="tags" placeholder="Tags (comma separated)" className="w-full bg-hf-dark border border-hf-border rounded-lg p-2 mt-2" />
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowRecurringModal(false)} className="flex-1 py-2 border border-hf-border rounded-lg hover:bg-hf-border">
                  Close
                </button>
                <button type="submit" className="flex-1 py-2 bg-hf-blue hover:bg-blue-600 rounded-lg font-medium">
                  Add Recurring
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Calendar Sync Modal */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">📅 Calendar Integration</h3>
            
            {calendarSource === 'none' ? (
              <>
                <p className="text-sm text-gray-400 mb-4">Choose how to connect your calendar</p>
                
                {/* iCal URL Option */}
                <div className="bg-hf-dark rounded-lg p-4 mb-4">
                  <p className="font-medium mb-2">📎 iCal URL (Recommended)</p>
                  <p className="text-sm text-gray-400 mb-3">Paste your Google Calendar's secret iCal URL</p>
                  <div className="space-y-2">
                    <input
                      type="url"
                      value={iCalUrl}
                      onChange={(e) => setICalUrl(e.target.value)}
                      placeholder="https://calendar.google.com/calendar/ical/..."
                      className="w-full bg-hf-border/50 border border-hf-border rounded-lg p-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (!iCalUrl.includes('.ics')) {
                            alert('Please enter a valid iCal URL (should end with .ics)')
                            return
                          }
                          setCalendarLoading(true)
                          try {
                            const success = await connectICal(iCalUrl)
                            if (success) {
                              setShowCalendarModal(false)
                              alert(`Connected! Found ${getTodaysICalEvents(iCalEvents).length} events for today.`)
                            }
                          } catch (error) {
                            alert(`Failed: ${(error as Error).message}`)
                          }
                          setCalendarLoading(false)
                        }}
                        disabled={!iCalUrl || calendarLoading}
                        className="flex-1 bg-hf-green hover:bg-green-600 text-black px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                      >
                        {calendarLoading ? 'Connecting...' : 'Connect'}
                      </button>
                      <button
                        onClick={async () => {
                          if (!iCalUrl.includes('.ics')) {
                            alert('Please enter a valid iCal URL')
                            return
                          }
                          setCalendarLoading(true)
                          try {
                            const events = await fetchICalFromUrl(iCalUrl)
                            alert(`Test successful! Found ${events.length} total events, ${getTodaysICalEvents(events).length} for today.`)
                          } catch (error) {
                            alert(`Test failed: ${(error as Error).message}`)
                          }
                          setCalendarLoading(false)
                        }}
                        disabled={!iCalUrl || calendarLoading}
                        className="bg-hf-blue hover:bg-blue-600 px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                      >
                        {calendarLoading ? 'Testing...' : 'Test'}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Find it in Google Calendar → Settings → Integrate calendar → Secret address
                  </p>
                </div>
                
                {/* Divider */}
                <div className="flex items-center gap-4 my-4">
                  <div className="flex-1 h-px bg-hf-border"></div>
                  <span className="text-sm text-gray-500">OR</span>
                  <div className="flex-1 h-px bg-hf-border"></div>
                </div>
                
                {/* File Upload Option */}
                <div className="bg-hf-dark rounded-lg p-4 mb-4">
                  <p className="font-medium mb-2">📁 Upload .ics File</p>
                  <p className="text-sm text-gray-400 mb-3">Export your calendar and upload the file</p>
                  <div 
                    className="border-2 border-dashed border-hf-border rounded-lg p-6 text-center hover:border-hf-blue cursor-pointer transition-colors"
                    onClick={() => document.getElementById('ical-upload')?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files[0]
                      if (file && file.name.endsWith('.ics')) {
                        handleICalUpload(file)
                      } else {
                        alert('Please upload a .ics file')
                      }
                    }}
                  >
                    <p className="text-gray-400 mb-2">Click or drag .ics file here</p>
                    <p className="text-xs text-gray-500">Export from Google Calendar Settings</p>
                    <input 
                      id="ical-upload" 
                      type="file" 
                      accept=".ics" 
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleICalUpload(file)
                        }
                      }}
                    />
                  </div>
                </div>
                
                {/* Divider */}
                <div className="flex items-center gap-4 my-4">
                  <div className="flex-1 h-px bg-hf-border"></div>
                  <span className="text-sm text-gray-500">OR</span>
                  <div className="flex-1 h-px bg-hf-border"></div>
                </div>
                
                {/* Google OAuth Option */}
                <div className="bg-hf-dark rounded-lg p-4">
                  <p className="font-medium mb-2">🔐 Google Sign-In</p>
                  <p className="text-sm text-gray-400 mb-3">Connect directly with your Google account</p>
                  <button 
                    onClick={connectGoogleCalendar}
                    className="w-full bg-hf-blue hover:bg-blue-600 px-4 py-2 rounded-lg font-medium"
                  >
                    Connect Google Calendar
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Requires app verification (may show "unverified app" warning)
                  </p>
                </div>
                
                <div className="flex justify-center mt-4">
                  <button 
                    onClick={() => setShowCalendarModal(false)} 
                    className="text-gray-500 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : calendarSource === 'google' ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-green-400">✓ Connected to Google Calendar</p>
                  <button 
                    onClick={disconnectGoogleCalendar}
                    className="text-xs text-hf-red hover:text-red-400"
                  >
                    Disconnect
                  </button>
                </div>
                
                <div className="space-y-3 mb-6 max-h-48 overflow-y-auto">
                  {calendars.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">Loading calendars...</p>
                  ) : (
                    calendars.map(calendar => (
                      <div key={calendar.id} className="flex items-center justify-between p-3 bg-hf-dark rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">📅</span>
                          <span>{calendar.summary}</span>
                          {calendar.primary && (
                            <span className="text-xs bg-hf-blue/30 text-hf-blue px-2 py-0.5 rounded">Primary</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="border-t border-hf-border pt-4">
                  <p className="text-sm font-medium mb-3">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={async () => {
                        try {
                          const events = await fetchUpcomingEvents(7)
                          const newTasks = events.map(googleEventToTask).map(createTask)
                          setTasks([...tasks, ...newTasks])
                          setShowCalendarModal(false)
                        } catch (error) {
                          alert('Failed to sync events')
                        }
                      }}
                      className="p-3 bg-hf-dark rounded-lg hover:bg-hf-border text-left"
                    >
                      <p className="font-medium text-sm">Sync Next 7 Days</p>
                      <p className="text-xs text-gray-500">Import all events as tasks</p>
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const events = await fetchTodaysEvents()
                          const newTasks = events.map(googleEventToTask).map(createTask)
                          setTasks([...tasks, ...newTasks])
                          setShowCalendarModal(false)
                        } catch (error) {
                          alert('Failed to sync events')
                        }
                      }}
                      className="p-3 bg-hf-dark rounded-lg hover:bg-hf-border text-left"
                    >
                      <p className="font-medium text-sm">Sync Today Only</p>
                      <p className="text-xs text-gray-500">Import today's events</p>
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={() => setShowCalendarModal(false)} 
                    className="flex-1 py-2 border border-hf-border rounded-lg hover:bg-hf-border"
                  >
                    Close
                  </button>
                  <button 
                    onClick={loadGoogleCalendarData}
                    disabled={calendarLoading}
                    className="flex-1 py-2 bg-hf-blue hover:bg-blue-600 rounded-lg font-medium disabled:opacity-50"
                  >
                    {calendarLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </>
            ) : (
              // iCal Connected
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-green-400">✓ Connected via iCal URL</p>
                  <button 
                    onClick={disconnectICal}
                    className="text-xs text-hf-red hover:text-red-400"
                  >
                    Disconnect
                  </button>
                </div>
                
                <div className="bg-hf-dark rounded-lg p-3 mb-6">
                  <p className="text-xs text-gray-500 mb-1">Connected URL:</p>
                  <p className="text-sm truncate">{iCalUrl}</p>
                </div>
                
                <div className="border-t border-hf-border pt-4">
                  <p className="text-sm font-medium mb-3">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        const events = getUpcomingICalEvents(iCalEvents, 7)
                        const newTasks = events.map(iCalEventToTask).map(createTask)
                        setTasks([...tasks, ...newTasks])
                        setShowCalendarModal(false)
                      }}
                      className="p-3 bg-hf-dark rounded-lg hover:bg-hf-border text-left"
                    >
                      <p className="font-medium text-sm">Sync Next 7 Days</p>
                      <p className="text-xs text-gray-500">Import all events as tasks</p>
                    </button>
                    <button
                      onClick={() => {
                        const events = getTodaysICalEvents(iCalEvents)
                        const newTasks = events.map(iCalEventToTask).map(createTask)
                        setTasks([...tasks, ...newTasks])
                        setShowCalendarModal(false)
                      }}
                      className="p-3 bg-hf-dark rounded-lg hover:bg-hf-border text-left"
                    >
                      <p className="font-medium text-sm">Sync Today Only</p>
                      <p className="text-xs text-gray-500">Import today's events</p>
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={() => setShowCalendarModal(false)} 
                    className="flex-1 py-2 border border-hf-border rounded-lg hover:bg-hf-border"
                  >
                    Close
                  </button>
                  <button 
                    onClick={loadICalData}
                    disabled={calendarLoading}
                    className="flex-1 py-2 bg-hf-blue hover:bg-blue-600 rounded-lg font-medium disabled:opacity-50"
                  >
                    {calendarLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}