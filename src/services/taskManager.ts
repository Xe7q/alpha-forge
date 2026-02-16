// Command Center - Unified Task & Calendar Management

export interface Task {
  id: string
  title: string
  description?: string
  status: 'todo' | 'in-progress' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  createdAt: string
  completedAt?: string
  tags: string[]
  estimatedMinutes?: number
  actualMinutes?: number
  linkedEventId?: string  // Link to Google Calendar event
}

export interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  description?: string
  location?: string
  isRecurring: boolean
  hasAssociatedTask: boolean
  taskId?: string
}

export interface DayPlan {
  date: string
  events: CalendarEvent[]
  tasks: Task[]
  focusTask?: Task
  completedCount: number
  totalCount: number
}

// Task Management
export function createTask(task: Omit<Task, 'id' | 'createdAt' | 'status'>): Task {
  return {
    ...task,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    status: 'todo'
  }
}

export function updateTaskStatus(taskId: string, status: Task['status']): void {
  const tasks = getTasks()
  const updated = tasks.map(t => {
    if (t.id === taskId) {
      return {
        ...t,
        status,
        completedAt: status === 'done' ? new Date().toISOString() : undefined
      }
    }
    return t
  })
  saveTasks(updated)
}

export function getTasks(): Task[] {
  const stored = localStorage.getItem('mac-tasks')
  return stored ? JSON.parse(stored) : []
}

export function saveTasks(tasks: Task[]): void {
  localStorage.setItem('mac-tasks', JSON.stringify(tasks))
}

export function getTasksByDate(date: string): Task[] {
  return getTasks().filter(t => t.dueDate === date)
}

export function getOverdueTasks(): Task[] {
  const today = new Date().toISOString().split('T')[0]
  return getTasks().filter(t => 
    t.status !== 'done' && 
    t.dueDate && 
    t.dueDate < today
  )
}

export function getTodaysTasks(): Task[] {
  const today = new Date().toISOString().split('T')[0]
  return getTasks().filter(t => 
    t.dueDate === today || 
    (t.status !== 'done' && !t.dueDate) // Undated tasks
  )
}

// Priority sorting
export function sortByPriority(tasks: Task[]): Task[] {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
  return [...tasks].sort((a, b) => {
    // First by priority
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    // Then by due date
    if (a.dueDate && b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate)
    }
    return a.dueDate ? -1 : 1
  })
}

// Smart suggestions
export function getSuggestedFocusTask(): Task | null {
  const tasks = getTodaysTasks().filter(t => t.status !== 'done')
  if (tasks.length === 0) return null
  
  const sorted = sortByPriority(tasks)
  return sorted[0]
}

export function getCompletionStats(): { today: number; week: number; month: number } {
  const tasks = getTasks()
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  return {
    today: tasks.filter(t => t.completedAt?.startsWith(today)).length,
    week: tasks.filter(t => t.completedAt && t.completedAt >= weekAgo).length,
    month: tasks.filter(t => t.completedAt && t.completedAt >= monthAgo).length
  }
}

// Recurring tasks
export interface RecurringTemplate {
  id: string
  title: string
  description?: string
  priority: Task['priority']
  tags: string[]
  estimatedMinutes?: number
  frequency: 'daily' | 'weekly' | 'weekdays' | 'weekends'
}

export function generateRecurringTasks(templates: RecurringTemplate[]): Task[] {
  const today = new Date().toISOString().split('T')[0]
  const dayOfWeek = new Date().getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  
  return templates
    .filter(template => {
      if (template.frequency === 'daily') return true
      if (template.frequency === 'weekly') return true
      if (template.frequency === 'weekdays') return !isWeekend
      if (template.frequency === 'weekends') return isWeekend
      return false
    })
    .map(template => createTask({
      title: template.title,
      description: template.description,
      priority: template.priority,
      dueDate: today,
      tags: [...template.tags, 'recurring'],
      estimatedMinutes: template.estimatedMinutes
    }))
}

// Time blocking helper
export function suggestTimeBlocks(tasks: Task[], startHour: number = 9): Array<{
  hour: number
  task: Task
  duration: number
}> {
  const sorted = sortByPriority(tasks.filter(t => t.status !== 'done'))
  const blocks: Array<{ hour: number; task: Task; duration: number }> = []
  
  let currentHour = startHour
  for (const task of sorted.slice(0, 5)) { // Max 5 tasks
    const duration = task.estimatedMinutes ? Math.ceil(task.estimatedMinutes / 60) : 1
    blocks.push({ hour: currentHour, task, duration })
    currentHour += duration
    if (currentHour >= 17) break // End at 5 PM
  }
  
  return blocks
}

// Export for calendar integration
export function exportToGoogleCalendarFormat(task: Task): {
  summary: string
  description: string
  start: { dateTime: string }
  end: { dateTime: string }
} {
  const startTime = task.dueDate 
    ? new Date(`${task.dueDate}T09:00:00`)
    : new Date()
  const endTime = new Date(startTime.getTime() + (task.estimatedMinutes || 60) * 60000)
  
  return {
    summary: `🎯 ${task.title}`,
    description: `${task.description || ''}\n\nPriority: ${task.priority}\nTags: ${task.tags.join(', ')}`,
    start: { dateTime: startTime.toISOString() },
    end: { dateTime: endTime.toISOString() }
  }
}