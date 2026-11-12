// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { saveMorningPrefs, type MorningPrefs } from "./api"
import { fromClock, MorningSection, toClock } from "./MorningSection"
import { morningPrefsQuery } from "./queries"

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }))
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  saveMorningPrefs: vi.fn<typeof saveMorningPrefs>(() => Promise.resolve()),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn<(message: string) => void>() } }))

const defaults: MorningPrefs = { redirect: true, closesAt: 720 }

function renderSection(prefs = defaults) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(morningPrefsQuery.queryKey, prefs)
  render(
    <QueryClientProvider client={queryClient}>
      <MorningSection />
    </QueryClientProvider>,
  )
  return queryClient
}
const time = () => screen.getByLabelText<HTMLInputElement>("Morning closes at")
const toggle = () => screen.getByRole("checkbox")

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("clock conversion", () => {
  it("round-trips minutes and HH:MM", () => {
    expect(toClock(720)).toBe("12:00")
    expect(toClock(9 * 60 + 5)).toBe("09:05")
    expect(fromClock("09:05")).toBe(545)
  })

  it("rejects what isn't a time", () => {
    expect(fromClock("")).toBeNull()
    expect(fromClock("24:00")).toBeNull()
    expect(fromClock("10:75")).toBeNull()
  })
})

describe("MorningSection", () => {
  it("shows the defaults: on, closing at noon", () => {
    renderSection()
    expect(toggle().getAttribute("aria-checked")).toBe("true")
    expect(time().value).toBe("12:00")
    expect(time().disabled).toBe(false)
  })

  it("turns the redirect off, at once, and greys out the time", async () => {
    const queryClient = renderSection()
    fireEvent.click(toggle())
    expect(saveMorningPrefs).toHaveBeenCalledWith({ redirect: false, closesAt: 720 })
    expect(queryClient.getQueryData(morningPrefsQuery.queryKey)?.redirect).toBe(false)
    await waitFor(() => expect(time().disabled).toBe(true))
  })

  it("saves a new closing time when the field is left", () => {
    renderSection()
    fireEvent.change(time(), { target: { value: "10:30" } })
    expect(saveMorningPrefs).not.toHaveBeenCalled()
    fireEvent.blur(time())
    expect(saveMorningPrefs).toHaveBeenCalledWith({ redirect: true, closesAt: 630 })
  })

  it("doesn't write when the time is unchanged", () => {
    renderSection()
    fireEvent.blur(time())
    expect(saveMorningPrefs).not.toHaveBeenCalled()
  })

  it("refuses a time before the day starts, and puts the old one back", () => {
    renderSection()
    fireEvent.change(time(), { target: { value: "03:00" } })
    fireEvent.blur(time())
    expect(saveMorningPrefs).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(time().value).toBe("12:00")
  })

  it("puts the setting back when the write fails", async () => {
    vi.mocked(saveMorningPrefs).mockRejectedValueOnce(new Error("offline"))
    const queryClient = renderSection()
    fireEvent.click(toggle())
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(queryClient.getQueryData(morningPrefsQuery.queryKey)).toEqual(defaults)
    expect(toggle().getAttribute("aria-checked")).toBe("true")
  })
})
