// Google Calendar Sync Service - Real Implementation
import { Task, createTask } from './taskManager'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startTime: string
  endTime: string
  location?: string
  isRecurring: boolean
}

// Google OAuth Configuration
const CLIENT_ID = '86434463384-s26qpi8jejpgnqb1fduqq0dhmcf72qr2.apps.googleusercontent.com'
const CLIENT_SECRET = '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'
const REDIRECT_URI = typeof window !== 'undefined' ? window.location.origin + '/' : 'https://alpha-forge-kfu7.vercel.app/'
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'

// Token storage
const TOKEN_KEY = 'google-calendar-token'
const TOKEN_EXPIRY_KEY = 'google-calendar-token-expiry'

export interface GoogleToken {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

// Check if user is authenticated with Google
export function isGoogleAuthenticated(): boolean {
  const token = localStorage.getItem(TOKEN_KEY)
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
  
  if (!token || !expiry) return false
  
  // Check if token is expired
  return Date.now() < parseInt(expiry)
}

// Get stored token
export function getGoogleToken(): GoogleToken | null {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? JSON.parse(token) : null
}

// Save token
export function saveGoogleToken(token: GoogleToken): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
  // Calculate expiry time (token.expires_in is in seconds)
  const expiryTime = Date.now() + (token.expires_in * 1000)
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
}

// Clear token (logout)
export function clearGoogleToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
}

// Generate Google OAuth URL
export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    state: 'google-calendar-auth'
  })
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

// Handle OAuth callback (extract token from URL hash)
export function handleOAuthCallback(): GoogleToken | null {
  const hash = window.location.hash
  if (!hash) return null
  
  const params = new URLSearchParams(hash.substring(1))
  const accessToken = params.get('access_token')
  const expiresIn = params.get('expires_in')
  const tokenType = params.get('token_type')
  const scope = params.get('scope')
  const state = params.get('state')
  
  // Verify state to prevent CSRF
  if (state !== 'google-calendar-auth') {
    console.error('Invalid state parameter')
    return null
  }
  
  if (accessToken && expiresIn && tokenType) {
    const token: GoogleToken = {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: parseInt(expiresIn),
      scope: scope || ''
    }
    
    saveGoogleToken(token)
    
    // Clear the URL hash
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
    
    return token
  }
  
  return null
}

// Refresh token if needed (Google tokens can't be refreshed without refresh token, so we just check)
export async function ensureValidToken(): Promise<string | null> {
  if (!isGoogleAuthenticated()) {
    return null
  }
  
  const token = getGoogleToken()
  return token?.access_token || null
}

// Fetch calendars list
export async function fetchCalendars(): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
  const token = await ensureValidToken()
  if (!token) throw new Error('Not authenticated')
  
  const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  })
  
  if (!response.ok) {
    if (response.status === 401) {
      clearGoogleToken()
      throw new Error('Session expired. Please reconnect.')
    }
    throw new Error(`Failed to fetch calendars: ${response.status}`)
  }
  
  const data = await response.json()
  return data.items.map((cal: any) => ({
    id: cal.id,
    summary: cal.summary,
    primary: cal.primary
  }))
}

// Fetch events from a calendar
export async function fetchCalendarEvents(
  calendarId: string = 'primary',
  timeMin?: string,
  timeMax?: string,
  maxResults: number = 50
): Promise<CalendarEvent[]> {
  const token = await ensureValidToken()
  if (!token) throw new Error('Not authenticated')
  
  const now = new Date()
  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
    orderBy: 'startTime',
    singleEvents: 'true',
    timeMin: timeMin || now.toISOString()
  })
  
  if (timeMax) {
    params.append('timeMax', timeMax)
  }
  
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    }
  )
  
  if (!response.ok) {
    if (response.status === 401) {
      clearGoogleToken()
      throw new Error('Session expired. Please reconnect.')
    }
    throw new Error(`Failed to fetch events: ${response.status}`)
  }
  
  const data = await response.json()
  
  return data.items.map((event: any): CalendarEvent => ({
    id: event.id,
    title: event.summary || 'Untitled Event',
    description: event.description,
    startTime: event.start.dateTime || event.start.date,
    endTime: event.end.dateTime || event.end.date,
    location: event.location,
    isRecurring: !!event.recurringEventId
  }))
}

// Fetch today's events from primary calendar
export async function fetchTodaysEvents(): Promise<CalendarEvent[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  return fetchCalendarEvents('primary', today.toISOString(), tomorrow.toISOString())
}

// Fetch upcoming events (next 7 days)
export async function fetchUpcomingEvents(days: number = 7): Promise<CalendarEvent[]> {
  const now = new Date()
  
  const future = new Date(now)
  future.setDate(future.getDate() + days)
  
  return fetchCalendarEvents('primary', now.toISOString(), future.toISOString(), 100)
}

// Convert calendar event to task
export function eventToTask(event: CalendarEvent): Omit<Task, 'id' | 'createdAt' | 'status'> {
  const startTime = new Date(event.startTime)
  const endTime = new Date(event.endTime)
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
  
  return {
    title: `📅 ${event.title}`,
    description: event.description || `Calendar event${event.location ? ` at ${event.location}` : ''}`,
    priority: 'medium',
    dueDate: event.startTime.split('T')[0],
    tags: ['calendar', 'meeting'],
    estimatedMinutes: durationMinutes > 0 ? durationMinutes : undefined
  }
}

// Get time until event
export function getTimeUntilEvent(event: CalendarEvent): string {
  const now = new Date()
  const eventTime = new Date(event.startTime)
  const diffMs = eventTime.getTime() - now.getTime()
  
  if (diffMs < 0) {
    // Event already started
    const endTime = new Date(event.endTime)
    if (now < endTime) return 'In progress'
    return 'Ended'
  }
  
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`
  if (diffHours > 0) return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`
  if (diffMins > 0) return `in ${diffMins} min`
  return 'Now'
}

// Format time for display
export function formatEventTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}