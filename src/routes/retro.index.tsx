import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { BookOpen, LayoutDashboard } from "lucide-react"
import { toast } from "sonner"

import { listRetroAreas, latestRetroDates, isRetroDue } from "@/lib/storage"
import type { RetroArea } from "@/lib/storage"
import { cn } from "@/lib/utils"
import { errorMessage } from "@/lib/errors"

export const Route = createFileRoute("/retro/")({ component: RetroList })

function RetroList() {
  const [areas, setAreas] = useState<RetroArea[] | null>(null)
  const [lastRuns, setLastRuns] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([listRetroAreas(), latestRetroDates()])
      .then(([a, dates]) => {
        setAreas(a.filter((x) => !x.archived))
        setLastRuns(dates)
      })
      .catch((err) => toast.error(`Couldn't load retro areas: ${errorMessage(err)}`))
  }, [])

  if (!areas) return null

  return (
    <>
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-muted-foreground hover:text-foreground"
        >
          <LayoutDashboard size={15} />
          VanyaOS
        </Link>
        <span className="text-xs text-muted-foreground">Retrospectives</span>
      </div>

      <h1 className="mt-3 flex items-center gap-2 text-[15px] font-medium">
        <BookOpen size={17} className="text-indigo-500 dark:text-indigo-300" />
        Fitness areas
      </h1>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Each area keeps a living state-of-affairs doc, updated by running a retrospective with your
        coach.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {areas.map((a) => {
          const last = lastRuns[a.id]
          const due = isRetroDue(last)
          return (
            <Link
              key={a.id}
              to="/retro/$areaId"
              params={{ areaId: a.id }}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-input/20 px-4 py-3 text-[14px] font-medium"
            >
              {a.label}
              <span
                className={cn(
                  "ml-auto text-[11px] font-normal",
                  due ? "text-warning" : "text-muted-foreground",
                )}
              >
                {last
                  ? `last: ${new Date(last).toLocaleDateString(undefined, { month: "short", day: "numeric" })}${due ? " · due" : ""}`
                  : "not started"}
              </span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
