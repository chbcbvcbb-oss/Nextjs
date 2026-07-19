import type { Priority } from './store'

const PRIORITIES: Priority[] = ['low', 'medium', 'high']

export interface TaskInput {
  title: string
  description: string
  priority: Priority
}

export interface ValidationResult {
  data?: TaskInput
  error?: string
}

export function validateTaskInput(value: unknown): ValidationResult {
  if (typeof value !== 'object' || value === null) {
    return { error: 'Request body must be an object.' }
  }
  const obj = value as Record<string, unknown>

  const title = typeof obj.title === 'string' ? obj.title.trim() : ''
  if (!title) return { error: 'Title is required.' }
  if (title.length > 120) return { error: 'Title must be 120 characters or fewer.' }

  const description =
    typeof obj.description === 'string' ? obj.description.trim() : ''
  if (description.length > 2000) {
    return { error: 'Description must be 2000 characters or fewer.' }
  }

  const priority = obj.priority
  if (
    typeof priority !== 'string' ||
    !PRIORITIES.includes(priority as Priority)
  ) {
    return { error: 'Priority must be one of: low, medium, high.' }
  }

  return { data: { title, description, priority: priority as Priority } }
}
