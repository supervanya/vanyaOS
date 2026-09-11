import { describe, expect, it } from "vitest"
import { withSortOrderSlots } from "./sortOrder"

const row = (id: string, sortOrder: number) => ({ id, sortOrder })

describe("withSortOrderSlots", () => {
  it("hands the existing slots out in the new order", () => {
    // Slots 0, 3, 7 — the gaps belong to archived rows and must stay free.
    const reordered = [row("c", 7), row("a", 0), row("b", 3)]
    expect(withSortOrderSlots(reordered)).toEqual([row("c", 0), row("a", 3), row("b", 7)])
  })

  it("leaves rows that didn't move untouched", () => {
    const reordered = [row("a", 0), row("c", 2), row("b", 1), row("d", 3)]
    expect(withSortOrderSlots(reordered)).toEqual([
      row("a", 0),
      row("c", 1),
      row("b", 2),
      row("d", 3),
    ])
  })

  it("bumps duplicate slots apart so the order sticks", () => {
    const reordered = [row("b", 1), row("a", 1)]
    expect(withSortOrderSlots(reordered)).toEqual([row("b", 1), row("a", 2)])
  })
})
