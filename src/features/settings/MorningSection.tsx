import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Sun } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DAY_CUTOFF_HOUR } from "@/lib/dates"
import { errorMessage } from "@/lib/errors"
import { saveMorningPrefs, type MorningPrefs } from "./api"
import { morningPrefsQuery } from "./queries"

const pad = (n: number) => String(n).padStart(2, "0")

/** Minutes after midnight as the `HH:MM` a time input holds. */
export const toClock = (minutes: number): string =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

/** `HH:MM` as minutes after midnight, or null when it isn't a time. */
export function fromClock(clock: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(clock)
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes < 24 * 60 && Number(match[2]) < 60 ? minutes : null
}

export function MorningSection() {
  const queryClient = useQueryClient()
  const { data: prefs } = useSuspenseQuery(morningPrefsQuery)

  // Shown at once; put back if the write fails.
  const save = (next: MorningPrefs) => {
    queryClient.setQueryData(morningPrefsQuery.queryKey, next)
    saveMorningPrefs(next).catch((err: unknown) => {
      queryClient.setQueryData(morningPrefsQuery.queryKey, prefs)
      toast.error(`Didn't save: ${errorMessage(err)}`)
    })
  }

  return (
    <section className="mt-6">
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sun size={14} /> Morning
      </p>
      <Label className="gap-2 text-[13px] font-normal">
        <Checkbox
          checked={prefs.redirect}
          onCheckedChange={(v) => save({ ...prefs, redirect: v === true })}
          className="size-4"
        />
        Open on Morning intention until it's set
      </Label>
      <div className="mt-2 flex items-center gap-2">
        <Label htmlFor="morning-closes-at" className="text-[13px] font-normal">
          Morning closes at
        </Label>
        {/* Keyed by the saved value, so a rejected or failed edit snaps back. */}
        <ClosesAtInput
          key={prefs.closesAt}
          value={prefs.closesAt}
          disabled={!prefs.redirect}
          onSave={(closesAt) => save({ ...prefs, closesAt })}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {prefs.redirect
          ? `Before ${toClock(prefs.closesAt)}, the app opens on the morning page if today has no intention yet. After that it opens on the dashboard.`
          : "The app always opens on the dashboard. The morning page stays reachable from there."}
      </p>
    </section>
  )
}

// The day starts at DAY_CUTOFF_HOUR, so a morning can't close before that.
const EARLIEST = DAY_CUTOFF_HOUR * 60 + 1

function ClosesAtInput({
  value,
  disabled,
  onSave,
}: {
  value: number
  disabled: boolean
  onSave: (minutes: number) => void
}) {
  const [clock, setClock] = useState(toClock(value))

  // Saved on blur: a time input reports every partial edit while typing.
  const commit = () => {
    const minutes = fromClock(clock)
    if (minutes === value) return
    if (minutes === null || minutes < EARLIEST) {
      setClock(toClock(value))
      toast.error(`Pick a time after ${toClock(EARLIEST - 1)}, when the day starts`)
      return
    }
    onSave(minutes)
  }

  return (
    <Input
      id="morning-closes-at"
      type="time"
      value={clock}
      min={toClock(EARLIEST)}
      disabled={disabled}
      onChange={(e) => setClock(e.target.value)}
      onBlur={commit}
      className="h-8 w-28 text-[13px]"
    />
  )
}
