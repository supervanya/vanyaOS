// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, render, screen } from "@testing-library/react"
import { Suspense, type ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DayEntry, LoadedDay } from "./api"
import { IntentionGlance } from "./IntentionGlance"
import { dayQuery } from "./queries"

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }))
// A plain anchor stands in for the router's Link.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

const date = "2026-11-12"
const entry: DayEntry = {
  date,
  theme: "recovery",
  metrics: {},
  habits: {},
  reflection: "",
  intention: "",
  intentionLived: null,
  updatedAt: "2026-11-12T07:00:00.000Z",
}

let queryClient: QueryClient

function renderGlance(day: LoadedDay) {
  queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  queryClient.setQueryData(dayQuery(date).queryKey, day)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>{children}</Suspense>
    </QueryClientProvider>
  )
  return render(<IntentionGlance date={date} />, { wrapper })
}

const card = () => screen.queryByRole("link")

afterEach(cleanup)

describe("IntentionGlance", () => {
  it("shows the intention as a link to /morning", () => {
    renderGlance({ entry: { ...entry, intention: "  one thing at a time\n" }, unsynced: false })
    expect(card()?.getAttribute("href")).toBe("/morning")
    expect(card()?.textContent).toContain("one thing at a time")
  })

  it("is absent when the day has no intention text", () => {
    renderGlance({ entry: { ...entry, intention: " \n " }, unsynced: false })
    expect(card()).toBeNull()
  })

  it("picks up a morning saved this session, without a refetch", async () => {
    renderGlance({ entry, unsynced: false })
    expect(card()).toBeNull()
    act(() => {
      queryClient.setQueryData(dayQuery(date).queryKey, {
        entry: { ...entry, intention: "call mum" },
        unsynced: false,
      })
    })
    expect((await screen.findByRole("link")).textContent).toContain("call mum")
  })
})
