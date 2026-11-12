import { useSuspenseQuery } from "@tanstack/react-query"
import { Sun } from "lucide-react"
import type { ReactNode } from "react"
import type { LoadedConfig } from "@/features/config/api"
import { metricsAt } from "@/lib/config"
import { cn } from "@/lib/utils"
import { INTENTION_LIVED, type IntentionLived, type MorningEntry } from "./api"
import { dayQuery } from "./queries"

const LIVED_LABEL = {
  no: "No",
  partly: "Partly",
  yes: "Yes",
} satisfies Record<IntentionLived, string>

const LIVED_ON = {
  no: "border-destructive/85 bg-destructive/15 text-destructive",
  partly: "border-warning/85 bg-warning/15 text-warning",
  yes: "border-success/85 bg-success/15 text-success",
} satisfies Record<IntentionLived, string>

/**
 * The top of /reflect: the day's morning half, read-only, and — when it set an
 * intention — "did I live it?". Renders nothing for a day with no morning.
 *
 * The morning comes from the day's query cache, not the evening editor's
 * state: that is seeded once, while a morning saved after it opened (the sync
 * /morning sends as you leave it) lands in the cache through `withMorning`.
 * The rating is the evening's own field, so it comes from the editor.
 */
export function MorningRecap({
  date,
  config,
  lived,
  onLivedChange,
}: {
  date: string
  config: LoadedConfig
  lived: IntentionLived | null
  onLivedChange: (value: IntentionLived | null) => void
}) {
  const { data } = useSuspenseQuery(dayQuery(date))
  const { text, values } = readMorning(data.entry, config)
  if (!text && !values.length) return null

  return (
    <>
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
      {text && <LivedChips value={lived} onChange={onLivedChange} />}
    </>
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

/**
 * No / Partly / Yes, at most one on. Tapping the one that's on clears it. Each
 * chip is a HabitChip-style label over a native switch, for the same haptics
 * and scroll-safe tap.
 */
function LivedChips({
  value,
  onChange,
}: {
  value: IntentionLived | null
  onChange: (value: IntentionLived | null) => void
}) {
  return (
    <fieldset className="mt-3 flex flex-wrap items-center gap-2">
      <legend className="mb-2 text-xs text-muted-foreground">Did I live it?</legend>
      {INTENTION_LIVED.map((option) => {
        const on = value === option
        return (
          <label
            key={option}
            className={cn(
              "relative inline-flex cursor-pointer touch-manipulation items-center justify-center rounded-full border px-3.5 py-2 text-[13px] transition-colors select-none has-focus-visible:ring-2 has-focus-visible:ring-ring",
              on ? LIVED_ON[option] : "border-border text-muted-foreground",
            )}
          >
            {LIVED_LABEL[option]}
            <input
              type="checkbox"
              {...{ switch: "" }}
              checked={on}
              onChange={() => {
                if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                  navigator.vibrate?.(7)
                }
                onChange(on ? null : option)
              }}
              className="pointer-events-none absolute inset-0 m-0 size-full opacity-0 [clip-path:inset(0)]"
            />
          </label>
        )
      })}
    </fieldset>
  )
}
