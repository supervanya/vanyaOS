import { useSuspenseQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { INTENTION_LIVED, type IntentionLived } from "./api"
import { dayQuery } from "./queries"

type Scene = IntentionLived | "none"

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

// The scene is its own little picture, so its colours are fixed and don't
// follow the theme: a night sky has to stay dark in light mode too. Each text
// colour is picked to pass contrast on the ground it sits on.
const SKY = {
  none: "bg-zinc-200 dark:bg-zinc-800",
  no: "bg-[#1B1F4B]",
  partly: "bg-[#FF7A59]",
  yes: "bg-[#2F9BFF]",
} satisfies Record<Scene, string>

const GROUND = {
  none: "bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  no: "bg-[#0E1030] text-white",
  partly: "bg-[#B8432A] text-white",
  yes: "bg-[#1FCB7A] text-[#06301C]",
} satisfies Record<Scene, string>

// How far the sun has risen. The ground starts 112px down the 160px scene.
const SUN = {
  none: "top-[88px] bg-zinc-400 dark:bg-zinc-500",
  no: "top-[100px] bg-[#8B8FD9]",
  partly: "top-[76px] bg-[#FFE08A]",
  yes: "top-[30px] bg-[#FFD21F]",
} satisfies Record<Scene, string>

const BUTTON_ON = {
  no: "border-[#1B1F4B] bg-[#1B1F4B] text-white",
  partly: "border-[#FF7A59] bg-[#FF7A59] text-[#2A0E05]",
  yes: "border-[#2F9BFF] bg-[#2F9BFF] text-[#06213F]",
} satisfies Record<IntentionLived, string>

/**
 * "Did I live it?", the last step of the evening: the morning's sun stays
 * down, sits on the horizon or rises, by the answer. Renders nothing for a day
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
      <legend className="mb-2 text-[15px] font-medium">Did I live it?</legend>

      <div
        aria-hidden="true"
        className={cn(
          "relative h-40 overflow-hidden rounded-2xl transition-colors duration-500",
          SKY[scene],
        )}
      >
        <svg
          viewBox="0 0 320 100"
          fill="white"
          className={cn(
            "absolute inset-x-0 top-0 h-24 w-full transition-opacity duration-500",
            scene === "no" ? "opacity-100" : "opacity-0",
          )}
        >
          <circle cx="38" cy="26" r="2" />
          <circle cx="92" cy="58" r="1.5" />
          <circle cx="146" cy="20" r="2.5" />
          <circle cx="204" cy="48" r="1.5" />
          <circle cx="258" cy="24" r="2" />
          <circle cx="292" cy="70" r="1.5" />
          <circle cx="60" cy="86" r="1.5" />
        </svg>
        <div
          className={cn(
            "absolute left-1/2 -ml-9 size-18 rounded-full transition-[top,background-color] duration-700 ease-[cubic-bezier(.3,1.5,.5,1)] motion-reduce:transition-none",
            SUN[scene],
          )}
        >
          <svg
            viewBox="-70 -70 140 140"
            stroke="#FFD21F"
            strokeWidth="6"
            strokeLinecap="round"
            className={cn(
              "absolute -inset-8 animate-spin transition-opacity delay-300 duration-300 [animation-duration:14s] motion-reduce:animate-none",
              scene === "yes" ? "opacity-100" : "opacity-0",
            )}
          >
            <path d="M0-50V-64M0 50V64M-50 0H-64M50 0H64M-35-35L-45-45M35 35L45 45M-35 35L-45 45M35-35L45-45" />
          </svg>
        </div>
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex h-12 items-center justify-center text-[15px] font-semibold transition-colors duration-500",
            GROUND[scene],
          )}
        >
          {CAPTION[scene]}
        </div>
      </div>

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
                onChange={() => {
                  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    navigator.vibrate?.(on ? 7 : option === "yes" ? [10, 40, 20] : 7)
                  }
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
