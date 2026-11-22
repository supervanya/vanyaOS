import {
  useQueryClient,
  type DataTag,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { LoadedConfig } from "@/features/config/api"
import { errorMessage } from "@/lib/errors"
import { beginSave, type SettleSave } from "@/lib/saveStatus"
import {
  clearDraft,
  clearMorningDraft,
  discardMorningDraft,
  isMorningLocked,
  saveDay,
  saveDraft,
  saveMorning,
  saveMorningDraft,
  withMorning,
  type DayEntry,
  type LoadedDay,
  type LoadedMorning,
  type MorningEntry,
} from "./api"
import { trendSeriesQuery } from "@/features/trends/queries"
import { dayQuery, morningQuery } from "./queries"

// How long to wait after the last edit before syncing to Postgres. The local
// draft is written on every change, instantly — this only debounces the
// network round-trip.
const SYNC_DEBOUNCE_MS = 800

type Edited = { date: string; updatedAt: string }

// One half of the day as the autosave sees it: where its draft goes, how it
// saves, and which caches it keeps in step.
type Half<T extends Edited> = {
  saveDraft: (entry: T) => void
  clearDraft: (entry: T) => void
  // Sends what differs from any of `since`, the versions Postgres may hold
  // (all of it when that's unknown).
  save: (entry: T, config: LoadedConfig, since: T[] | null) => Promise<void>
  // The cache this half's editors start from. Its `synced` (see LoadedDay) is
  // shared by all of them, so one that takes over mid-save diffs against the
  // same versions.
  key: (date: string) => DataTag<QueryKey, { synced: T[] }, Error>
  // Puts an edit not yet synced into the cache, at once.
  cacheEdit: (queryClient: QueryClient, entry: T, config: LoadedConfig) => void
  // Puts the saved entry into the cache once its sync lands.
  cacheSaved: (queryClient: QueryClient, entry: T, config: LoadedConfig) => void
  // A refusal that saving again can't fix: the editor stops drafting and
  // syncing after it, and `refused` cleans up.
  isFinal: (err: unknown) => boolean
  refused: (queryClient: QueryClient, entry: T) => void
  failure: (err: unknown) => string
}

const kept = (err: unknown) => `Sync failed, kept locally: ${errorMessage(err)}`

// Every day's wellness counts both halves, so either one landing changes later
// days' "vs last" deltas and the Trends history. The saved day's own "vs last"
// only looks at earlier days, so it stays.
function refreshWellness(queryClient: QueryClient, date: string) {
  void queryClient.invalidateQueries({
    predicate: ({ queryKey: [, day, kind] }) =>
      kind === "previous-wellness" && typeof day === "string" && day > date,
  })
  void queryClient.invalidateQueries({ queryKey: trendSeriesQuery.queryKey })
}

// The evening half: the whole DayEntry through `save_day`. Its copy of the
// morning half is never its own to write, so the cache keeps the morning it
// already holds.
const evening: Half<DayEntry> = {
  saveDraft,
  clearDraft,
  save: saveDay,
  key: (date) => dayQuery(date).queryKey,
  cacheEdit: (queryClient, entry, config) => {
    const dayKey = dayQuery(entry.date).queryKey
    // A read of this day that started before the edit would land its older
    // snapshot on top of it; cancelling reverts it at once and drops its result.
    void queryClient.cancelQueries({ queryKey: dayKey, exact: true })
    queryClient.setQueryData(
      dayKey,
      (day) => day && { ...day, entry: withMorning(entry, day.entry, config) },
    )
  },
  cacheSaved: (queryClient, entry, config) => {
    // Postgres now holds `entry`. Other screens showing this day pick it up,
    // unless the cache already holds a newer edit. A read that started before
    // the save would land without it, so it's cancelled first.
    const dayKey = dayQuery(entry.date).queryKey
    void queryClient.cancelQueries({ queryKey: dayKey, exact: true })
    queryClient.setQueryData(dayKey, (day): LoadedDay | undefined => {
      if (!day || day.entry.updatedAt > entry.updatedAt) return day && { ...day, synced: [entry] }
      const saved = withMorning(entry, day.entry, config)
      return { entry: saved, synced: [saved] }
    })
    refreshWellness(queryClient, entry.date)
  },
  isFinal: () => false,
  refused: () => {},
  failure: kept,
}

// The morning half through `save_morning`. A saved morning is copied into the
// day's cache too, so /reflect and the dashboard see it without a refetch.
const morning: Half<MorningEntry> = {
  saveDraft: saveMorningDraft,
  clearDraft: clearMorningDraft,
  save: saveMorning,
  key: (date) => morningQuery(date).queryKey,
  cacheEdit: (queryClient, entry) => {
    const morningKey = morningQuery(entry.date).queryKey
    void queryClient.cancelQueries({ queryKey: morningKey, exact: true })
    queryClient.setQueryData(morningKey, (m) => m && { ...m, entry })
  },
  cacheSaved: (queryClient, entry, config) => {
    const morningKey = morningQuery(entry.date).queryKey
    void queryClient.cancelQueries({ queryKey: morningKey, exact: true })
    queryClient.setQueryData(
      morningKey,
      (m): LoadedMorning | undefined =>
        m &&
        (m.entry.updatedAt > entry.updatedAt
          ? { ...m, synced: [entry] }
          : { entry, synced: [entry], locked: false }),
    )
    // Only the morning half changes, and the day keeps its own `updatedAt`:
    // that tracks the evening's edits. Its evening half is untouched, so a day
    // Postgres held still is. A day read that started before the save would
    // land without it, so it's cancelled first.
    const dayKey = dayQuery(entry.date).queryKey
    void queryClient.cancelQueries({ queryKey: dayKey, exact: true })
    queryClient.setQueryData(dayKey, (day): LoadedDay | undefined => {
      if (!day) return day
      const next = withMorning(day.entry, entry, config)
      return { entry: next, synced: day.synced.includes(day.entry) ? [next] : day.synced }
    })
    refreshWellness(queryClient, entry.date)
  },
  isFinal: isMorningLocked,
  // The other device started the evening: the edit can never be saved, so its
  // draft goes, /morning turns read-only at once, and a refetch brings the
  // morning as it was saved.
  refused: (queryClient, entry) => {
    discardMorningDraft(entry.date)
    const morningKey = morningQuery(entry.date).queryKey
    queryClient.setQueryData(morningKey, (m) => m && { ...m, locked: true })
    void queryClient.invalidateQueries({ queryKey: morningKey, exact: true })
  },
  failure: (err) =>
    isMorningLocked(err)
      ? "This morning is read-only now: its evening has been started. Your edit wasn't saved."
      : kept(err),
}

/**
 * A day's entry that saves itself as you edit it. Each edit writes the local
 * draft and the day's cache at once (so a dropped connection can't lose it,
 * and reopening the day shows it), then syncs to Postgres after a short
 * debounce. Leaving the screen sends a sync still waiting on the debounce.
 *
 * Starts from `loaded` and owns the entry from then on, so a background
 * refetch never replaces edits in progress — key the component by date to
 * switch days. Loading saves nothing: saving starts only once the entry
 * changes. The exception is a draft that never reached Postgres, which syncs
 * straight away.
 */
export function useEntryAutosave(config: LoadedConfig, loaded: LoadedDay) {
  return useAutosave(evening, config, loaded)
}

/**
 * The same for a day's morning half (/morning), with its own draft. Render it
 * only while the morning is unlocked. If the day's evening was started
 * elsewhere meanwhile, `save_morning` refuses: that shows one toast, drops the
 * draft, marks the morning locked and refetches it, and nothing is drafted or
 * sent again.
 */
export function useMorningAutosave(config: LoadedConfig, loaded: LoadedMorning) {
  return useAutosave(morning, config, loaded)
}

function useAutosave<T extends Edited>(
  half: Half<T>,
  config: LoadedConfig,
  loaded: { entry: T; synced: T[] },
) {
  const queryClient = useQueryClient()
  const [entry, setEntry] = useState(loaded.entry)
  // The entry as loaded, if Postgres holds it already: it needs no save.
  const saved = useRef(loaded.synced.includes(loaded.entry) ? loaded.entry : null)
  // The sync waiting on the debounce, if any.
  const pending = useRef<(() => void) | null>(null)
  // Marks the entry unsaved in the top bar from the first edit until the sync
  // that carries it lands — the debounce window counts as unsaved.
  const unsaved = useRef<SettleSave | null>(null)
  // Set once a save is refused for good (isFinal): no more syncs from here.
  const stopped = useRef(false)

  useEffect(() => {
    if (entry === saved.current || stopped.current) return
    half.saveDraft(entry)
    half.cacheEdit(queryClient, entry, config)
    unsaved.current ??= beginSave()
    const sync = () => {
      pending.current = null
      const settle = unsaved.current
      unsaved.current = null
      syncEntry(half, entry, config, queryClient, settle, stopped)
    }
    pending.current = sync
    const timer = setTimeout(sync, SYNC_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [half, entry, config, queryClient])

  // Unmounting clears the timer above; send its sync now instead of losing it.
  useEffect(() => () => pending.current?.(), [])

  return { entry, setEntry }
}

// The tail of the sync queue. Syncs run one at a time, in the order they were
// made, so a slow save can't finish after a newer one and overwrite it. It's
// shared by every editor of either half (they write the same row), so one that
// unmounts mid-save still goes first.
let syncing = Promise.resolve()

function syncEntry<T extends Edited>(
  half: Half<T>,
  entry: T,
  config: LoadedConfig,
  queryClient: QueryClient,
  settle: SettleSave | null,
  stopped: { current: boolean },
) {
  const key = half.key(entry.date)
  syncing = syncing.then(async () => {
    // A save queued before a final refusal would only be refused again.
    if (stopped.current) {
      settle?.("failed")
      return
    }
    try {
      await half.save(entry, config, queryClient.getQueryData(key)?.synced ?? null)
      half.clearDraft(entry)
      half.cacheSaved(queryClient, entry, config)
      settle?.("saved")
    } catch (err: unknown) {
      // Postgres may hold it anyway, if only the answer was lost: what it
      // changed is sent again until a later save is confirmed.
      queryClient.setQueryData(key, (d) => d && { ...d, synced: [...d.synced, entry] })
      settle?.("failed")
      if (half.isFinal(err)) {
        stopped.current = true
        half.refused(queryClient, entry)
      }
      toast.error(half.failure(err))
    }
  })
}
