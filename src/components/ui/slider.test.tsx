// @vitest-environment jsdom
import { createRef } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Slider } from "./slider"

// Radix measures the thumb with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

// jsdom has no pointer capture; Radix only slides while it holds the pointer.
const captured = new Map<number, Element>()
Object.assign(Element.prototype, {
  setPointerCapture(this: Element, id: number) {
    captured.set(id, this)
  },
  releasePointerCapture(id: number) {
    captured.delete(id)
  },
  hasPointerCapture(this: Element, id: number) {
    return captured.get(id) === this
  },
})

beforeEach(() => {
  // A 100px-wide track at the left edge, so clientX reads as the value.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 20))
})

afterEach(() => {
  cleanup()
  captured.clear()
  vi.restoreAllMocks()
})

function renderSlider() {
  const onValueChange = vi.fn<(values: number[]) => void>()
  const onValueCommit = vi.fn<(values: number[]) => void>()
  const onPointerDown = vi.fn<(event: React.PointerEvent) => void>()
  render(
    <Slider
      defaultValue={[10]}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      onPointerDown={onPointerDown}
    />,
  )
  const track = document.querySelector("[data-slot=slider]")
  if (!track) throw new Error("slider not rendered")
  return { track, thumb: screen.getByRole("slider"), onValueChange, onValueCommit, onPointerDown }
}

const finger = (clientX: number, clientY: number) => ({
  pointerId: 1,
  pointerType: "touch",
  clientX,
  clientY,
})

/** Sends a one-finger touchmove and reports whether the slider cancelled it (stopping the scroll). */
function touchMoveBlocked(el: Element) {
  const move = new Event("touchmove", { bubbles: true, cancelable: true })
  Object.defineProperty(move, "touches", { value: [{}] })
  el.dispatchEvent(move)
  return move.defaultPrevented
}

