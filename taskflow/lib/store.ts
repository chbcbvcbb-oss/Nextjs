import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export type Priority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description: string
  priority: Priority
  done: boolean
  createdAt: string
  updatedAt: string
}

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'tasks.json')

// Serialize writes so concurrent mutations can't interleave and corrupt the file.
let writeLock: Promise<void> = Promise.resolve()

async function readAll(): Promise<Task[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeAll(tasks: Task[]): Promise<void> {
  const run = writeLock.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const tmp = DATA_FILE + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(tasks, null, 2), 'utf8')
    await fs.rename(tmp, DATA_FILE)
  })
  writeLock = run.catch(() => {})
  return run
}

export async function listTasks(): Promise<Task[]> {
  const tasks = await readAll()
  return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getTask(id: string): Promise<Task | undefined> {
  const tasks = await readAll()
  return tasks.find((t) => t.id === id)
}

export async function createTask(input: {
  title: string
  description: string
  priority: Priority
}): Promise<Task> {
  const now = new Date().toISOString()
  const task: Task = {
    id: randomUUID(),
    title: input.title,
    description: input.description,
    priority: input.priority,
    done: false,
    createdAt: now,
    updatedAt: now,
  }
  const tasks = await readAll()
  tasks.push(task)
  await writeAll(tasks)
  return task
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'done'>>
): Promise<Task | undefined> {
  const tasks = await readAll()
  const task = tasks.find((t) => t.id === id)
  if (!task) return undefined
  Object.assign(task, patch, { updatedAt: new Date().toISOString() })
  await writeAll(tasks)
  return task
}

export async function deleteTask(id: string): Promise<boolean> {
  const tasks = await readAll()
  const next = tasks.filter((t) => t.id !== id)
  if (next.length === tasks.length) return false
  await writeAll(next)
  return true
}
