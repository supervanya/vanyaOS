import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Sun } from "lucide-react"
import { dayQuery } from "./queries"

/**
 * The dashboard's read-only glance at `date`'s intention; the whole card opens
 * /morning. Reads the same day cache as the habit chips, which a morning save
 * patches, so it shows a new intention without a refetch. Renders nothing when
 * the day has no intention text.
 */
export function IntentionGlance({ date }: { date: string }) {
  const { data } = useSuspenseQuery(dayQuery(date))
  const text = data.entry.intention.trim()
  if (!text) return null

  return (
    <Link to="/morning" className="block rounded-lg border border-border bg-muted/40 px-4 py-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sun size={14} className="text-amber-500 dark:text-amber-300" /> Today's intention
      </span>
      <span className="mt-1 line-clamp-3 text-[14px] whitespace-pre-wrap">{text}</span>
    </Link>
  )
}
