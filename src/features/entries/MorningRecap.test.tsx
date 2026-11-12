// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { LoadedConfig } from "@/features/config/api"
import type { Metric } from "@/lib/config"
import { saveDay, withMorning, type DayEntry, type IntentionLived } from "./api"
import { celebrate } from "./celebrate"
import { LivedRating } from "./LivedRating"
import { MorningRecap } from "./MorningRecap"
import { dayQuery } from "./queries"
import { useEntryAutosave } from "./useEntryAutosave"

// Only Postgres is mocked; the day is put straight into the cache.
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }))
// jsdom has no canvas to draw confetti on.
vi.mock("./celebrate", () => ({ celebrate: vi.fn<typeof celebrate>() }))
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  saveDay: vi.fn<typeof saveDay>(() => Promise.resolve()),
}))

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
  metrics: [metric("mood", "evening"), metric("sleep", "morning"), metric("energy", "morning")],
  habits: [],
  goals: [],
  metricRowId: {},
  habitRowId: {},
}
const date = "2026-09-12"
const day: DayEntry = {
  date,
  theme: "recovery",
  metrics: { mood: 4 },
  habits: {},
  reflection: "",
  intention: "",
  intentionLived: null,
  updatedAt: "2026-09-12T08:00:00.000Z",
}

let queryClient: QueryClient

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  localStorage.clear()
})

// The day in the cache, never refetched (no network here).
function cacheDay(entry: DayEntry) {
  queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  queryClient.setQueryData(dayQuery(date).queryKey, { entry, unsynced: false })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function renderRecap(entry: DayEntry, lived: IntentionLived | null = null) {
  const onLivedChange = vi.fn<(value: IntentionLived | null) => void>()
  const result = render(
    <>
      <MorningRecap date={date} config={config} />
      <LivedRating date={date} value={lived} onChange={onLivedChange} />
    </>,
    { wrapper: cacheDay(entry) },
  )
  return { ...result, onLivedChange }
}

describe("MorningRecap", () => {
  it("renders nothing for a day with no morning", () => {
    const { container } = renderRecap({ ...day, intention: "  \n " })
    expect(container.innerHTML).toBe("")
  })

  it("shows the intention and the morning values, read-only", () => {
    renderRecap({ ...day, intention: "  stay calm ", metrics: { mood: 4, sleep: 3 } })
    const card = screen.getByRole("region", { name: "This morning" })
    expect(card.textContent).toContain("stay calm")
    expect(card.textContent).toContain("sleep3/5")
    // Only set morning values: no evening metric, no unset energy.
    expect(card.textContent).not.toContain("mood")
    expect(card.textContent).not.toContain("energy")
    expect(card.querySelector("input, textarea, [role=slider]")).toBeNull()
  })

  it("shows morning values alone, without asking whether it was lived", () => {
    renderRecap({ ...day, metrics: { sleep: 2 } })
    expect(screen.getByRole("region", { name: "This morning" })).toBeDefined()
    expect(screen.queryByRole("group", { name: "Did you live your morning intention?" })).toBeNull()
  })

  it("asks whether the intention was lived, with the rating checked", () => {
    renderRecap({ ...day, intention: "stay calm" }, "partly")
    const group = screen.getByRole("group", { name: "Did you live your morning intention?" })
    expect(group).toBeDefined()
    const checks = ["No", "Partly", "Yes"].map(
      (name) => screen.getByRole<HTMLInputElement>("checkbox", { name }).checked,
    )
    expect(checks).toEqual([false, true, false])
  })

  it("selects a rating, switches it, and clears it on a second tap", () => {
    const { onLivedChange } = renderRecap({ ...day, intention: "stay calm" }, "partly")
    fireEvent.click(screen.getByRole("checkbox", { name: "Yes" }))
    expect(onLivedChange).toHaveBeenLastCalledWith("yes")
    fireEvent.click(screen.getByRole("checkbox", { name: "Partly" }))
    expect(onLivedChange).toHaveBeenLastCalledWith(null)
  })

  it("celebrates a yes from its button, and nothing else", () => {
    const { rerender, onLivedChange } = renderRecap({ ...day, intention: "stay calm" })
    fireEvent.click(screen.getByRole("checkbox", { name: "No" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Partly" }))
    expect(celebrate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("checkbox", { name: "Yes" }))
    expect(celebrate).toHaveBeenCalledTimes(1)
    expect(vi.mocked(celebrate).mock.calls[0]?.[0].textContent).toBe("Yes")

    // Clearing a yes is not a celebration.
    rerender(
      <>
        <MorningRecap date={date} config={config} />
        <LivedRating date={date} value="yes" onChange={onLivedChange} />
      </>,
    )
    fireEvent.click(screen.getByRole("checkbox", { name: "Yes" }))
    expect(celebrate).toHaveBeenCalledTimes(1)
  })

  it("follows a morning saved into the cache after it opened", async () => {
    const { container } = renderRecap(day)
    expect(container.innerHTML).toBe("")
    // What /morning's save does to the day's cache when it lands.
    act(() => {
      queryClient.setQueryData(
        dayQuery(date).queryKey,
        (d) =>
          d && {
            ...d,
            entry: withMorning(d.entry, { intention: "walk", metrics: { sleep: 4 } }, config),
          },
      )
    })
    // The query notifies its readers on the next tick.
    const card = await screen.findByRole("region", { name: "This morning" })
    expect(card.textContent).toContain("walk")
    expect(screen.getByText("sleep").nextSibling?.textContent).toBe("4/5")
    expect(
      screen.getByRole("group", { name: "Did you live your morning intention?" }),
    ).toBeDefined()
  })
})

// The chips wired to the evening editor, as on /reflect.
function Evening() {
  const { entry, setEntry } = useEntryAutosave(config, {
    entry: { ...day, intention: "stay calm" },
    unsynced: false,
  })
  return (
    <LivedRating
      date={date}
      value={entry.intentionLived}
      onChange={(value) =>
        setEntry((e) => ({ ...e, intentionLived: value, updatedAt: new Date().toISOString() }))
      }
    />
  )
}

describe("the lived rating through the evening autosave", () => {
  const wait = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })

  it("saves the tapped rating with the day, and null once it's cleared", async () => {
    vi.useFakeTimers()
    render(<Evening />, { wrapper: cacheDay({ ...day, intention: "stay calm" }) })

    fireEvent.click(screen.getByRole("checkbox", { name: "Yes" }))
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Yes" }).checked).toBe(true)
    await wait(800)
    expect(saveDay).toHaveBeenLastCalledWith(
      expect.objectContaining({ date, intentionLived: "yes" }),
      config,
    )

    fireEvent.click(screen.getByRole("checkbox", { name: "Yes" }))
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Yes" }).checked).toBe(false)
    await wait(800)
    expect(saveDay).toHaveBeenCalledTimes(2)
    expect(saveDay).toHaveBeenLastCalledWith(
      expect.objectContaining({ intentionLived: null }),
      config,
    )
  })
})