describe("Slider, touch", () => {
  it("forwards object and callback refs alongside the scroll lock", () => {
    const ref = createRef<HTMLSpanElement>()
    const detach = vi.fn<() => void>()
    const callback = vi.fn<(node: HTMLSpanElement | null) => () => void>(() => detach)
    const { rerender, unmount } = render(<Slider ref={ref} defaultValue={[10]} />)
    const root = ref.current
    if (!root) throw new Error("slider ref was not attached")
    expect(root.getAttribute("data-slot")).toBe("slider")

    rerender(<Slider ref={callback} defaultValue={[10]} />)
    expect(ref.current).toBeNull()
    expect(callback).toHaveBeenCalledWith(root)
    fireEvent.pointerDown(root, finger(60, 10))
    fireEvent.pointerMove(root, finger(70, 10))
    expect(touchMoveBlocked(root)).toBe(true)
    unmount()
    expect(detach).toHaveBeenCalledTimes(1)
    expect(touchMoveBlocked(root)).toBe(false)
  })

  it("leaves disabled gestures to the page, including when disabled mid-drag", () => {
    const change = vi.fn<(values: number[]) => void>()
    const commit = vi.fn<(values: number[]) => void>()
    const props = { defaultValue: [10], onValueChange: change, onValueCommit: commit }
    const { rerender } = render(<Slider disabled {...props} />)
    const thumb = screen.getByRole("slider")
    fireEvent.pointerDown(thumb, finger(10, 10))
    fireEvent.pointerMove(thumb, finger(30, 11))
    expect(touchMoveBlocked(thumb)).toBe(false)
    rerender(<Slider {...props} />)
    fireEvent.pointerMove(thumb, finger(35, 11))
    fireEvent.pointerUp(thumb, finger(35, 11))
    expect(change).not.toHaveBeenCalled()

    fireEvent.pointerDown(thumb, finger(10, 10))
    fireEvent.pointerMove(thumb, finger(40, 11))
    fireEvent.pointerMove(thumb, finger(45, 11))
    expect(touchMoveBlocked(thumb)).toBe(true)
    rerender(<Slider disabled {...props} />)
    expect(touchMoveBlocked(thumb)).toBe(false)
    fireEvent.pointerCancel(thumb, finger(45, 11))
    expect(commit).not.toHaveBeenCalled()
  })

  it("waits through a tied start on the thumb and accepts the next horizontal move", () => {
    const { thumb, onPointerDown, onValueChange, onValueCommit } = renderSlider()
    fireEvent.pointerDown(thumb, finger(10, 10))
    fireEvent.pointerMove(thumb, finger(12, 12))
    expect(onPointerDown).not.toHaveBeenCalled()
    fireEvent.pointerMove(thumb, finger(21.33, 15))
    expect(onPointerDown).toHaveBeenCalledTimes(1)
    fireEvent.pointerMove(thumb, finger(28.67, 15))
    fireEvent.pointerUp(thumb, finger(28.67, 15))
    expect(onValueChange).toHaveBeenLastCalledWith([29])
    expect(onValueCommit).toHaveBeenCalledTimes(1)
  })

  it.each([0, 12])(
    "leaves the value alone when a near tie ends or turns vertical (%i px)",
    (dy) => {
      const { track, onPointerDown, onValueChange, onValueCommit } = renderSlider()
      fireEvent.pointerDown(track, finger(60, 10))
      fireEvent.pointerMove(track, finger(62.33, 12))
      if (dy) fireEvent.pointerMove(track, finger(63, 10 + dy))
      fireEvent.pointerUp(track, finger(63, 12 + dy))
      expect(onPointerDown).not.toHaveBeenCalled()
      expect(onValueChange).not.toHaveBeenCalled()
      expect(onValueCommit).not.toHaveBeenCalled()
    },
  )

  it("does nothing when a finger lands on the track", () => {
    const { track, thumb, onPointerDown, onValueChange } = renderSlider()
    fireEvent.pointerDown(track, finger(60, 10))
    expect(onPointerDown).not.toHaveBeenCalled()
    expect(onValueChange).not.toHaveBeenCalled()
    expect(thumb.getAttribute("aria-valuenow")).toBe("10")
  })

  it("leaves the value alone when the finger scrolls the page", () => {
    const { track, thumb, onPointerDown, onValueChange, onValueCommit } = renderSlider()
    fireEvent.pointerDown(track, finger(60, 10))
    fireEvent.pointerMove(track, finger(62, 30))
    fireEvent.pointerMove(track, finger(90, 80))
    fireEvent.pointerCancel(track, finger(90, 80))
    expect(onPointerDown).not.toHaveBeenCalled()
    expect(onValueChange).not.toHaveBeenCalled()
    expect(onValueCommit).not.toHaveBeenCalled()
    expect(thumb.getAttribute("aria-valuenow")).toBe("10")
  })

  it("ignores a vertical drag even if the browser never cancels it", () => {
    const { track, thumb, onValueChange } = renderSlider()
    fireEvent.pointerDown(track, finger(60, 10))
    fireEvent.pointerMove(track, finger(62, 30))
    fireEvent.pointerMove(track, finger(90, 32))
    fireEvent.pointerUp(track, finger(90, 32))
    expect(onValueChange).not.toHaveBeenCalled()
    expect(thumb.getAttribute("aria-valuenow")).toBe("10")
  })

  it("slides once the finger moves along the track, and commits on release", () => {
    const { track, thumb, onPointerDown, onValueCommit } = renderSlider()
    fireEvent.pointerDown(track, finger(60, 10))
    fireEvent.pointerMove(track, finger(61, 11))
    expect(thumb.getAttribute("aria-valuenow")).toBe("10")
    fireEvent.pointerMove(track, finger(70, 12))
    expect(onPointerDown).toHaveBeenCalledTimes(1)
    expect(thumb.getAttribute("aria-valuenow")).toBe("70")
    fireEvent.pointerMove(track, finger(40, 12))
    expect(thumb.getAttribute("aria-valuenow")).toBe("40")
    expect(onValueCommit).not.toHaveBeenCalled()
    fireEvent.pointerUp(track, finger(40, 12))
    expect(onValueCommit).toHaveBeenCalledTimes(1)
    expect(onValueCommit).toHaveBeenCalledWith([40])
  })

  it("sets and commits the value on a tap, when the finger lifts", () => {
    const { track, thumb, onPointerDown, onValueChange, onValueCommit } = renderSlider()
    fireEvent.pointerDown(track, finger(60, 10))
    expect(onValueChange).not.toHaveBeenCalled()
    fireEvent.pointerUp(track, finger(61, 10))
    expect(onPointerDown).toHaveBeenCalledTimes(1)
    expect(thumb.getAttribute("aria-valuenow")).toBe("61")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueCommit).toHaveBeenCalledTimes(1)
    expect(onValueCommit).toHaveBeenCalledWith([61])
  })

  it("stops the page from scrolling only while sliding", () => {
    const { track } = renderSlider()
    fireEvent.pointerDown(track, finger(60, 10))
    expect(touchMoveBlocked(track)).toBe(false)
    fireEvent.pointerMove(track, finger(70, 10))
    expect(touchMoveBlocked(track)).toBe(true)
    fireEvent.pointerUp(track, finger(70, 10))
    expect(touchMoveBlocked(track)).toBe(false)
  })

  it("never stops a vertical swipe from scrolling the page", () => {
    const { track } = renderSlider()
    fireEvent.pointerDown(track, finger(60, 10))
    fireEvent.pointerMove(track, finger(61, 20))
    expect(touchMoveBlocked(track)).toBe(false)
  })

  it("commits what a slide reached if the browser cancels it", () => {
    const { track, onValueCommit } = renderSlider()
    fireEvent.pointerDown(track, finger(60, 10))
    fireEvent.pointerMove(track, finger(75, 10))
    fireEvent.pointerCancel(track, finger(75, 10))
    expect(onValueCommit).toHaveBeenCalledTimes(1)
    expect(onValueCommit).toHaveBeenCalledWith([75])
  })
})

describe("Slider, mouse", () => {
  it("sets the value as soon as the track is pressed", () => {
    const { track, thumb, onPointerDown } = renderSlider()
    fireEvent.pointerDown(track, { pointerId: 2, pointerType: "mouse", clientX: 60, clientY: 10 })
    expect(onPointerDown).toHaveBeenCalledTimes(1)
    expect(thumb.getAttribute("aria-valuenow")).toBe("60")
  })
})
