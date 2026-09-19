import { describe, expect, it } from "vitest"
import { isOneOf, oneOf } from "./parse"

const SIZES = ["big", "medium", "small"] as const

describe("oneOf", () => {
  it("passes through a value from the allowed set", () => {
    expect(oneOf(SIZES, "medium", "tasks.size")).toBe("medium")
  })

  it("throws, naming the column, when the database returns something else", () => {
    expect(() => oneOf(SIZES, "huge", "tasks.size")).toThrow('Unexpected tasks.size "huge"')
  })
})

describe("isOneOf", () => {
  it("narrows only exact matches", () => {
    expect(isOneOf(SIZES, "small")).toBe(true)
    expect(isOneOf(SIZES, "Small")).toBe(false)
    expect(isOneOf(SIZES, "")).toBe(false)
  })
})
