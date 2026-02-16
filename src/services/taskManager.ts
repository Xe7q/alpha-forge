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
  isRecurring?: boolean
  recurrencePattern?: 'daily' | 'weekdays' | 'weekly' | 'monthly'
  recurrenceId?: string  // Links recurring tasks together
}

export interface RecurringTaskTemplate {
  id: string
  title: string
  description?: string
  priority: Task['priority']
  tags: string[]
  estimatedMinutes?: number
  recurrencePattern: 'daily' | 'weekdays' | 'weekly' | 'monthly'
  startDate: string
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

// Recurring Task Management
const RECURRING_TASKS_KEY = 'mac-recurring-templates'

// Get all recurring templates
export function getRecurringTemplates(): RecurringTaskTemplate[] {
  const stored = localStorage.getItem(RECURRING_TASKS_KEY)
  return stored ? JSON.parse(stored) : []
}

export function saveRecurringTemplate(template: Omit<RecurringTaskTemplate, 'id'>): RecurringTaskTemplate {
  const templates = getRecurringTemplates()
  const newTemplate: RecurringTaskTemplate = {
    ...template,
    id: Date.now().toString()
  }
  templates.push(newTemplate)
  localStorage.setItem(RECURRING_TASKS_KEY, JSON.stringify(templates))
  return newTemplate
}

export function deleteRecurringTemplate(id: string): void {
  const templates = getRecurringTemplates().filter(t => t.id !== id)
  localStorage.setItem(RECURRING_TASKS_KEY, JSON.stringify(templates))
}

// Generate recurring tasks for today
export function generateRecurringTasksForToday(): Task[] {
  const templates = getRecurringTemplates()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const dayOfWeek = today.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  
  const newTasks: Task[] = []
  
  templates.forEach(template => {
    // Check if pattern matches today
    let shouldCreate = false
    
    switch (template.recurrencePattern) {
      case 'daily':
        shouldCreate = true
        break
      case 'weekdays':
        shouldCreate = !isWeekend
        break
      case 'weekly':
        // Check if today is the same day of week as start date
        const startDate = new Date(template.startDate)
        shouldCreate = startDate.getDay() === dayOfWeek
        break
      case 'monthly':
        // Check if today is the same day of month as start date
        const startDay = new Date(template.startDate).getDate()
        shouldCreate = today.getDate() === startDay
        break
    }
    
    if (shouldCreate) {
      // Check if task already exists for today
      const existingTasks = getTasks()
      const alreadyExists = existingTasks.some(t => 
        t.recurrenceId === template.id && 
        t.dueDate === todayStr &&
        t.status !== 'done'
      )
      
      if (!alreadyExists) {
        const task = createTask({
          title: template.title,
          description: template.description,
          priority: template.priority,
          dueDate: todayStr,
          tags: [...template.tags, 'recurring'],
          estimatedMinutes: template.estimatedMinutes
        })
        
        // Mark as recurring
        const taskWithMeta: Task = {
          ...task,
          isRecurring: true,
          recurrencePattern: template.recurrencePattern,
          recurrenceId: template.id
        }
        
        // Save the task with recurrence info
        const allTasks = getTasks()
        saveTasks([...allTasks.filter(t => t.id !== task.id), taskWithMeta])
        
        newTasks.push(taskWithMeta)
      }
    }
  })
  
  return newTasks
}

// Complete recurring task and schedule next occurrence
export function completeRecurringTask(taskId: string): void {
  const tasks = getTasks()
  const task = tasks.find(t => t.id === taskId)
  
  if (!task || !task.isRecurring || !task.recurrenceId) {
    // Regular task completion
    updateTaskStatus(taskId, 'done')
    return
  }
  
  // Mark current task as done
  const updatedTasks = tasks.map(t => {
    if (t.id === taskId) {
      return { ...t, status: 'done' as const, completedAt: new Date().toISOString() }
    }
    return t
  })
  
  saveTasks(updatedTasks)
  
  // Generate next occurrence based on pattern
  const template = getRecurringTemplates().find(t => t.id === task.recurrenceId)
  if (!template) return
  
  const today = new Date()
  const nextDate = new Date(today)
  
  switch (template.recurrencePattern) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1)
      break
    case 'weekdays':
      // Skip to next weekday
      do {
        nextDate.setDate(nextDate.getDate() + 1)
      } while (nextDate.getDay() === 0 || nextDate.getDate() === 6)
      break
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7)
      break
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1)
      break
  }
  
  const nextTask = createTask({
    title: template.title,
    description: template.description,
    priority: template.priority,
    dueDate: nextDate.toISOString().split('T')[0],
    tags: [...template.tags, 'recurring'],
    estimatedMinutes: template.estimatedMinutes
  })
  
  const nextTaskWithMeta: Task = {
    ...nextTask,
    isRecurring: true,
    recurrencePattern: template.recurrencePattern,
    recurrenceId: template.id
  }
  
  const finalTasks = getTasks()
  saveTasks([...finalTasks, nextTaskWithMeta])
}

// Default recurring templates
export function getDefaultRecurringTemplates(): RecurringTaskTemplate[] {
  const today = new Date().toISOString().split('T')[0]
  
  return [
    {
      id: 'default-1',
      title: '📧 Check Email',
      priority: 'medium',
      tags: ['routine'],
      recurrencePattern: 'daily',
      startDate: today,
      estimatedMinutes: 15
    },
    {
      id: 'default-2',
      title: '💰 Review Portfolio',
      description: 'Check positions and market news',
      priority: 'high',
      tags: ['finance', 'routine'],
      recurrencePattern: 'weekdays',
      startDate: today,
      estimatedMinutes: 10
    },
    {
      id: 'default-3',
      title: '📝 Weekly Review',
      description: 'Review goals and plan next week',
      priority: 'medium',
      tags: ['planning'],
      recurrencePattern: 'weekly',
      startDate: today,
      estimatedMinutes: 30
    }
  ]
}

// Initialize default recurring tasks
export function initializeRecurringTasks(): void {
  const existing = getRecurringTemplates()
  if (existing.length === 0) {
    const defaults = getDefaultRecurringTemplates()
    localStorage.setItem(RECURRING_TASKS_KEY, JSON.stringify(defaults))
  }
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