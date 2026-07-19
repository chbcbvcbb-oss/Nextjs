import { NextResponse } from 'next/server'
import { createTask, listTasks } from '@/lib/store'
import { validateTaskInput } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tasks = await listTasks()
  return NextResponse.json({ tasks, count: tasks.length })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 }
    )
  }

  const { data, error } = validateTaskInput(body)
  if (error || !data) {
    return NextResponse.json({ error }, { status: 400 })
  }

  const task = await createTask(data)
  return NextResponse.json({ task }, { status: 201 })
}
