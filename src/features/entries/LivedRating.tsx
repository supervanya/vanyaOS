import { useSuspenseQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { INTENTION_LIVED, type IntentionLived } from "./api"
import { celebrate } from "./celebrate"
import { LivedScene, type Scene } from "./LivedScene"
import { dayQuery } from "./queries"

const LABEL = {
  no: "No",
  partly: "Partly",
  yes: "Yes",
} satisfies Record<IntentionLived, string>

const CAPTION = {
  none: "How did the day go?",
  no: "Not today",
  partly: "Got halfway",
  yes: "Lived it",
} satisfies Record<Scene, string>

const BUTTON_ON = {
  no: "border-[#1B1F4B] bg-[#1B1F4B] text-white",
  partly: "border-[#F58E6C] bg-[#F58E6C] text-[#2A0E05]",
  yes: "border-[#1E7A49] bg-[#1E7A49] text-white",
} satisfies Record<IntentionLived, string>

/**
 * "Did you live your morning intention?", the last step of the evening: the
 * morning's sun stays down, sits on the horizon, or rises over a dawn
 * landscape, by the answer (LivedScene). Renders nothing for a day
 * whose morning set no intention. At most one answer is on; tapping it again
 * clears it.
 *
 * Whether there is an intention comes from the day's query cache (see
 * MorningRecap); the rating itself is the evening's own field, so it comes
 * from the editor.
 */
export function LivedRating({
  date,
  value,
  onChange,
}: {
  date: string
  value: IntentionLived | null
  onChange: (value: IntentionLived | null) => void
}) {
  const { data } = useSuspenseQuery(dayQuery(date))
  if (!data.entry.intention.trim()) return null
  const scene: Scene = value ?? "none"

  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-[15px] font-medium">Did you live your morning intention?</legend>

      <LivedScene scene={scene} caption={CAPTION[scene]} />

      <div className="mt-2 grid grid-cols-3 gap-2">
        {INTENTION_LIVED.map((option) => {
          const on = value === option
          return (
            // A label over a native switch, as on HabitChip: the same haptics
            // and a tap that a scroll can't trigger.
            <label
              key={option}
              className={cn(
                "relative flex h-12 cursor-pointer touch-manipulation items-center justify-center rounded-xl border-2 text-[15px] font-semibold transition-[transform,background-color,border-color,color] select-none active:scale-95 has-focus-visible:ring-2 has-focus-visible:ring-ring motion-reduce:active:scale-100",
                on ? BUTTON_ON[option] : "border-border text-foreground",
              )}
            >
              {LABEL[option]}
              <input
                type="checkbox"
                {...{ switch: "" }}
                checked={on}
                onChange={(event) => {
                  const lived = option === "yes" && !on
                  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    navigator.vibrate?.(lived ? [10, 40, 20] : 7)
                  }
                  // Thrown from the Yes button itself (the label, not this
                  // invisible input).
                  if (lived) celebrate(event.currentTarget.parentElement ?? event.currentTarget)
                  onChange(on ? null : option)
                }}
                className="pointer-events-none absolute inset-0 m-0 size-full opacity-0 [clip-path:inset(0)]"
              />
            </label>
          )
        })}
      </div>
      {/* The scene is decoration; this is what a screen reader hears. */}
      <p className="sr-only" aria-live="polite">
        {value ? CAPTION[value] : ""}
      </p>
    </fieldset>
  )
}
