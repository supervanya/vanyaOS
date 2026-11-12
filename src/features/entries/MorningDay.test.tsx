// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useSuspenseQuery } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { Suspense, type ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { LoadedConfig } from "@/features/config/api"
import { configQuery } from "@/features/config/queries"
import type { Metric } from "@/lib/config"
import {
  loadMorningDraft,
  loadOrInitMorning,
  saveMorning,
  type DayEntry,
  type LoadedMorning,
  type MorningEntry,
} from "./api"
import { MorningDay } from "./MorningDay"
import { dayQuery, morningQuery } from "./queries"

// The real local drafts, in jsdom's localStorage; Postgres is mocked.
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }))
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  saveMorning: vi.fn<typeof saveMorning>(() => Promise.resolve()),
  loadOrInitMorning: vi.fn<typeof loadOrInitMorning>(),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn<(message: string) => void>() } }))
// The top bar needs a router; the task board has its own tests.
vi.mock("@/components/PageHeader", () => ({ PageHeader: () => null }))
vi.mock("@/features/tasks/TaskBoard", () => ({ TaskBoard: () => <p>task board</p> }))

// Radix measures the slider thumb with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const metric = (id: string, timing: Metric["timing"]): Metric => ({
  id,
  label: id,
  group: "Core",
  higherIsBetter: true,
  scale: 5,
  timing,
})
const config: LoadedConfig = {
  activeTheme: "recovery",
  themes: ["recovery"],
  metrics: [metric("mood", "evening"), metric("sleep", "morning")],
  habits: [],
  goals: [],
  metricRowId: {},
  habitRowId: {},
}
const date = "2026-09-12"
const morning: MorningEntry = {
  date,
  theme: "recovery",
  intention: "stay calm",
  metrics: { sleep: 3 },
  updatedAt: "2026-09-12T07:00:00.000Z",
}
const day: DayEntry = {
  date,
  theme: "recovery",
  metrics: { sleep: 3 },
  habits: { steps: true },
  reflection: "",
  intention: "stay calm",
  intentionLived: null,
  updatedAt: "2026-09-12T09:00:00.000Z",
}

let queryClient: QueryClient

// /morning as the route renders it: the morning from its query, never stale
// on its own (no network here), so only an invalidation refetches it.
function Page() {
  const { data } = useSuspenseQuery(morningQuery(date))
  return <MorningDay config={config} loaded={data} selectedDate={date} goTo={() => {}} />
}

function renderPage(loaded: LoadedMorning) {
  queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  queryClient.setQueryData(configQuery.queryKey, config)
  queryClient.setQueryData(morningQuery(date).queryKey, loaded)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>{children}</Suspense>
    </QueryClientProvider>
  )
  return render(<Page />, { wrapper })
}

const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

const intention = () => screen.queryByRole("textbox", { name: "Today's intention" })
const lockedCard = () => screen.queryByRole("region", { name: "Morning intention, read-only" })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(async () => {
  cleanup()
  await wait(0)
  vi.useRealTimers()
  vi.clearAllMocks()
  localStorage.clear()
})

describe("MorningDay", () => {
  it("edits an unlocked morning", () => {
    renderPage({ entry: morning, unsynced: false, locked: false })
    expect(intention()?.textContent).toBe("stay calm")
    expect(screen.getByRole("slider")).toBeDefined()
    expect(lockedCard()).toBeNull()
  })

  it("shows a locked morning read-only, saying why, with the task board live", async () => {
    renderPage({ entry: morning, unsynced: false, locked: true })
    const card = lockedCard()
    expect(card?.textContent).toContain("the evening for this day has been started")
    expect(card?.textContent).toContain("stay calm")
    expect(card?.textContent).toContain("sleep3/5")
    expect(intention()).toBeNull()
    expect(screen.queryByRole("slider")).toBeNull()
    expect(screen.getByText("task board")).toBeDefined()

    await wait(800)
    expect(saveMorning).not.toHaveBeenCalled()
    expect(loadMorningDraft(date)).toBeNull()
  })

  it("says so when a locked morning set nothing", () => {
    renderPage({ entry: { ...morning, intention: "", metrics: {} }, unsynced: false, locked: true })
    expect(lockedCard()?.textContent).toContain("No intention was set.")
  })

  it("locks once this session writes the day's evening, without a refetch", async () => {
    renderPage({ entry: morning, unsynced: false, locked: false })
    // A habit tap on the dashboard doesn't start the evening...
    act(() => {
      queryClient.setQueryData(dayQuery(date).queryKey, { entry: day, unsynced: false })
    })
    await wait(0)
    expect(intention()).not.toBeNull()

    // ...one word of reflection on /reflect does.
    act(() => {
      queryClient.setQueryData(dayQuery(date).queryKey, {
        entry: { ...day, reflection: "tired" },
        unsynced: true,
      })
    })
    await wait(0)
    expect(intention()).toBeNull()
    expect(lockedCard()?.textContent).toContain("stay calm")
    expect(loadOrInitMorning).not.toHaveBeenCalled()
  })

  it("on a refused save: one toast, the draft dropped, read-only with the saved morning", async () => {
    vi.mocked(saveMorning).mockRejectedValueOnce({ message: "morning_locked", code: "MLOCK" })
    // What the refetch finds: the morning as the server has it, now locked.
    vi.mocked(loadOrInitMorning).mockResolvedValue({
      entry: morning,
      unsynced: false,
      locked: true,
    })
    renderPage({ entry: morning, unsynced: false, locked: false })

    const box = intention()
    if (!box) throw new Error("no intention box")
    fireEvent.change(box, { target: { value: "edited on the phone" } })
    expect(loadMorningDraft(date)?.intention).toBe("edited on the phone")
    // The debounce, then the refusal, the refetch and the re-render.
    await wait(800)
    await wait(10)

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(loadMorningDraft(date)).toBeNull()
    expect(intention()).toBeNull()
    expect(lockedCard()?.textContent).toContain("stay calm")
    expect(lockedCard()?.textContent).not.toContain("edited on the phone")
    expect(loadOrInitMorning).toHaveBeenCalledTimes(1)

    // Nothing retries.
    await wait(5000)
    expect(saveMorning).toHaveBeenCalledTimes(1)
  })
})
