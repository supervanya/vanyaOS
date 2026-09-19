import type { Tables } from "@/lib/database.types"
import { oneOf } from "@/lib/parse"
import { supabase } from "@/lib/supabaseClient"

// The living task list (M2): tasks belong to no day. scope today/week counts
// toward the weekly 1-3-5 commitment; someday is the parking lot.
export const TASK_SCOPES = ["today", "week", "someday"] as const
export const TASK_SIZES = ["big", "medium", "small"] as const
export type TaskScope = (typeof TASK_SCOPES)[number]
export type TaskSize = (typeof TASK_SIZES)[number]
export type Task = {
  id: string
  scope: TaskScope
  size: TaskSize
  text: string
  completedAt: string | null
  sortOrder: number
}

// The 1-3-5 rule: weekly caps per size, counted over scope today+week,
// including completed items (done work still occupied its slot this week).
export const CAPS: Record<TaskSize, number> = { big: 1, medium: 3, small: 5 }

// --- Tasks (the living 1-3-5 list) ------------------------------------------
// Direct row ops with optimistic UI at the callsite — no debounced blob sync;
// each mutation is one small write.

type TaskRow = Pick<
  Tables<"tasks">,
  "id" | "scope" | "size" | "text" | "completed_at" | "sort_order"
>

const taskFromRow = (r: TaskRow): Task => ({
  id: r.id,
  scope: oneOf(TASK_SCOPES, r.scope, "tasks.scope"),
  size: oneOf(TASK_SIZES, r.size, "tasks.size"),
  text: r.text,
  completedAt: r.completed_at,
  sortOrder: r.sort_order,
})

// Open tasks plus recently completed ones (completed stay visible on the board
// for the week they occupied — done work still counts toward the caps).
export async function listTasks(): Promise<Task[]> {
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()
  const { data, error } = await supabase
    .from("tasks")
    .select("id, scope, size, text, completed_at, sort_order")
    .eq("archived", false)
    .or(`completed_at.is.null,completed_at.gte.${weekAgo}`)
    .order("sort_order")
    .order("created_at")
  if (error) throw error
  return (data ?? []).map(taskFromRow)
}

// The id comes from the client (newTask) so the list can show the task before
// the insert lands, under the id it will keep.
export function newTask(text: string, scope: TaskScope, size: TaskSize): Task {
  return { id: crypto.randomUUID(), scope, size, text, completedAt: null, sortOrder: 0 }
}

export async function addTask(task: Task): Promise<void> {
  const { error } = await supabase.from("tasks").insert({
    id: task.id,
    text: task.text,
    scope: task.scope,
    size: task.size,
    sort_order: task.sortOrder,
  })
  if (error) throw error
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq("id", id)
  if (error) throw error
}

export async function moveTask(id: string, scope: TaskScope): Promise<void> {
  const { error } = await supabase.from("tasks").update({ scope }).eq("id", id)
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id)
  if (error) throw error
}
