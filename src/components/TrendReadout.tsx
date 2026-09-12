import type { Trend, Verdict } from "@/lib/trends"
import { cn } from "@/lib/utils"
import { WithDetail } from "@/components/chartHover"

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
 * the item's own units, e.g. "2.1" for a slider or "71%" for a habit. Hover or
 * tap for the verdict in words.
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

  const word = WORD[trend.verdict]
  return (
    <WithDetail
      detail={`${word}: ${format(trend.early)} in the earlier half, ${format(trend.recent)} recently`}
      className={cn(
        "text-xs font-medium whitespace-nowrap tabular-nums",
        trendTone(trend.verdict),
        className,
      )}
    >
      <span className="sr-only">{word}: </span>
      {format(trend.early)} → {format(trend.recent)}
    </WithDetail>
  )
}
