import { ChevronLeft, ChevronRight } from "lucide-react"
import { shiftISO } from "@/lib/dates"
import { ReflectDatePicker } from "./ReflectDatePicker"

/**
 * ‹ date › for the top bar of a day's page (/reflect, /morning): step a day
 * either way, or tap the date for the calendar. Never past `maxDate`.
 */
export function DayNavigator({
  date,
  maxDate,
  label,
  onSelect,
}: {
  date: string
  maxDate: string
  label: string
  onSelect: (date: string) => void
}) {
  return (
    <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onSelect(shiftISO(date, -1))}
        className="rounded p-1 hover:text-foreground"
      >
        <ChevronLeft size={16} />
      </button>
      <ReflectDatePicker date={date} maxDate={maxDate} label={label} onSelect={onSelect} />
      <button
        type="button"
        aria-label="Next day"
        disabled={date >= maxDate}
        onClick={() => onSelect(shiftISO(date, 1))}
        className="rounded p-1 hover:text-foreground disabled:opacity-30"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
