import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { clearDraft, saveDay, saveDraft } from "@/lib/storage"
import type { DayEntry, LoadedConfig, LoadedDay } from "@/lib/storage"

// How long to wait after the last edit before syncing to Postgres. The local
// draft is written on every change, instantly — this only debounces the
// network round-trip.
const SYNC_DEBOUNCE_MS = 800

/**
 * A day's entry that saves itself as you edit it. Each edit writes the local
 * draft at once (so a dropped connection can't lose it), then syncs to
 * Postgres after a short debounce.
 *
 * Loading a day saves nothing: whatever `load` receives is the baseline, and
 * saving starts only once the entry changes from it — so opening a page never
 * writes a row. The exception is a draft that never reached Postgres, which is
 * synced as soon as it loads.
 */
export function useEntryAutosave(config: LoadedConfig | null) {
  const [entry, setEntry] = useState<DayEntry | null>(null)
  const baseline = useRef<DayEntry | null>(null)

  const load = useCallback(({ entry, unsynced }: LoadedDay) => {
    baseline.current = unsynced ? null : entry
    setEntry(entry)
  }, [])

  useEffect(() => {
    if (!entry || !config || entry === baseline.current) return
    saveDraft(entry)
    const timer = setTimeout(() => {
      saveDay(entry, config)
        .then(() => clearDraft(entry.date))
        .catch((err) => toast.error(`Sync failed, kept locally: ${err.message}`))
    }, SYNC_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [entry, config])

  return { entry, setEntry, load }
}
