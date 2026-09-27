// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MetricSlider } from "./MetricSlider"

// Radix measures the thumb with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

// Radix captures the pointer on press, which jsdom doesn't implement either.
Object.assign(Element.prototype, {
  setPointerCapture() {},
  releasePointerCapture() {},
  hasPointerCapture: () => false,
})

afterEach(cleanup)

function renderSlider(value: number | undefined) {
  const onValueChange = vi.fn<(value: number | undefined) => void>()
  render(<MetricSlider value={value} onValueChange={onValueChange} tone="success" />)
  return { slider: screen.getByRole("slider"), onValueChange }
}

describe("MetricSlider", () => {
  it("sets an untouched slider to 0, even though it already rests there", () => {
    const { slider, onValueChange } = renderSlider(undefined)
    fireEvent.keyDown(slider, { key: "ArrowLeft" })
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith(0)
  })

  it("steps an untouched slider on from the start", () => {
    const { slider, onValueChange } = renderSlider(undefined)
    fireEvent.keyDown(slider, { key: "ArrowRight" })
    expect(onValueChange).toHaveBeenLastCalledWith(1)
  })

  it("leaves an untouched slider unset when you tab past it", () => {
    const { slider, onValueChange } = renderSlider(undefined)
    fireEvent.keyDown(slider, { key: "Tab" })
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("moves a set slider normally", () => {
    const { slider, onValueChange } = renderSlider(2)
    fireEvent.keyDown(slider, { key: "ArrowLeft" })
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith(1)
  })

  it("clears a slider set to 0 when tapped without moving", () => {
    const { slider, onValueChange } = renderSlider(0)
    fireEvent.pointerDown(slider)
    fireEvent.pointerUp(slider)
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith(undefined)
  })

  it("keeps a set slider above 0 when tapped", () => {
    const { slider, onValueChange } = renderSlider(2)
    fireEvent.pointerDown(slider)
    fireEvent.pointerUp(slider)
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("sets an untouched slider on tap, rather than clearing it", () => {
    const { slider, onValueChange } = renderSlider(undefined)
    fireEvent.pointerDown(slider)
    fireEvent.pointerUp(slider)
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith(0)
  })

  it("clears a set slider with Delete", () => {
    const { slider, onValueChange } = renderSlider(3)
    fireEvent.keyDown(slider, { key: "Delete" })
    expect(onValueChange).toHaveBeenCalledWith(undefined)
  })
})
