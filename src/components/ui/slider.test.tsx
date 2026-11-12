// @vitest-environment jsdom
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

describe("Slider, touch", () => {
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
    fireEvent.pointerMove(track, finger(63, 11))
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
