type Sorted = { sortOrder: number }

// Give a reordered list new sort_order values by handing out the slots it
// already occupies, in the new order. Rows outside the list (e.g. archived
// ones) keep their places, and rows that didn't move keep their values — so
// only the rows that actually moved need writing. Duplicate slots are bumped
// apart so the new order is always strict.
export function withSortOrderSlots<T extends Sorted>(reordered: T[]): T[] {
  const slots: number[] = []
  for (const slot of reordered.map((r) => r.sortOrder).toSorted((a, b) => a - b)) {
    const prev = slots.at(-1)
    slots.push(prev === undefined ? slot : Math.max(slot, prev + 1))
  }
  return reordered.map((r, i) => ({ ...r, sortOrder: slots[i] ?? r.sortOrder }))
}

export const bySortOrder = (a: Sorted, b: Sorted) => a.sortOrder - b.sortOrder
