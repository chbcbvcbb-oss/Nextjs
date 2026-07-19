import { NextResponse } from 'next/server'
import { deleteTask, getTask, updateTask, type Task } from '@/lib/store'
import { validateTaskInput } from '@/lib/validate'

export const dynamic = 'force-dynamic'

interface Ctx {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params
  const task = await getTask(id)
  if (!task) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  }
  return NextResponse.json({ task })
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 }
    )
  }

  const obj = (typeof body === 'object' && body !== null ? body : {}) as Record<
    string,
    unknown
  >

  const patch: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'done'>> =
    {}

  if ('done' in obj) {
    if (typeof obj.done !== 'boolean') {
      return NextResponse.json(
        { error: '`done` must be a boolean.' },
        { status: 400 }
      )
    }
    patch.done = obj.done
  }

  if ('title' in obj || 'description' in obj || 'priority' in obj) {
    const existing = await getTask(id)
    if (!existing) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    }
    const { data, error } = validateTaskInput({
      title: 'title' in obj ? obj.title : existing.title,
      description: 'description' in obj ? obj.description : existing.description,
      priority: 'priority' in obj ? obj.priority : existing.priority,
    })
    if (error || !data) {
      return NextResponse.json({ error }, { status: 400 })
    }
    Object.assign(patch, data)
  }

  const task = await updateTask(id, patch)
  if (!task) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  }
  return NextResponse.json({ task })
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params
  const removed = await deleteTask(id)
  if (!removed) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  }
  return new NextResponse(null, { status: 204 })
}
