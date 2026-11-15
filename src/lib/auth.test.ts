import { AuthApiError, AuthRetryableFetchError, type Session } from "@supabase/supabase-js"
import { afterEach, describe, expect, it, vi } from "vitest"

import { currentUserId, isSignedIn } from "./auth"

type GetSession = () => Promise<{
  data: { session: Session | null }
  error: Error | null
}>

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn<GetSession>() }))
vi.mock("@/lib/supabaseClient", () => ({ supabase: { auth: { getSession } } }))

afterEach(() => vi.clearAllMocks())

// Only `user.id` is read; the rest of Session is irrelevant here.
const session = { user: { id: "user-1" } } as Session
const offline = new AuthRetryableFetchError("Failed to fetch", 0)
const revoked = new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found")

describe("isSignedIn", () => {
  it("is true with a session", async () => {
    getSession.mockResolvedValue({ data: { session }, error: null })
    expect(await isSignedIn()).toBe(true)
  })

  it("is false with no stored session", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null })
    expect(await isSignedIn()).toBe(false)
  })

  // Cold start offline with an expired token: the refresh can't reach the
  // server, the session stays stored, so this must not bounce to /login.
  it("stays true when the token refresh fails only because the network is down", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: offline })
    expect(await isSignedIn()).toBe(true)
  })

  it("is false when the refresh token is rejected", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: revoked })
    expect(await isSignedIn()).toBe(false)
  })

  it("is false when reading the session throws", async () => {
    getSession.mockRejectedValue(new Error("storage unavailable"))
    expect(await isSignedIn()).toBe(false)
  })
})

describe("currentUserId", () => {
  it("returns the session's user id", async () => {
    getSession.mockResolvedValue({ data: { session }, error: null })
    expect(await currentUserId()).toBe("user-1")
  })

  it("throws the network error when the refresh couldn't reach the server", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: offline })
    await expect(currentUserId()).rejects.toBe(offline)
  })

  it("throws Not authenticated with no session and no error", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null })
    await expect(currentUserId()).rejects.toThrow("Not authenticated")
  })
})
