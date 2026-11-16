import type { Session } from "@supabase/supabase-js"
import { afterEach, describe, expect, it, vi } from "vitest"

import { appNameFor, cleanName, loadName } from "./api"
import { manifestFor } from "./manifest"

type GetSession = () => Promise<{ data: { session: Session | null }; error: Error | null }>

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn<GetSession>() }))
vi.mock("@/lib/supabaseClient", () => ({ supabase: { auth: { getSession } } }))

afterEach(() => vi.clearAllMocks())

// Only `user.user_metadata` is read; the rest of Session is irrelevant here.
const withMetadata = (user_metadata: Record<string, unknown>) =>
  ({ data: { session: { user: { user_metadata } } as Session }, error: null }) as const

describe("appNameFor", () => {
  it("suffixes the name with OS", () => expect(appNameFor("Vanya")).toBe("VanyaOS"))
  it("falls back to the default without a name", () => expect(appNameFor(null)).toBe("MyOS"))
})

describe("cleanName", () => {
  it("trims and collapses spaces", () => expect(cleanName("  Mary   Jo ")).toBe("Mary Jo"))
  it("is null when blank", () => expect(cleanName("   ")).toBeNull())
})

describe("loadName", () => {
  it("reads the name from the account's metadata", async () => {
    getSession.mockResolvedValue(withMetadata({ display_name: " John " }))
    expect(await loadName()).toBe("John")
  })

  it("is null when the account has no name or a malformed one", async () => {
    getSession.mockResolvedValue(withMetadata({}))
    expect(await loadName()).toBeNull()
    getSession.mockResolvedValue(withMetadata({ display_name: 42 }))
    expect(await loadName()).toBeNull()
  })

  it("is null when nobody is signed in", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null })
    expect(await loadName()).toBeNull()
  })
})

describe("manifestFor", () => {
  it("renames the app and keeps its identity, with absolute URLs", () => {
    const manifest = manifestFor("JohnOS", "https://example.com/vanyaOS/")
    expect(manifest.name).toBe("JohnOS")
    expect(manifest.short_name).toBe("JohnOS")
    expect(manifest.start_url).toBe("https://example.com/vanyaOS/")
    expect(manifest.scope).toBe("https://example.com/vanyaOS/")
    expect(manifest.icons[0]?.src).toBe("https://example.com/vanyaOS/logo192.png")
  })
})
