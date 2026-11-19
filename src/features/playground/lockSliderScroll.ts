/** React 19 callback ref for the experimental playground row. */
export function lockSliderScroll(row: HTMLFieldSetElement | null) {
  const slider = row?.querySelector<HTMLElement>('[data-slot="slider"]')
  if (!slider) return

  let sliding = false
  const listeners = new AbortController()
  const options = { signal: listeners.signal }
  // The existing slider replays pointerdown when it accepts the drag. Reuse
  // that decision so a later diagonal move cannot reclassify the gesture.
  slider.addEventListener(
    "pointerdown",
    (event) => {
      if (event.isPrimary && event.pointerType === "touch") {
        sliding = !event.isTrusted
      }
    },
    options,
  )
  function reset() {
    sliding = false
  }
  slider.addEventListener("touchend", reset, options)
  slider.addEventListener("touchcancel", reset, options)
  slider.addEventListener("pointercancel", reset, options)
  slider.addEventListener(
    "touchmove",
    (event) => {
      if (sliding && event.touches.length === 1 && event.cancelable) {
        event.preventDefault()
      }
    },
    { ...options, passive: false },
  )
  return () => listeners.abort()
}
