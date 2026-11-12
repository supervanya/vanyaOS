import { useSuspenseQuery } from "@tanstack/react-query"
import { Sun } from "lucide-react"
import type { ReactNode } from "react"
import type { LoadedConfig } from "@/features/config/api"
import { metricsAt } from "@/lib/config"
import type { MorningEntry } from "./api"
import { dayQuery } from "./queries"

/**
 * On /reflect, right above the reflection box: the day's morning half,
 * read-only, to check the day against while writing. Renders nothing for a day
 * with no morning. "Did you live your morning intention?" comes after the reflection (LivedRating).
 *
 * The morning comes from the day's query cache, not the evening editor's
 * state: that is seeded once, while a morning saved after it opened (the sync
 * /morning sends as you leave it) lands in the cache through `withMorning`.
 */
export function MorningRecap({ date, config }: { date: string; config: LoadedConfig }) {
  const { data } = useSuspenseQuery(dayQuery(date))
  const { text, values } = readMorning(data.entry, config)
  if (!text && !values.length) return null

  return (
    <MorningCard
      morning={data.entry}
      config={config}
      name="This morning"
      heading={
        <>
          <Sun size={14} className="text-amber-500 dark:text-amber-300" /> This morning
        </>
      }
    />
  )
}

// The intention's text and the morning values that are set, in config order.
function readMorning(morning: Pick<MorningEntry, "intention" | "metrics">, config: LoadedConfig) {
  const values = metricsAt(config.metrics, "morning").flatMap((m) => {
    const value = morning.metrics[m.id]
    return value === undefined ? [] : [{ metric: m, value }]
  })
  return { text: morning.intention.trim(), values }
}

/**
 * A morning half, read-only: the intention as text and each set morning value
 * over its scale, under a small `heading`. Shared by /reflect's recap and a
 * locked /morning.
 */
export function MorningCard({
  morning,
  config,
  name,
  heading,
}: {
  morning: Pick<MorningEntry, "intention" | "metrics">
  config: LoadedConfig
  name: string // the region's accessible name
  heading: ReactNode
}) {
  const { text, values } = readMorning(morning, config)
  return (
    <section
      aria-label={name}
      className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2.5"
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{heading}</p>
      {text && <p className="mt-1.5 text-[14px] whitespace-pre-wrap">{text}</p>}
      {values.length > 0 && (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          {values.map(({ metric, value }) => (
            <div key={metric.id} className="flex items-baseline gap-1.5">
              <dt className="text-muted-foreground">{metric.label}</dt>
              <dd className="font-semibold tabular-nums">
                {value}
                <span className="font-normal text-muted-foreground">/{metric.scale}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {!text && !values.length && (
        <p className="mt-1.5 text-[13px] text-muted-foreground">No intention was set.</p>
      )}
    </section>
  )
}
