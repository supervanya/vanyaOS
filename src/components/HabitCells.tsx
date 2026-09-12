import type { Bucket } from "@/lib/trends"
import { cn } from "@/lib/utils"
import { HoverLabel, bucketDates, useHoverIndex } from "@/components/chartHover"

/**
 * A habit's record as one row of cells: a day per cell on short windows, a
 * week (or month) per cell on long ones. Done fills with the text colour (pass
 * a tone class), a longer bucket in proportion to the share of days done;
 * missed is a faint empty cell, a day with no entry a dot, and the time before
 * the habit's first entry is left blank. Hover or drag for a cell's details.
 */
export function HabitCells({
  buckets,
  firstDate,
  className,
}: {
  buckets: Bucket[]
  firstDate: string | null // the habit's first entry, from its full history
  className?: string
}) {
  const { index, handlers } = useHoverIndex(buckets.length, (ratio) =>
    Math.floor(ratio * buckets.length),
  )

  return (
    <div className={cn("relative flex h-6 touch-pan-y items-center gap-px", className)} {...handlers}>
      {buckets.map((bucket, i) => (
        <Cell
          key={bucket.start}
          bucket={bucket}
          tracked={firstDate !== null && bucket.end >= firstDate}
          active={i === index}
        />
      ))}
      {index !== null && (
        <HoverLabel left={`${((index + 0.5) / buckets.length) * 100}%`}>
          {describe(buckets[index])}
        </HoverLabel>
      )}
    </div>
  )
}

function Cell({ bucket, tracked, active }: { bucket: Bucket; tracked: boolean; active: boolean }) {
  const base = cn("h-3.5 flex-1 rounded-[2px]", active && "ring-foreground/60 ring-1")
  if (!tracked) return <span className="h-3.5 flex-1" />
  if (bucket.mean === null) {
    return (
      <span className={cn(base, "flex items-center justify-center")}>
        <span className="bg-muted-foreground/50 size-[3px] rounded-full" />
      </span>
    )
  }
  return (
    <span className={cn(base, "bg-muted relative overflow-hidden")}>
      {bucket.mean > 0 && (
        <span
          className="absolute inset-0 bg-current"
          style={{ opacity: 0.15 + 0.85 * bucket.mean }}
        />
      )}
    </span>
  )
}

// "Tue, Aug 12 · done" for a day; "Aug 4 – Aug 10 · 5 of 7 days" for a longer bucket.
function describe(bucket: Bucket): string {
  const dates = bucketDates(bucket)
  const oneDay = bucket.start === bucket.end
  if (bucket.mean === null) return `${dates} · ${oneDay ? "no entry" : "no entries"}`
  if (oneDay) return `${dates} · ${bucket.mean ? "done" : "missed"}`
  return `${dates} · ${Math.round(bucket.mean * bucket.count)} of ${bucket.count} days`
}
