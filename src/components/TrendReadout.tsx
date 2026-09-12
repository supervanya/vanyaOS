import type { Trend, Verdict } from "@/lib/trends"
import { cn } from "@/lib/utils"

const TONE: Record<Verdict, string> = {
  better: "text-success",
  worse: "text-destructive",
  flat: "text-muted-foreground",
}

const WORD: Record<Verdict, string> = {
  better: "Improving",
  worse: "Slipping",
  flat: "Steady",
}

/** Text colour for a verdict; too little data reads as neutral. */
export const trendTone = (verdict: Verdict | null | undefined) =>
  verdict ? TONE[verdict] : "text-muted-foreground"

/**
 * A trend as "earlier → recent", coloured by whether that change is good for
 * this item (so a falling symptom reads green). `format` renders one value in
 * the item's own units, e.g. "2.1" for a slider or "71%" for a habit.
 */
export function TrendReadout({
  trend,
  format,
  className,
}: {
  trend: Trend | null
  format: (value: number) => string
  className?: string
}) {
  if (!trend) {
    return (
      <span className={cn("text-muted-foreground text-xs", className)}>
        Too few entries
      </span>
    )
  }

  return (
    <span
      title={WORD[trend.verdict]}
      className={cn(
        "text-xs font-medium whitespace-nowrap tabular-nums",
        trendTone(trend.verdict),
        className,
      )}
    >
      <span className="sr-only">{WORD[trend.verdict]}: </span>
      {format(trend.early)} → {format(trend.recent)}
    </span>
  )
}
