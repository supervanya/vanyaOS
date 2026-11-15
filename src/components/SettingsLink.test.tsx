// @vitest-environment jsdom
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { SettingsLink } from "./SettingsLink"

afterEach(cleanup)

async function renderLink(props: Parameters<typeof SettingsLink>[0]) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <SettingsLink {...props} /> }),
    history: createMemoryHistory(),
  })
  render(<RouterProvider router={router} />)
  return screen.findByRole("link", { name: /settings/i })
}

describe("SettingsLink", () => {
  it("links to the section's anchor, with a hint while the list is empty", async () => {
    const link = await renderLink({ section: "habits", empty: true })
    expect(link.getAttribute("href")).toBe("/settings#habits")
    expect(screen.getByText("No habits yet.")).toBeTruthy()
  })

  it("keeps only the link once the list is configured", async () => {
    await renderLink({ section: "habits", empty: false, hint: "Add one" })
    expect(screen.queryByText("No habits yet.")).toBeNull()
    expect(screen.queryByText("Add one")).toBeNull()
  })

  it("shows a custom hint instead of the default", async () => {
    await renderLink({ section: "metrics", empty: true, hint: "No morning metrics." })
    expect(screen.getByText("No morning metrics.")).toBeTruthy()
    expect(screen.queryByText("No metrics yet.")).toBeNull()
  })
})
