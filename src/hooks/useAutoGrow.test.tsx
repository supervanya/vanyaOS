// @vitest-environment jsdom
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useAutoGrow } from "./useAutoGrow"

// jsdom has no layout: fake scrollHeight as 20px per line of content.
Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
  configurable: true,
  get(this: HTMLTextAreaElement) {
    return this.value.split("\n").length * 20
  },
})
window.scrollTo = vi.fn()

function Field({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  const ref = useAutoGrow(value)
  return <textarea ref={ref} value={value} onChange={(e) => setValue(e.target.value)} />
}

afterEach(cleanup)

describe("useAutoGrow", () => {
  it("fits a textarea that mounts with content already in it", () => {
    render(<Field initial={"a\nb\nc"} />)
    expect(screen.getByRole("textbox").style.height).toBe("60px")
  })

  it("grows and shrinks as the value changes", () => {
    render(<Field />)
    const ta = screen.getByRole("textbox")
    expect(ta.style.height).toBe("20px")
    fireEvent.change(ta, { target: { value: "1\n2\n3\n4" } })
    expect(ta.style.height).toBe("80px")
    fireEvent.change(ta, { target: { value: "1" } })
    expect(ta.style.height).toBe("20px")
  })
})
