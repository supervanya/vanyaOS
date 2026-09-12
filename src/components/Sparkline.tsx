import type { Bucket } from "@/lib/trends"
import { cn } from "@/lib/utils"
import { HoverLabel, bucketDates, useHoverIndex } from "@/components/chartHover"

// Drawn in a fixed viewBox and stretched to the container's width; strokes use
// non-scaling-stroke so the line stays 1.5px however wide the row is. Anything
// that must stay round (the hover dot) is HTML positioned in percentages.
const W = 100
const H = 24
const PAD = 2
const BASELINE = H - PAD

type Segment = [index: number, value: number][]

/**
 * Bucket averages as a line on a 0..max scale. Empty buckets break the line
 * instead of dropping to zero. Colour comes from the text colour (pass a tone
 * class), so the chart matches its readout. Hovering — or dragging a finger
 * sideways — shows the nearest bucket's dates and value, rendered by `format`.
 */
export function Sparkline({
  buckets,
  max,
  format,
  className,
}: {
  buckets: Bucket[]
  max: number
  format: (value: number) => string
  className?: string
}) {
  const { index, handlers } = useHoverIndex(buckets.length, (ratio) =>
    Math.round(ratio * (buckets.length - 1)),
  )

  const x = (i: number) => (buckets.length > 1 ? (i / (buckets.length - 1)) * W : W / 2)
  const y = (value: number) => PAD + (1 - value / max) * (BASELINE - PAD)
  const hovered = index === null ? null : buckets[index]

  return (
    <div className={cn("relative touch-pan-y", className)} {...handlers}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="block h-6 w-full overflow-visible"
      >
        <line
          x1={0}
          x2={W}
          y1={BASELINE}
          y2={BASELINE}
          className="stroke-border"
          vectorEffect="non-scaling-stroke"
        />
        {segments(buckets).map((segment) => {
          const line = segment.map(([i, v], k) => `${k ? "L" : "M"}${x(i)} ${y(v)}`).join(" ")
          const [firstIndex] = segment[0]
          const [lastIndex, lastValue] = segment[segment.length - 1]
          return (
            <g key={firstIndex}>
              {segment.length > 1 && (
                <path
                  d={`${line} L${x(lastIndex)} ${BASELINE} L${x(firstIndex)} ${BASELINE} Z`}
                  fill="currentColor"
                  fillOpacity={0.12}
                />
              )}
              {/* A lone point is a zero-length line; its round cap draws a dot. */}
              <path
                d={segment.length > 1 ? line : `${line} L${x(lastIndex)} ${y(lastValue)}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}
      </svg>

      {index !== null && hovered && (
        <HoverMarker
          left={`${(x(index) / W) * 100}%`}
          top={hovered.mean === null ? null : `${(y(hovered.mean) / H) * 100}%`}
          label={describe(hovered, format)}
        />
      )}
    </div>
  )
}

function HoverMarker({ left, top, label }: { left: string; top: string | null; label: string }) {
  return (
    <>
      <span className="bg-border pointer-events-none absolute inset-y-0 w-px" style={{ left }} />
      {top && (
        <span
          className="ring-background pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2"
          style={{ left, top }}
        />
      )}
      <HoverLabel left={left}>{label}</HoverLabel>
    </>
  )
}

// "Tue, Aug 12 · 3.0" for a day; "Aug 4 – Aug 10 · avg 2.4 over 5 days" for a longer bucket.
function describe(bucket: Bucket, format: (value: number) => string): string {
  const dates = bucketDates(bucket)
  const oneDay = bucket.start === bucket.end
  if (bucket.mean === null) return `${dates} · ${oneDay ? "no entry" : "no entries"}`
  if (oneDay) return `${dates} · ${format(bucket.mean)}`
  const days = `${bucket.count} day${bucket.count === 1 ? "" : "s"}`
  return `${dates} · avg ${format(bucket.mean)} over ${days}`
}

// Consecutive buckets with data, split wherever nothing was logged.
function segments(buckets: Bucket[]): Segment[] {
  const out: Segment[] = []
  let current: Segment = []
  buckets.forEach((b, i) => {
    if (b.mean === null) {
      if (current.length) out.push(current)
      current = []
    } else {
      current.push([i, b.mean])
    }
  })
  if (current.length) out.push(current)
  return out
}
