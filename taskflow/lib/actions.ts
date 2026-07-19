'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createTask, deleteTask, updateTask } from './store'
import { validateTaskInput } from './validate'

export interface ActionState {
  error?: string
}

export async function createTaskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { data, error } = validateTaskInput({
    title: formData.get('title'),
    description: formData.get('description'),
    priority: formData.get('priority'),
  })
  if (error || !data) return { error }

  await createTask(data)
  revalidatePath('/')
  return {}
}

export async function toggleTaskAction(id: string, done: boolean) {
  await updateTask(id, { done })
  revalidatePath('/')
  revalidatePath(`/tasks/${id}`)
}

export async function deleteTaskAction(id: string) {
  await deleteTask(id)
  revalidatePath('/')
  redirect('/')
}
