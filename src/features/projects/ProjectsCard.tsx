import { useSuspenseQuery } from "@tanstack/react-query"
import { Monitor, Plus, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useOptimisticList } from "@/lib/optimistic"
import { cn } from "@/lib/utils"
import { addProject, deleteProject, newProject, setActiveProject, type Project } from "./api"
import { projectsQuery } from "./queries"

// Projects with a WIP limit of one: exactly one in progress, the rest parked.
// Tapping a parked project swaps it in (the previous active is demoted).
export function ProjectsCard() {
  const { data: projects } = useSuspenseQuery(projectsQuery)
  const apply = useOptimisticList<Project>(projectsQuery.queryKey)
  const [draft, setDraft] = useState("")

  const activate = (p: Project) => {
    if (p.status === "in_progress") return
    apply(
      (list) => list.map((x) => ({ ...x, status: x.id === p.id ? "in_progress" : "parking_lot" })),
      () => setActiveProject(p.id),
    )
  }

  const remove = (p: Project) =>
    apply(
      (list) => list.filter((x) => x.id !== p.id),
      () => deleteProject(p.id),
    )

  const submit = () => {
    const name = draft.trim()
    if (!name) return
    setDraft("")
    const project = newProject(name)
    apply(
      (list) => [...list, project],
      () => addProject(project),
    )
  }

  return (
    <section>
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Monitor size={14} /> Projects · WIP limit 1 · tap to swap
      </p>
      <div className="flex flex-col gap-1.5">
        {projects.map((p) => {
          const active = p.status === "in_progress"
          return (
            <div
              key={p.id}
              className={cn(
                "flex items-center rounded-lg border pr-2 text-[13px]",
                active
                  ? "border-info/70 bg-info/10 font-medium text-info"
                  : "border-border text-foreground/85",
              )}
            >
              <button
                type="button"
                onClick={() => activate(p)}
                aria-pressed={active}
                className="flex flex-1 items-center gap-2.5 py-2.5 pl-3.5 text-left"
              >
                {p.emoji && <span>{p.emoji}</span>}
                <span className="flex-1">{p.name}</span>
                <span className={cn("text-[11px]", active ? "text-info" : "text-muted-foreground")}>
                  {active ? "in progress" : "parking lot"}
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${p.name}`}
                className="ml-1 text-muted-foreground"
                onClick={() => remove(p)}
              >
                <X />
              </Button>
            </div>
          )
        })}
        <div className="mt-1 flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Add a project (parks it)…"
          />
          <Button type="button" variant="outline" size="icon" onClick={submit}>
            <Plus />
          </Button>
        </div>
      </div>
    </section>
  )
}
