import { useEffect, useState } from "react"
import { ArrowUp, Plus, X, Inbox } from "lucide-react"
import { toast } from "sonner"

import {
  CAPS,
  listTasks,
  addTask,
  setTaskDone,
  moveTask,
  deleteTask,
} from "@/lib/storage"
import type { Task, TaskScope, TaskSize } from "@/lib/storage"
import { cn } from "@/lib/utils"
import { HapticToggle } from "@/components/HapticToggle"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

const SIZES: TaskSize[] = ["big", "medium", "small"]
const SIZE_LABEL: Record<TaskSize, string> = { big: "1", medium: "3", small: "5" }

// Occupies a weekly 1-3-5 slot: on the board (today or week) and not deleted.
// Completed items still count — done work used up its slot this week.
const onBoard = (t: Task) => t.scope === "today" || t.scope === "week"

/**
 * The 1-3-5 board over the living task list: 1 big / 3 medium / 5 small per
 * week, hard-capped — adding or promoting past a cap forces a swap (the
 * constraint is the feature). `compact` (used inside the evening reflection)
 * hides the Someday parking lot and the add row.
 */
export function TaskBoard({ compact = false }: { compact?: boolean }) {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [draft, setDraft] = useState("")
  const [draftSize, setDraftSize] = useState<TaskSize>("small")
  // A task wanting onto a full board: either brand-new text or a promotion.
  const [overflow, setOverflow] = useState<
    { kind: "new"; text: string; size: TaskSize } | { kind: "promote"; task: Task } | null
  >(null)

  useEffect(() => {
    listTasks()
      .then(setTasks)
      .catch((err) => toast.error(`Couldn't load tasks: ${err.message}`))
  }, [])

  if (!tasks) return null

  const bySize = (size: TaskSize) =>
    tasks
      .filter((t) => onBoard(t) && t.size === size)
      .sort((a, b) =>
        // open before completed; today before week; stable by sort order
        Number(!!a.completedAt) - Number(!!b.completedAt) ||
        Number(b.scope === "today") - Number(a.scope === "today") ||
        a.sortOrder - b.sortOrder,
      )
  const someday = tasks.filter((t) => t.scope === "someday" && !t.completedAt)
  const slotsUsed = (size: TaskSize) => tasks.filter((t) => onBoard(t) && t.size === size).length

  const mutate = (next: Task[], op: Promise<unknown>) => {
    const prev = tasks
    setTasks(next)
    op.catch((err) => {
      toast.error(`Didn't save: ${err.message}`)
      setTasks(prev)
    })
  }

  const toggleDone = (t: Task) => {
    const done = !t.completedAt
    mutate(
      tasks.map((x) =>
        x.id === t.id ? { ...x, completedAt: done ? new Date().toISOString() : null } : x,
      ),
      setTaskDone(t.id, done),
    )
  }

  const move = (t: Task, scope: TaskScope) =>
    mutate(tasks.map((x) => (x.id === t.id ? { ...x, scope } : x)), moveTask(t.id, scope))

  const remove = (t: Task) =>
    mutate(tasks.filter((x) => x.id !== t.id), deleteTask(t.id))

  // Promote someday -> week, via the swap chooser when that size is full.
  const promote = (t: Task) => {
    if (slotsUsed(t.size) >= CAPS[t.size]) setOverflow({ kind: "promote", task: t })
    else move(t, "week")
  }

  const submitNew = () => {
    const text = draft.trim()
    if (!text) return
    setDraft("")
    if (slotsUsed(draftSize) >= CAPS[draftSize]) {
      setOverflow({ kind: "new", text, size: draftSize })
      return
    }
    addTask(text, "week", draftSize)
      .then((t) => setTasks((cur) => (cur ? [...cur, t] : [t])))
      .catch((err) => toast.error(`Didn't save: ${err.message}`))
  }

  // Swap chooser: the tapped board item goes to someday; the waiting item takes
  // its slot. Or park the waiting item instead.
  const resolveOverflow = (evictee: Task | null) => {
    const o = overflow
    if (!o) return
    setOverflow(null)
    const incomingScope: TaskScope = evictee ? "week" : "someday"
    if (evictee) move(evictee, "someday")
    if (o.kind === "promote") {
      move(o.task, incomingScope === "week" ? "week" : "someday")
    } else {
      addTask(o.text, incomingScope, o.size)
        .then((t) => setTasks((cur) => (cur ? [...cur, t] : [t])))
        .catch((err) => toast.error(`Didn't save: ${err.message}`))
    }
  }

  const overflowSize = overflow ? (overflow.kind === "new" ? overflow.size : overflow.task.size) : null
  const overflowText = overflow ? (overflow.kind === "new" ? overflow.text : overflow.task.text) : null

  return (
    <div>
      {SIZES.map((size) => {
        const items = bySize(size)
        const used = slotsUsed(size)
        const over = used >= CAPS[size]
        return (
          <section key={size} className="mt-3 first:mt-0">
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="text-lg font-semibold tabular-nums">{SIZE_LABEL[size]}</span>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  over ? "text-warning" : "text-muted-foreground",
                )}
              >
                {used}/{CAPS[size]}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {items.length === 0 && (
                <p className="text-muted-foreground/60 text-[12px]">nothing picked</p>
              )}
              {items.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <HapticToggle
                    checked={!!t.completedAt}
                    onToggle={() => toggleDone(t)}
                    ariaLabel={t.text}
                    className="size-5 rounded-[4px]"
                  >
                    <Checkbox
                      checked={!!t.completedAt}
                      tabIndex={-1}
                      className="pointer-events-none size-5"
                    />
                  </HapticToggle>
                  <span
                    className={cn(
                      "flex-1 text-[13px]",
                      t.completedAt ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {t.text}
                  </span>
                  {!t.completedAt && (
                    <button
                      type="button"
                      onClick={() => move(t, t.scope === "today" ? "week" : "today")}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px]",
                        t.scope === "today"
                          ? "border-info/60 text-info"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {t.scope === "today" ? "today" : "week"}
                    </button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    onClick={() => remove(t)}
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {/* Cap-exceeded swap chooser */}
      {overflow && overflowSize && (
        <div className="border-warning/40 bg-warning/10 mt-3 rounded-lg border p-3">
          <p className="text-[12px] font-medium">
            The {SIZE_LABEL[overflowSize]}-slot is full. Swap one out for “{overflowText}”?
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {bySize(overflowSize)
              .filter((t) => !t.completedAt && !(overflow.kind === "promote" && t.id === overflow.task.id))
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => resolveOverflow(t)}
                  className="border-border bg-background rounded-md border px-2.5 py-1.5 text-left text-[12px]"
                >
                  swap out: {t.text}
                </button>
              ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => resolveOverflow(null)}>
              Keep in Someday
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOverflow(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add a task (tries the week board; overflow goes through the chooser) */}
      {!compact && (
        <div className="mt-4 flex items-center gap-2">
          <div className="border-border flex shrink-0 overflow-hidden rounded-md border">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDraftSize(s)}
                className={cn(
                  "px-2.5 py-1.5 text-[12px] tabular-nums",
                  draftSize === s ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {SIZE_LABEL[s]}
              </button>
            ))}
          </div>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNew()}
            placeholder="Add to this week…"
          />
          <Button type="button" variant="outline" size="icon" onClick={submitNew}>
            <Plus />
          </Button>
        </div>
      )}

      {/* Someday: the task parking lot */}
      {!compact && (
        <section className="mt-4">
          <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs">
            <Inbox size={14} /> Someday · {someday.length}
          </p>
          <div className="flex flex-col gap-1.5">
            {someday.map((t) => (
              <div key={t.id} className="flex items-center gap-2.5">
                <span className="text-muted-foreground flex-1 text-[13px]">{t.text}</span>
                <span className="text-muted-foreground/70 text-[10px] tabular-nums">
                  {SIZE_LABEL[t.size]}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  aria-label="Promote to this week"
                  onClick={() => promote(t)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  onClick={() => remove(t)}
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
