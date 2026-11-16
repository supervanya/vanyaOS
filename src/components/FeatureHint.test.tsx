// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { FeatureHint } from "./FeatureHint"

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const hint = () => (
  <FeatureHint id="tasks" heading="Tasks" title="How to use tasks">
    Do the big one first.
  </FeatureHint>
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
