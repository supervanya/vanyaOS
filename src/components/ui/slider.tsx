import * as React from "react"
import { flushSync } from "react-dom"
import { useComposedRefs } from "@radix-ui/react-compose-refs"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root>

/**
 * How far a finger travels, in px, before a touch picks a direction. Kept small
 * so the slider claims a drag before iOS starts its own pan (about 10pt), which
 * leaves time for the scroll lock below to take effect.
 */
const TOUCH_SLOP = 2

/** A move this close to diagonal, in px, picks no direction yet and waits for the next one. */
const AXIS_MARGIN = 1

function classifySliderMove(along: number, across: number) {
  if (Math.max(along, across) < TOUCH_SLOP) return "pending"
  if (Math.abs(along - across) < AXIS_MARGIN) return "undecided"
  return along > across ? "sliding" : "ignored"
}

type Touch = { x: number; y: number; phase: ReturnType<typeof classifySliderMove> }

const isTouch = (e: React.PointerEvent) => e.pointerType === "touch" || e.pointerType === "pen"

/**
 * Lets a finger scroll the page across the slider without moving it, and keeps
 * the page still while the finger slides it.
 *
 * Radix sets the value the moment a pointer lands on the track, before anyone
 * can know whether the finger is about to scroll. For touch, this holds the
 * press back and hands it to Radix (and to the caller's own pointer handlers)
 * only once the gesture's direction is clear. Each touch is in one phase:
 *
 * - `pending`: moved less than `TOUCH_SLOP`. Lifting now is a tap, which sets the value.
 * - `undecided`: moved about as far along as across. Waits for the next move.
 * - `sliding`: moved along the slider. Radix gets the press, and the scroll lock
 *   cancels every `touchmove`, so a finger drifting off-axis can't scroll the page.
 * - `ignored`: moved across the slider. Left to the browser, which scrolls the
 *   page (`touch-action: pan-y` on the root) and ends the touch with `pointercancel`.
 *
 * Mouse input is untouched.
 *
 * @see https://github.com/DavidHDev/react-bits/blob/main/src/hooks/useScrubGesture.js
 */
function useScrollSafeTouch({
  ref,
  disabled,
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

  // `touch-action` is fixed when the finger lands, and iOS doesn't hold a pan-y
  // gesture to its first direction (WebKit bug 232545). Only a cancelled
  // touchmove reliably stops the page. React listens to touchmove passively, so
  // this has to be a native listener. One finger only, so pinch-zoom still works.
  const lockScroll = React.useCallback(
    (root: HTMLElement | null) => {
      if (!root) return
      if (disabled) {
        // An in-flight gesture stays ignored even if the slider is re-enabled before lift.
        for (const touch of touches.current.values()) touch.phase = "ignored"
        return
      }
      const lock = (e: TouchEvent) => {
        const sliding = [...touches.current.values()].some((t) => t.phase === "sliding")
        if (sliding && e.touches.length === 1 && e.cancelable) e.preventDefault()
      }
      root.addEventListener("touchmove", lock, { passive: false })
      return () => root.removeEventListener("touchmove", lock)
    },
    [disabled],
  )
  const rootRef = useComposedRefs(ref, lockScroll)

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
    ref: rootRef,
    onPointerDown(e) {
      if (replaying.current || !isTouch(e)) return onPointerDown?.(e)
      touches.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        phase: disabled ? "ignored" : "pending",
      })
      // Keep the rest of the touch coming here, as Radix's own press would have.
      if (!disabled && e.target instanceof Element) e.target.setPointerCapture(e.pointerId)
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
      const phase = classifySliderMove(along, across)
      if (phase === "pending") return
      touch.phase = phase
      if (phase !== "sliding") return
      slid.current = null
      replay("pointerdown", e)
    },
    onPointerUp(e) {
      const touch = touches.current.get(e.pointerId)
      if (replaying.current || !touch) return onPointerUp?.(e)
      touches.current.delete(e.pointerId)
      if (touch.phase === "sliding") return onPointerUp?.(e)
      e.preventDefault()
      if (touch.phase !== "pending") return
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
  const thumbCount = value?.length ?? defaultValue?.length ?? 2
  const touchHandlers = useScrollSafeTouch(props)

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      min={min}
      max={max}
      className={cn(
        "relative flex w-full items-center select-none data-disabled:opacity-50",
        // Let a swipe across the slider scroll the page. Radix sets only
        // data-orientation, so the shorter `data-horizontal:` variant never matches.
        !props.disabled &&
          "data-[orientation=horizontal]:touch-pan-y data-[orientation=vertical]:touch-pan-x",
        // Touch target: 64px tall (the 16px thumb plus 24px above and below),
        // without moving nearby rows.
        "before:absolute before:inset-x-0 before:-inset-y-6",
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
      {Array.from({ length: thumbCount }, (_, index) => (
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

// TOUCH_SLOP, AXIS_MARGIN and classifySliderMove are exported for the playground's gesture trace.
export { Slider, TOUCH_SLOP, AXIS_MARGIN, classifySliderMove }
