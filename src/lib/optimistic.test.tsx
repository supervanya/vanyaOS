// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useOptimisticList } from "./optimistic"

vi.mock("sonner", () => ({ toast: { error: vi.fn<(message: string) => void>() } }))

const key = ["items"]
let queryClient: QueryClient
let serverItems: number[]

beforeEach(() => {
  vi.clearAllMocks()
  serverItems = [1, 2]
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryDefaults(key, { queryFn: () => Promise.resolve([...serverItems]) })
  queryClient.setQueryData(key, [1, 2])
})

function renderApply() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useOptimisticList<number>(key), { wrapper }).result
}

describe("useOptimisticList", () => {
  it("shows the change before the write finishes, then matches the database", async () => {
    const apply = renderApply()
    let finish = () => {}
    const write = () =>
      new Promise<void>((resolve) => {
        finish = () => {
          serverItems = [1, 2, 3]
          resolve()
        }
      })

    act(() => apply.current((items) => [...items, 3], write))
    await waitFor(() => expect(queryClient.getQueryData(key)).toEqual([1, 2, 3]))

    act(() => finish())
    await waitFor(() => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false))
    expect(queryClient.getQueryData(key)).toEqual([1, 2, 3])
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("rolls back and says so when the write fails", async () => {
    const apply = renderApply()
    act(() =>
      apply.current(
        (items) => [...items, 3],
        () => Promise.reject(new Error("offline")),
      ),
    )
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Didn't save: offline"))
    expect(queryClient.getQueryData(key)).toEqual([1, 2])
  })
})
