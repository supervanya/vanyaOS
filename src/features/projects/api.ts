import type { Tables } from "@/lib/database.types"
import { oneOf } from "@/lib/parse"
import { supabase } from "@/lib/supabaseClient"

const PROJECT_STATUSES = ["in_progress", "parking_lot"] as const
type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export type Project = {
  id: string
  name: string
  emoji: string | null
  status: ProjectStatus
  sortOrder: number
}

// --- Projects (WIP limit: one) ----------------------------------------------

type ProjectRow = Pick<Tables<"projects">, "id" | "name" | "emoji" | "status" | "sort_order">

const projectFromRow = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji,
  status: oneOf(PROJECT_STATUSES, r.status, "projects.status"),
  sortOrder: r.sort_order,
})

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, emoji, status, sort_order")
    .order("sort_order")
    .order("created_at")
  if (error) throw error
  return (data ?? []).map(projectFromRow)
}

// New projects are parked; the id comes from the client so the list can show
// the project before the insert lands.
export function newProject(name: string, emoji: string | null = null): Project {
  return { id: crypto.randomUUID(), name, emoji, status: "parking_lot", sortOrder: 0 }
}

export async function addProject(project: Project): Promise<void> {
  const { error } = await supabase.from("projects").insert({
    id: project.id,
    name: project.name,
    emoji: project.emoji,
    status: project.status,
    sort_order: project.sortOrder,
  })
  if (error) throw error
}

// Swap which project is in progress. Demote first, then promote — the partial
// unique index (one in_progress per user) rejects the other order.
export async function setActiveProject(id: string): Promise<void> {
  const { error: demoteErr } = await supabase
    .from("projects")
    .update({ status: "parking_lot" })
    .eq("status", "in_progress")
  if (demoteErr) throw demoteErr
  const { error } = await supabase.from("projects").update({ status: "in_progress" }).eq("id", id)
  if (error) throw error
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id)
  if (error) throw error
}
