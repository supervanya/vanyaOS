import { useRef, useState, type PointerEvent, type ReactNode } from "react"
import type { Bucket } from "@/lib/trends"
import { cn } from "@/lib/utils"

/**
 * Which of `count` marks the pointer is over, for charts that label a mark on
 * hover — or while a finger drags sideways (pair the element with
 * `touch-pan-y` so vertical scrolling still works). `toIndex` maps the
 * pointer's position across the element (0..1) to a mark.
 */
export function useHoverIndex(count: number, toIndex: (ratio: number) => number) {
  const [index, setIndex] = useState<number | null>(null)

  const track = (e: PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = toIndex((e.clientX - rect.left) / rect.width)
    setIndex(Math.min(count - 1, Math.max(0, i)))
  }

  return {
    // Also null when the marks change under a stale index (e.g. a new window).
    index: index !== null && index < count ? index : null,
    handlers: {
      onPointerDown: track,
      onPointerMove: track,
      onPointerLeave: () => setIndex(null),
    },
  }
}

/**
 * A small label above its (relatively positioned) parent: centred on `left`,
 * or hanging from the parent's right edge for text at the end of a row.
 */
export function HoverLabel({
  left,
  align = "center",
  children,
}: {
  left?: string
  align?: "center" | "end"
  children: ReactNode
}) {
  return (
    <span
      role="tooltip"
      className={cn(
        "bg-foreground text-background pointer-events-none absolute bottom-full z-10 mb-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap tabular-nums",
        align === "end" ? "right-0" : "-translate-x-1/2",
      )}
      style={align === "center" ? { left } : undefined}
    >
      {children}
    </span>
  )
}

/**
 * Inline text that shows `detail` above it on hover, focus or tap — a plain
 * `title` never shows on a phone. Meant for the end of a row.
 */
export function WithDetail({
  detail,
  className,
  children,
}: {
  detail: string
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  // A mouse opens the detail by hovering, so its click mustn't toggle it shut
  // again; a tap or the keyboard toggles it.
  const pressedWith = useRef<string | null>(null)
  return (
    <button
      type="button"
      className={cn("relative", className)}
      onPointerDown={(e) => {
        pressedWith.current = e.pointerType
      }}
      onClick={() => {
        if (pressedWith.current !== "mouse") setOpen((o) => !o)
        pressedWith.current = null
      }}
      onBlur={() => setOpen(false)}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setOpen(true)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setOpen(false)
      }}
    >
      {children}
      {open && <HoverLabel align="end">{detail}</HoverLabel>}
    </button>
  )
}

/** "Tue, Aug 12" for a one-day bucket; "Aug 4 – Aug 10" for a longer one. */
export function bucketDates(bucket: Bucket): string {
  return bucket.start === bucket.end
    ? formatDate(bucket.start, { weekday: "short", month: "short", day: "numeric" })
    : `${shortDate(bucket.start)} – ${shortDate(bucket.end)}`
}

/** "Aug 31". */
export const shortDate = (iso: string) => formatDate(iso, { month: "short", day: "numeric" })

// Noon anchor so the local date never slips across a timezone boundary.
const formatDate = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, options)
