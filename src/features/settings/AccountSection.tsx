import { UserRound } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { errorMessage } from "@/lib/errors"
import { supabase } from "@/lib/supabaseClient"

export function AccountSection() {
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPassword("")
      toast.success("Password saved")
    } catch (err) {
      toast.error(`Didn't save: ${errorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  // This device only: the default would also sign out the phone or the Mac.
  // The app reacts to the sign-out itself (main.tsx) and goes to /login.
  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" })
    if (error) toast.error(errorMessage(error))
    else toast.success("Signed out")
  }

  return (
    <section className="mt-6">
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserRound size={14} /> Account
      </p>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Input
          type="password"
          name="new-password"
          autoComplete="new-password"
          aria-label="New password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={saving || !password}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </form>
      <Button variant="outline" className="mt-3" onClick={() => void signOut()}>
        Sign out
      </Button>
    </section>
  )
}
