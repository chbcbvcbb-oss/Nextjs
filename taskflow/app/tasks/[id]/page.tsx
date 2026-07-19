import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTask } from '@/lib/store'
import { deleteTaskAction, toggleTaskAction } from '@/lib/actions'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const task = await getTask(id)
  return { title: task ? task.title : 'Task not found' }
}

export default async function TaskDetail({ params }: Props) {
  const { id } = await params
  const task = await getTask(id)
  if (!task) notFound()

  const toggle = toggleTaskAction.bind(null, task.id, !task.done)
  const remove = deleteTaskAction.bind(null, task.id)

  return (
    <>
      <p>
        <Link href="/">← Back to dashboard</Link>
      </p>
      <div className="card" style={{ marginTop: '1rem' }}>
        <span className={`badge ${task.priority}`}>{task.priority}</span>
        <h1 style={{ marginTop: '0.5rem' }}>{task.title}</h1>
        <p className="task-meta">
          Created {new Date(task.createdAt).toISOString()} · Updated{' '}
          {new Date(task.updatedAt).toISOString()} ·{' '}
          {task.done ? 'Completed' : 'Open'}
        </p>
        <p className="detail-desc">
          {task.description || 'No description provided.'}
        </p>
        <div className="detail-actions">
          <form action={toggle}>
            <button type="submit" className="btn-primary">
              {task.done ? 'Reopen task' : 'Mark as done'}
            </button>
          </form>
          <form action={remove}>
            <button type="submit" className="btn-danger">
              Delete task
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
