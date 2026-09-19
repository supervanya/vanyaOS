import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { LoadedConfig } from "@/features/config/api"
import { errorMessage } from "@/lib/errors"
import { clearDraft, saveDay, saveDraft, type DayEntry, type LoadedDay } from "./api"
import { dayQuery } from "./queries"

// How long to wait after the last edit before syncing to Postgres. The local
// draft is written on every change, instantly — this only debounces the
// network round-trip.
const SYNC_DEBOUNCE_MS = 800

/**
 * A day's entry that saves itself as you edit it. Each edit writes the local
 * draft at once (so a dropped connection can't lose it), then syncs to
 * Postgres after a short debounce.
 *
 * Starts from `loaded` and owns the entry from then on, so a background
 * refetch never replaces edits in progress — key the component by date to
 * switch days. Loading saves nothing: saving starts only once the entry
 * changes. The exception is a draft that never reached Postgres, which syncs
 * straight away.
 */
export function useEntryAutosave(config: LoadedConfig, loaded: LoadedDay) {
  const queryClient = useQueryClient()
  const [entry, setEntry] = useState(loaded.entry)
  const baseline = useRef<DayEntry | null>(loaded.unsynced ? null : loaded.entry)

  useEffect(() => {
    if (entry === baseline.current) return
    saveDraft(entry)
    const timer = setTimeout(() => {
      saveDay(entry, config)
        .then(() => {
          clearDraft(entry.date)
          // Other screens showing this day pick up the saved version.
          queryClient.setQueryData(dayQuery(entry.date).queryKey, { entry, unsynced: false })
        })
        .catch((err: unknown) => toast.error(`Sync failed, kept locally: ${errorMessage(err)}`))
    }, SYNC_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [entry, config, queryClient])

  return { entry, setEntry }
}
