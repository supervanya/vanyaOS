import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export const Route = createFileRoute("/login")({ component: Login })

// The magic link's `token` query param is a token hash that verifyOtp accepts
// directly, so pasting the emailed link into the app completes sign-in without
// any navigation. That's the whole trick that lets the installed PWA log in:
// on iOS the PWA and the browser have separate storage partitions, so *tapping*
// the link signs in the browser, never the PWA.
function extractTokenHash(pasted: string): string | null {
  const raw = pasted.trim()
  if (!raw) return null
  try {
    const token = new URL(raw).searchParams.get("token")
    if (token) return token
  } catch {
    // Not a URL — assume they copied just the token itself.
    return raw
  }
  return null
}

function Login() {
  const [email, setEmail] = useState("")
  const [pastedLink, setPastedLink] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const { session } = useAuth()
  const navigate = useNavigate()

  // Signed in (whether just now via verifyOtp or already) → leave /login.
  useEffect(() => {
    if (session) navigate({ to: "/", replace: true })
  }, [session, navigate])

  const sendLink = async () => {
    if (!email || loading) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setSent(true)
  }

  const tokenHash = extractTokenHash(pastedLink)

  const verifyPastedLink = async () => {
    if (!tokenHash || loading) return
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    })
    setLoading(false)
    if (error) {
      // Links are single-use and expire after ~1h — resending is the fix.
      toast.error(error.message)
      return
    }
    // Success → onAuthStateChange sets the session; the effect above redirects.
  }

  if (sent) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center">
        <div className="w-full max-w-xs space-y-3 text-center">
          <p className="text-lg font-medium">Check your inbox</p>
          <p className="text-muted-foreground text-sm">
            Tap the link we sent to {email} — or, in the installed app, copy the
            link from the email and paste it here:
          </p>
          <Input
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="Paste the sign-in link"
            value={pastedLink}
            onChange={(e) => setPastedLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && verifyPastedLink()}
          />
          <Button
            className="w-full"
            onClick={verifyPastedLink}
            disabled={loading || !tokenHash}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setSent(false)
              setPastedLink("")
            }}
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center">
      <div className="w-full max-w-xs space-y-3">
        <p className="text-center text-lg font-medium">VanyaOS</p>
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendLink()}
        />
        <Button className="w-full" onClick={sendLink} disabled={loading || !email}>
          {loading ? "Sending…" : "Send magic link"}
        </Button>
      </div>
    </div>
  )
}
