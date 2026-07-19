'use client'

import { useActionState, useRef, useEffect } from 'react'
import { createTaskAction, type ActionState } from '@/lib/actions'

const initialState: ActionState = {}

export default function TaskForm() {
  const [state, formAction, pending] = useActionState(
    createTaskAction,
    initialState
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset()
  }, [pending, state])

  return (
    <form ref={formRef} action={formAction} className="form-grid">
      <div className="form-row">
        <div className="grow">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            type="text"
            maxLength={120}
            required
            placeholder="What needs doing?"
          />
        </div>
        <div>
          <label htmlFor="priority">Priority</label>
          <select id="priority" name="priority" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Adding…' : 'Add task'}
        </button>
      </div>
      <div>
        <label htmlFor="description">Description (optional)</label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={2000}
          placeholder="Details, links, context…"
        />
      </div>
      {state.error && <p className="error-text">{state.error}</p>}
    </form>
  )
}
