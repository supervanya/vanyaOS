import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { errorMessage } from "@/lib/errors"
import { MAX_NAME_LENGTH, appNameFor, cleanName, saveName } from "./api"
import { nameQuery } from "./queries"

/** Sets the account's name, previewing the app name it makes. */
export function NameForm({ onSaved }: { onSaved?: () => void }) {
  const queryClient = useQueryClient()
  const { data: saved = null } = useQuery(nameQuery)
  const [input, setInput] = useState(saved ?? "")
  const [saving, setSaving] = useState(false)
  const name = cleanName(input)

  const save = async () => {
    if (!name) return
    setSaving(true)
    try {
      await saveName(name)
      queryClient.setQueryData(nameQuery.queryKey, name)
      toast.success(`This is now ${appNameFor(name)}`)
      onSaved?.()
    } catch (err) {
      toast.error(`Didn't save: ${errorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div className="flex items-center gap-2">
        <Input
          name="name"
          autoComplete="given-name"
          aria-label="Your name"
          placeholder="Your name"
          maxLength={MAX_NAME_LENGTH}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={saving || !name || name === saved}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        The app will be called {appNameFor(name)}.
      </p>
    </form>
  )
}
