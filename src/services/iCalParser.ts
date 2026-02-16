// iCal Calendar Parser - Alternative to Google OAuth
import { Task, createTask } from './taskManager'

export interface ICalEvent {
  uid: string
  summary: string
  description?: string
  startTime: Date
  endTime: Date
  location?: string
  isRecurring: boolean
  rrule?: string
}

// Parse iCal data from URL or content
export async function fetchICalFromUrl(url: string): Promise<ICalEvent[]> {
  try {
    // Use a CORS proxy or fetch directly if server allows
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/calendar, application/octet-stream'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status}`)
    }
    
    const icalData = await response.text()
    return parseICalData(icalData)
  } catch (error) {
    console.error('Failed to fetch iCal:', error)
    throw new Error('Could not fetch calendar. Make sure the URL is correct and publicly accessible.')
  }
}

// Parse iCal data string
export function parseICalData(data: string): ICalEvent[] {
  const events: ICalEvent[] = []
  const lines = data.split(/\r?\n/)
  
  let currentEvent: Partial<ICalEvent> | null = null
  let inEvent = false
  let inTimezone = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Handle line folding (lines starting with space are continuations)
    if (line.startsWith(' ') && i > 0) {
      continue // Skip folded lines for now
    }
    
    // Start of event
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      currentEvent = {}
      continue
    }
    
    // End of event
    if (line === 'END:VEVENT') {
      if (currentEvent && currentEvent.uid && currentEvent.summary && currentEvent.startTime) {
        events.push(currentEvent as ICalEvent)
      }
      inEvent = false
      currentEvent = null
      continue
    }
    
    // Skip timezone definitions
    if (line === 'BEGIN:VTIMEZONE') {
      inTimezone = true
      continue
    }
    if (line === 'END:VTIMEZONE') {
      inTimezone = false
      continue
    }
    if (inTimezone) continue
    
    // Skip if not in an event
    if (!inEvent || !currentEvent) continue
    
    // Parse event properties
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    
    const property = line.substring(0, colonIndex)
    const value = line.substring(colonIndex + 1)
    
    // Handle properties with parameters (e.g., DTSTART;TZID=America/Los_Angeles:20240101T090000)
    const propName = property.split(';')[0]
    
    switch (propName) {
      case 'UID':
        currentEvent.uid = value
        break
      case 'SUMMARY':
        currentEvent.summary = value
        break
      case 'DESCRIPTION':
        currentEvent.description = value
        break
      case 'LOCATION':
        currentEvent.location = value
        break
      case 'DTSTART':
        currentEvent.startTime = parseICalDate(value, property)
        break
      case 'DTEND':
        currentEvent.endTime = parseICalDate(value, property)
        break
      case 'RRULE':
        currentEvent.rrule = value
        currentEvent.isRecurring = true
        break
      case 'RECURRENCE-ID':
        currentEvent.isRecurring = true
        break
    }
  }
  
  return events.filter(e => e.startTime && !isNaN(e.startTime.getTime()))
}

// Parse iCal date/time format
function parseICalDate(value: string, property: string): Date {
  // Check if it has a TZID parameter
  const hasTZ = property.includes('TZID=')
  
  // Handle UTC format (ends with Z)
  if (value.endsWith('Z')) {
    return new Date(
      parseInt(value.slice(0, 4)),
      parseInt(value.slice(4, 6)) - 1,
      parseInt(value.slice(6, 8)),
      parseInt(value.slice(9, 11)),
      parseInt(value.slice(11, 13)),
      parseInt(value.slice(13, 15))
    )
  }
  
  // Handle date-only format (YYYYMMDD)
  if (value.length === 8) {
    return new Date(
      parseInt(value.slice(0, 4)),
      parseInt(value.slice(4, 6)) - 1,
      parseInt(value.slice(6, 8))
    )
  }
  
  // Handle date-time format (YYYYMMDDTHHMMSS)
  if (value.length >= 15) {
    return new Date(
      parseInt(value.slice(0, 4)),
      parseInt(value.slice(4, 6)) - 1,
      parseInt(value.slice(6, 8)),
      parseInt(value.slice(9, 11)),
      parseInt(value.slice(11, 13)),
      parseInt(value.slice(13, 15))
    )
  }
  
  // Fallback: try parsing as ISO string
  return new Date(value)
}

// Get today's events from iCal
export function getTodaysEvents(events: ICalEvent[]): ICalEvent[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  return events.filter(event => {
    const eventDate = new Date(event.startTime)
    return eventDate >= today && eventDate < tomorrow
  }).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

// Get upcoming events (next N days)
export function getUpcomingEvents(events: ICalEvent[], days: number = 7): ICalEvent[] {
  const now = new Date()
  const future = new Date(now)
  future.setDate(future.getDate() + days)
  
  return events.filter(event => {
    const eventDate = new Date(event.startTime)
    return eventDate >= now && eventDate <= future
  }).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

// Convert iCal event to task
export function iCalEventToTask(event: ICalEvent): Omit<Task, 'id' | 'createdAt' | 'status'> {
  const durationMinutes = Math.round(
    (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60)
  )
  
  return {
    title: `📅 ${event.summary}`,
    description: event.description || `Calendar event${event.location ? ` at ${event.location}` : ''}`,
    priority: 'medium',
    dueDate: event.startTime.toISOString().split('T')[0],
    tags: ['calendar', 'meeting'],
    estimatedMinutes: durationMinutes > 0 ? durationMinutes : undefined
  }
}

// Get time until event
export function getTimeUntilEvent(event: ICalEvent): string {
  const now = new Date()
  const eventTime = new Date(event.startTime)
  const diffMs = eventTime.getTime() - now.getTime()
  
  if (diffMs < 0) {
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
export function formatEventTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

// Storage for iCal URL
const ICAL_URL_KEY = 'mac-ical-url'
const ICAL_EVENTS_KEY = 'mac-ical-events'
const ICAL_LAST_FETCH_KEY = 'mac-ical-last-fetch'

export function saveICalUrl(url: string): void {
  localStorage.setItem(ICAL_URL_KEY, url)
}

export function getICalUrl(): string | null {
  return localStorage.getItem(ICAL_URL_KEY)
}

export function clearICalData(): void {
  localStorage.removeItem(ICAL_URL_KEY)
  localStorage.removeItem(ICAL_EVENTS_KEY)
  localStorage.removeItem(ICAL_LAST_FETCH_KEY)
}

export function saveICalEvents(events: ICalEvent[]): void {
  localStorage.setItem(ICAL_EVENTS_KEY, JSON.stringify(events))
  localStorage.setItem(ICAL_LAST_FETCH_KEY, Date.now().toString())
}

export function getStoredICalEvents(): ICalEvent[] {
  const stored = localStorage.getItem(ICAL_EVENTS_KEY)
  if (!stored) return []
  
  // Parse and convert date strings back to Date objects
  const parsed = JSON.parse(stored)
  return parsed.map((e: any) => ({
    ...e,
    startTime: new Date(e.startTime),
    endTime: new Date(e.endTime)
  }))
}

// Check if we need to refresh (older than 15 minutes)
export function shouldRefreshICal(): boolean {
  const lastFetch = localStorage.getItem(ICAL_LAST_FETCH_KEY)
  if (!lastFetch) return true
  
  const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000)
  return parseInt(lastFetch) < fifteenMinutesAgo
}