import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createSaveTracker, SAVED_VISIBLE_MS } from "./saveStatus"

let tracker: ReturnType<typeof createSaveTracker>

beforeEach(() => {
  vi.useFakeTimers()
  tracker = createSaveTracker()
})
afterEach(() => vi.useRealTimers())

describe("save tracker", () => {
  it("shows saving until the write lands, then saved, then goes quiet", () => {
    expect(tracker.get()).toBe("idle")
    const settle = tracker.begin()
    expect(tracker.get()).toBe("saving")
    settle("saved")
    expect(tracker.get()).toBe("saved")
    vi.advanceTimersByTime(SAVED_VISIBLE_MS)
    expect(tracker.get()).toBe("idle")
  })

  it("stays saving until every overlapping write lands", () => {
    const first = tracker.begin()
    const second = tracker.begin()
    first("saved")
    expect(tracker.get()).toBe("saving")
    second("saved")
    expect(tracker.get()).toBe("saved")
  })

  it("reports a failure anywhere in the round, and keeps it", () => {
    const first = tracker.begin()
    const second = tracker.begin()
    first("failed")
    expect(tracker.get()).toBe("saving")
    second("saved")
    expect(tracker.get()).toBe("failed")
    vi.advanceTimersByTime(SAVED_VISIBLE_MS * 10)
    expect(tracker.get()).toBe("failed")
  })

  it("clears a failure once a later round succeeds", () => {
    tracker.begin()("failed")
    tracker.begin()("saved")
    expect(tracker.get()).toBe("saved")
  })

  it("doesn't go quiet while a new write is under way", () => {
    tracker.begin()("saved")
    const settle = tracker.begin()
    vi.advanceTimersByTime(SAVED_VISIBLE_MS)
    expect(tracker.get()).toBe("saving")
    settle("saved")
    expect(tracker.get()).toBe("saved")
  })

  it("ignores a token settled twice", () => {
    const first = tracker.begin()
    const second = tracker.begin()
    first("saved")
    first("saved")
    expect(tracker.get()).toBe("saving")
    second("saved")
    expect(tracker.get()).toBe("saved")
  })

  it("tracks a promise and passes its outcome through", async () => {
    await expect(tracker.track(Promise.resolve(42))).resolves.toBe(42)
    expect(tracker.get()).toBe("saved")
    await expect(tracker.track(Promise.reject(new Error("offline")))).rejects.toThrow("offline")
    expect(tracker.get()).toBe("failed")
  })

  it("notifies subscribers on each change, and stops after unsubscribing", () => {
    const listener = vi.fn<() => void>()
    const unsubscribe = tracker.subscribe(listener)
    const settle = tracker.begin()
    settle("saved")
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    vi.advanceTimersByTime(SAVED_VISIBLE_MS)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
