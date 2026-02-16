// Notification Service for Task Reminders
import { getTasks, getOverdueTasks, getTodaysTasks, Task } from './taskManager'

export interface Reminder {
  id: string
  taskId: string
  type: 'morning' | 'due-soon' | 'overdue' | 'focus'
  sentAt: string
}

// Check for tasks needing reminders
export function getPendingReminders(): Array<{
  task: Task
  type: 'morning' | 'due-soon' | 'overdue' | 'focus'
  message: string
}> {
  const reminders: Array<{ task: Task; type: 'morning' | 'due-soon' | 'overdue' | 'focus'; message: string }> = []
  const now = new Date()
  const currentHour = now.getHours()
  
  // Morning briefing (9 AM)
  if (currentHour >= 9 && currentHour < 10) {
    const todaysTasks = getTodaysTasks().filter(t => t.status !== 'done')
    const overdue = getOverdueTasks()
    
    if (todaysTasks.length > 0 || overdue.length > 0) {
      const urgentCount = [...todaysTasks, ...overdue].filter(t => 
        t.priority === 'urgent' || t.priority === 'high'
      ).length
      
      if (urgentCount > 0) {
        reminders.push({
          task: todaysTasks[0] || overdue[0],
          type: 'morning',
          message: `📅 Good morning! You have ${todaysTasks.length} tasks today + ${overdue.length} overdue. ${urgentCount} are high priority.`
        })
      }
    }
  }
  
  // Overdue reminders (every 4 hours after 10 AM)
  if (currentHour >= 10) {
    const overdue = getOverdueTasks()
    for (const task of overdue.slice(0, 3)) { // Max 3 overdue reminders
      reminders.push({
        task,
        type: 'overdue',
        message: `⏰ OVERDUE: "${task.title}" was due ${task.dueDate}. Complete it now!`
      })
    }
  }
  
  // Due soon (within 2 hours)
  const allTasks = getTasks()
  for (const task of allTasks) {
    if (task.status === 'done') continue
    if (!task.dueDate) continue
    
    const dueTime = new Date(`${task.dueDate}T23:59:59`)
    const hoursUntilDue = (dueTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (hoursUntilDue > 0 && hoursUntilDue <= 24) {
      reminders.push({
        task,
        type: 'due-soon',
        message: `⏳ Due soon: "${task.title}" - Due in ${Math.ceil(hoursUntilDue)} hours`
      })
    }
  }
  
  return reminders
}

// Generate end-of-day summary
export function generateDailySummary(): {
  completed: number
  remaining: number
  overdue: number
  message: string
} {
  const todaysTasks = getTodaysTasks()
  const completed = todaysTasks.filter(t => t.status === 'done').length
  const remaining = todaysTasks.filter(t => t.status !== 'done').length
  const overdue = getOverdueTasks().length
  
  let message = `📊 Daily Summary:\n`
  message += `✅ Completed: ${completed}\n`
  message += `📋 Remaining: ${remaining}\n`
  
  if (overdue > 0) {
    message += `⚠️ Overdue: ${overdue} (carry to tomorrow)\n`
  }
  
  if (completed > 0 && remaining === 0) {
    message += `🎉 Great job! All tasks done!`
  } else if (completed > remaining) {
    message += `💪 Solid progress! Keep it up.`
  } else {
    message += `🎯 Focus on high priority items tomorrow.`
  }
  
  return { completed, remaining, overdue, message }
}

// Get focus suggestion with context
export function getFocusNotification(): { title: string; body: string; action?: string } | null {
  const now = new Date()
  const currentHour = now.getHours()
  const todaysTasks = getTodaysTasks().filter(t => t.status !== 'done')
  
  if (todaysTasks.length === 0) return null
  
  // Sort by priority and pick top
  const urgent = todaysTasks.filter(t => t.priority === 'urgent')[0]
  const high = todaysTasks.filter(t => t.priority === 'high')[0]
  const next = urgent || high || todaysTasks[0]
  
  let title = '🎯 Focus Time'
  let body = `"${next.title}"`
  let action = 'Start now'
  
  if (currentHour < 12) {
    title = '🌅 Morning Focus'
    body = `Start your day with: "${next.title}"`
  } else if (currentHour < 15) {
    title = '☀️ Afternoon Push'
    body = `Keep momentum on: "${next.title}"`
  } else {
    title = '🌆 Evening Wrap-up'
    body = `Finish strong: "${next.title}"`
  }
  
  return { title, body, action }
}