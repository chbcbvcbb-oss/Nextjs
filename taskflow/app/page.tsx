import { listTasks } from '@/lib/store'
import TaskForm from '@/components/TaskForm'
import TaskItem from '@/components/TaskItem'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const tasks = await listTasks()
  const open = tasks.filter((t) => !t.done).length
  const done = tasks.length - open
  const high = tasks.filter((t) => t.priority === 'high' && !t.done).length

  return (
    <>
      <h1>Dashboard</h1>
      <p className="subtitle">
        Tasks are rendered on the server and mutated with Server Actions.
      </p>

      <div className="stats">
        <div className="stat">
          <div className="value">{open}</div>
          <div className="label">Open</div>
        </div>
        <div className="stat">
          <div className="value">{done}</div>
          <div className="label">Completed</div>
        </div>
        <div className="stat">
          <div className="value">{high}</div>
          <div className="label">High priority</div>
        </div>
      </div>

      <div className="card">
        <h2>New task</h2>
        <TaskForm />
      </div>

      {tasks.length === 0 ? (
        <div className="empty">No tasks yet — add your first one above.</div>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </ul>
      )}
    </>
  )
}
