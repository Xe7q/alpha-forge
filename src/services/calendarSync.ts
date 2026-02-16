// Google Calendar Sync Service
import { Task, createTask } from './taskManager'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startTime: string
  endTime: string
  location?: string
  isRecurring: boolean
  recurrenceRule?: string
}

// Google Calendar API configuration
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID' // User would need to set this
const API_KEY = 'YOUR_GOOGLE_API_KEY'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'

// For now, use localStorage mock sync (real Google Calendar requires OAuth setup)
export interface SyncedCalendar {
  id: string
  name: string
  color: string
  enabled: boolean
  lastSync: string
}

// Get connected calendars from localStorage
export function getConnectedCalendars(): SyncedCalendar[] {
  const stored = localStorage.getItem('mac-connected-calendars')
  if (stored) return JSON.parse(stored)
  
  // Default calendars (mock for now)
  return [
    { id: 'primary', name: 'My Calendar', color: '#2979ff', enabled: true, lastSync: '' },
    { id: 'work', name: 'Work', color: '#00c853', enabled: false, lastSync: '' },
    { id: 'personal', name: 'Personal', color: '#ffd700', enabled: false, lastSync: '' }
  ]
}

export function saveConnectedCalendars(calendars: SyncedCalendar[]): void {
  localStorage.setItem('mac-connected-calendars', JSON.stringify(calendars))
}

// Mock calendar events (in real implementation, this would fetch from Google)
export function getMockCalendarEvents(date: string): CalendarEvent[] {
  const dayOfWeek = new Date(date).getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  
  const events: CalendarEvent[] = []
  
  // Morning routine
  if (!isWeekend) {
    events.push({
      id: 'cal-1',
      title: 'Daily Standup',
      startTime: `${date}T09:00:00`,
      endTime: `${date}T09:30:00`,
      isRecurring: true,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
    })
  }
  
  // Sample events
  events.push({
    id: 'cal-2',
    title: 'Portfolio Review',
    startTime: `${date}T10:00:00`,
    endTime: `${date}T11:00:00`,
    isRecurring: false
  })
  
  events.push({
    id: 'cal-3',
    title: 'Lunch Break',
    startTime: `${date}T12:00:00`,
    endTime: `${date}T13:00:00`,
    isRecurring: true,
    recurrenceRule: 'FREQ=DAILY'
  })
  
  if (!isWeekend) {
    events.push({
      id: 'cal-4',
      title: 'Team Sync',
      startTime: `${date}T14:00:00`,
      endTime: `${date}T15:00:00`,
      isRecurring: true,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=WE'
    })
  }
  
  return events.sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )
}

// Convert calendar event to task
export function eventToTask(event: CalendarEvent): Omit<Task, 'id' | 'createdAt' | 'status'> {
  return {
    title: `📅 ${event.title}`,
    description: event.description || `Calendar event at ${formatTime(event.startTime)}`,
    priority: 'medium',
    dueDate: event.startTime.split('T')[0],
    tags: ['calendar', 'meeting'],
    estimatedMinutes: getDurationMinutes(event.startTime, event.endTime)
  }
}

// Get today's calendar events
export function getTodaysCalendarEvents(): CalendarEvent[] {
  const today = new Date().toISOString().split('T')[0]
  return getMockCalendarEvents(today)
}

// Get upcoming events (next 7 days)
export function getUpcomingEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date()
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]
    events.push(...getMockCalendarEvents(dateStr))
  }
  return events
}

// Sync calendar events to tasks
export function syncCalendarToTasks(): Task[] {
  const events = getTodaysCalendarEvents()
  const newTasks: Task[] = []
  
  events.forEach(event => {
    // Check if task already exists for this event
    const existing = getExistingTaskForEvent(event.id)
    if (!existing) {
      const task = createTask(eventToTask(event))
      newTasks.push(task)
    }
  })
  
  return newTasks
}

// Check if task exists for calendar event
function getExistingTaskForEvent(eventId: string): boolean {
  const tasks = JSON.parse(localStorage.getItem('mac-tasks') || '[]')
  return tasks.some((t: Task) => t.tags.includes(`event-${eventId}`))
}

// Format time for display
function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// Calculate duration in minutes
function getDurationMinutes(start: string, end: string): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))
}

// Get time until event
export function getTimeUntilEvent(event: CalendarEvent): string {
  const now = new Date()
  const eventTime = new Date(event.startTime)
  const diffMs = eventTime.getTime() - now.getTime()
  
  if (diffMs < 0) return 'In progress'
  
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`
  if (diffHours > 0) return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`
  return `in ${diffMins} min`
}

// Get Google Calendar auth URL (for real implementation)
export function getGoogleAuthUrl(): string {
  const redirectUri = typeof window !== 'undefined' ? window.location.origin : ''
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token&scope=${encodeURIComponent(SCOPES)}`
}