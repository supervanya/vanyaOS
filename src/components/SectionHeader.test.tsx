// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { SectionHeader } from "./SectionHeader"

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const hint = () => (
  <SectionHeader id="tasks" icon={null} heading="Tasks" title="How to use tasks">
    Do the big one first.
  </SectionHeader>
)

it("hides on 'Don't show again', remembers it, and comes back from the ⓘ", () => {
  const { unmount } = render(hint())
  fireEvent.click(screen.getByText("Don't show again"))
  expect(screen.queryByText("How to use tasks")).toBeNull()
  unmount()

  render(hint())
  expect(screen.queryByText("How to use tasks")).toBeNull()
  fireEvent.click(screen.getByLabelText("About Tasks"))
  expect(screen.getByText("How to use tasks")).toBeTruthy()
  expect(localStorage.getItem("vanyaos:hint-hidden:tasks")).toBeNull()
})
