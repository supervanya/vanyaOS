import * as React from "react"
import { flushSync } from "react-dom"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root>

/** How far a finger travels, in px, before a touch is a drag and not a tap. */
const TOUCH_SLOP = 8

type Touch = { x: number; y: number; phase: "pending" | "sliding" | "ignored" }

const isTouch = (e: React.PointerEvent) => e.pointerType === "touch" || e.pointerType === "pen"

/**
 * Keeps a finger that is scrolling the page from moving the slider.
 *
 * Radix sets the value the moment a pointer lands on the track, before anyone
 * can know whether the finger is about to scroll. For touch, this holds the
 * press back and hands it to Radix (and to the caller's own pointer handlers)
 * only once the gesture is clearly meant for the slider:
 *
 * - a drag along the slider starts sliding after `TOUCH_SLOP` px;
 * - a tap sets the value when the finger lifts;
 * - a drag across the slider is left to the browser, which scrolls the page
 *   (`touch-action: pan-y` on the root) and ends the touch with `pointercancel`.
 *
 * Mouse input is untouched.
 */
function useScrollSafeTouch({
  orientation,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onValueChange,
  onValueCommit,
}: SliderProps) {
  const vertical = orientation === "vertical"
  const touches = React.useRef(new Map<number, Touch>())
  const replaying = React.useRef(false)
  // The values reached by the slide in progress, for a slide the browser cancels.
  const slid = React.useRef<number[] | null>(null)

  // Re-sends a held-back press. Radix's handlers are only reachable as events.
  function replay(type: "pointerdown" | "pointerup", e: React.PointerEvent) {
    replaying.current = true
    try {
      e.target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          isPrimary: e.isPrimary,
          clientX: e.clientX,
          clientY: e.clientY,
          buttons: type === "pointerdown" ? 1 : 0,
        }),
      )
    } finally {
      replaying.current = false
    }
  }

  // Calling preventDefault() is how a handler passed to Radix tells it to skip its own.
  return {
    onPointerDown(e) {
      if (replaying.current || !isTouch(e)) return onPointerDown?.(e)
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY, phase: "pending" })
      // Keep the rest of the touch coming here, as Radix's own press would have.
      if (e.target instanceof Element) e.target.setPointerCapture(e.pointerId)
      e.preventDefault()
    },
    onPointerMove(e) {
      const touch = touches.current.get(e.pointerId)
      if (!touch || touch.phase === "sliding") return onPointerMove?.(e)
      e.preventDefault()
      if (touch.phase === "ignored") return

      const dx = Math.abs(e.clientX - touch.x)
      const dy = Math.abs(e.clientY - touch.y)
      const [along, across] = vertical ? [dy, dx] : [dx, dy]
      if (Math.max(along, across) < TOUCH_SLOP) return
      if (across >= along) {
        touch.phase = "ignored"
        return
      }
      touch.phase = "sliding"
      slid.current = null
      replay("pointerdown", e)
    },
    onPointerUp(e) {
      const touch = touches.current.get(e.pointerId)
      if (replaying.current || !touch) return onPointerUp?.(e)
      touches.current.delete(e.pointerId)
      if (touch.phase === "sliding") return onPointerUp?.(e)
      e.preventDefault()
      if (touch.phase === "ignored") return
      // Lifted without moving: a tap. Render between the press and the release,
      // so Radix sees the value change and reports it through onValueCommit.
      flushSync(() => replay("pointerdown", e))
      replay("pointerup", e)
    },
    onPointerCancel(e) {
      const touch = touches.current.get(e.pointerId)
      touches.current.delete(e.pointerId)
      // Radix never commits a slide that ends without a pointerup; keep what it reached.
      if (touch?.phase === "sliding" && slid.current) onValueCommit?.(slid.current)
      onPointerCancel?.(e)
    },
    onValueChange(values) {
      slid.current = values
      onValueChange?.(values)
    },
  } satisfies SliderProps
}

function Slider({ className, min = 0, max = 100, ...props }: SliderProps) {
  const { value, defaultValue } = props
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  )
  const touchHandlers = useScrollSafeTouch(props)

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      min={min}
      max={max}
      className={cn(
        "relative flex w-full items-center select-none data-disabled:opacity-50",
        // The page still scrolls across the slider; see useScrollSafeTouch.
        "data-horizontal:touch-pan-y data-vertical:touch-pan-x",
        // making the slider's hit area easier to hit on touchscreens:
        // "pointer-coarse:my--11 pointer-coarse:h-11 pointer-coarse:before:absolute pointer-coarse:before:-inset-y-10",

        // Touch target: 64px tall, extends past the slider without changing layout.
        "before:absolute before:inset-x-0 before:-inset-y-4",
        // DEBUG: use to check the hit area visually.
        // "before:bg-pink-500/40",

        className,
      )}
      {...props}
      {...touchHandlers}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"
      >
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            "block h-4 w-7 shrink-0 rounded-sm border-2 border-primary bg-white shadow-md",
            // Interaction states
            "ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden",
            "disabled:pointer-events-none disabled:opacity-50",
            // Touch devices
            "pointer-coarse:border-1.5 rounded-lg pointer-coarse:h-4 pointer-coarse:w-8",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
