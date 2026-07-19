import Link from 'next/link'
import type { Task } from '@/lib/store'
import { toggleTaskAction } from '@/lib/actions'

export default function TaskItem({ task }: { task: Task }) {
  const toggle = toggleTaskAction.bind(null, task.id, !task.done)

  return (
    <li className={`task-item${task.done ? ' done' : ''}`}>
      <form action={toggle}>
        <button
          type="submit"
          className="btn-ghost"
          aria-label={task.done ? 'Reopen task' : 'Complete task'}
          title={task.done ? 'Reopen' : 'Complete'}
        >
          {task.done ? '↺' : '✓'}
        </button>
      </form>
      <div className="task-body">
        <Link href={`/tasks/${task.id}`} className="task-title">
          {task.title}
        </Link>
        <div className="task-meta">
          {new Date(task.createdAt).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'UTC',
          })}
        </div>
      </div>
      <span className={`badge ${task.priority}`}>{task.priority}</span>
    </li>
  )
}
