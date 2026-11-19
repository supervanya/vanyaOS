import { AXIS_MARGIN, classifySliderMove, TOUCH_SLOP } from "@/components/ui/slider"

/** Observe the same pointer stream as the slider, including its replayed press. */
export function recordSliderGestures(area: HTMLElement, save: (report: string) => void) {
  let finish: (() => void) | undefined

  function start(down: PointerEvent) {
    if (!down.isTrusted || !down.isPrimary) return
    finish?.()
    if (down.pointerType !== "touch" && down.pointerType !== "pen") return
    const target = down.target
    if (!(target instanceof Element) || !area.contains(target)) return

    const row = target.closest("fieldset")
    const slider = target.closest<HTMLElement>('[data-slot="slider"]')
    const startValue = row?.dataset.value ?? "—"
    const initialScroll = window.scrollY
    const startTime = performance.now()
    const lines: string[] = []
    const log = (event: string) =>
      lines.push(`${Math.round(performance.now() - startTime)}ms ${event}`)
    const offset = (n: number) => Number(n.toFixed(2))
    const controller = new AbortController()
    const options = { capture: true, passive: true, signal: controller.signal }
    let decision = ""
    let moves = 0
    let lastMove = ""
    let accepted = false
    let scrolled = false
    let end = ""
    let timer = 0

    log(
      `down on ${target.closest("[data-slot]")?.getAttribute("data-slot") ?? target.tagName}, scrollY=${offset(initialScroll)}, slider touch-action=${slider ? getComputedStyle(slider).touchAction : "outside"}`,
    )
    const track = slider?.querySelector('[data-slot="slider-track"]')?.getBoundingClientRect()
    if (track) {
      log(
        `start relative to track: x=${offset(down.clientX - track.left)}px from left, y=${offset(down.clientY - (track.top + track.height / 2))}px from center; track=${offset(track.width)}×${offset(track.height)}px`,
      )
    }
    const changes = new MutationObserver(() => {
      // The first rendered change distinguishes an actual update from capture alone.
      log(`first value change to ${row?.dataset.value}`)
      changes.disconnect()
    })
    if (row) changes.observe(row, { attributes: true, attributeFilter: ["data-value"] })

    finish = () => {
      controller.abort()
      changes.disconnect()
      window.clearTimeout(timer)
      finish = undefined
      let outcome = decision || "No direction observed"
      if (!slider) outcome = "Started outside slider"
      else if (accepted) outcome = decision ? "Slider engaged" : "Tap"
      const mode = window.matchMedia("(display-mode: standalone)").matches
        ? "standalone"
        : "browser"
      save(
        [
          `${row ? `Row ${row.dataset.row}` : "Between rows"} · ${outcome} · ${end || "interrupted"}${scrolled ? " · page scrolled" : ""}`,
          `${new Date().toISOString()} | ${mode} | ${navigator.userAgent}`,
          `pointer=${down.pointerType} threshold=${TOUCH_SLOP}px axisMargin=${AXIS_MARGIN}px value=${startValue} → ${row?.dataset.value ?? "—"}`,
          ...lines,
          `${moves} moves; last move ${lastMove || "—"}; final scroll delta=${offset(window.scrollY - initialScroll)}px`,
        ].join("\n"),
      )
    }
    const complete = finish
    // Observe after the slider's own scroll lock (the row is its ancestor), including
    // moves delivered before the pointer stream accepts the drag or after native
    // scrolling takes over.
    if (row) {
      let touchMoves = 0
      let afterCancel = 0
      let finger: number | undefined
      const passive = { passive: true, signal: controller.signal }
      function noteTouch(event: TouchEvent) {
        if (finger === undefined && event.changedTouches.length === 1 && event.target === target) {
          finger = event.changedTouches[0]?.identifier
        }
        const touch = Array.from(event.changedTouches).find((t) => t.identifier === finger)
        if (!touch) return
        if (
          event.type === "touchmove" &&
          (end === "pointercancel" ? ++afterCancel > 8 : ++touchMoves > 6)
        )
          return
        log(
          `${event.type} dx=${offset(touch.clientX - down.clientX)} dy=${offset(touch.clientY - down.clientY)} cancelable=${event.cancelable} defaultPrevented=${event.defaultPrevented}`,
        )
      }
      row.addEventListener("touchmove", noteTouch, passive)
      row.addEventListener("touchend", noteTouch, passive)
      row.addEventListener("touchcancel", noteTouch, passive)
    }
    window.addEventListener("pagehide", complete, options)
    window.addEventListener(
      "pointerdown",
      (event) => {
        // useScrollSafeTouch dispatches a synthetic press on drag acceptance or tap.
        if (event.isTrusted || event.pointerId !== down.pointerId || event.target !== target) return
        accepted = true
        log("Radix press replayed")
      },
      options,
    )
    window.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerId !== down.pointerId || end) return
        const dx = event.clientX - down.clientX
        const dy = event.clientY - down.clientY
        lastMove = `dx=${offset(dx)} dy=${offset(dy)}`
        if (++moves <= 16) log(lastMove)
        if (!slider || (decision && decision !== "Undecided")) return
        const phase = classifySliderMove(Math.abs(dx), Math.abs(dy))
        if (phase === "pending" || (phase === "undecided" && decision)) return
        decision = { undecided: "Undecided", sliding: "Horizontal", ignored: "Vertical" }[phase]
        log(`${decision} at ${lastMove}`)
      },
      options,
    )
    window.addEventListener(
      "scroll",
      () => {
        if (scrolled || window.scrollY === initialScroll) return
        scrolled = true
        log(`first page scroll delta=${offset(window.scrollY - initialScroll)}px`)
      },
      options,
    )
    function stop(event: PointerEvent) {
      if (!event.isTrusted || event.pointerId !== down.pointerId || end) return
      end = event.type
      log(end)
      // Native scrolling can start after pointercancel. End sooner on a new press.
      timer = window.setTimeout(complete, 500)
    }
    window.addEventListener("pointerup", stop, options)
    window.addEventListener("pointercancel", stop, options)
  }

  window.addEventListener("pointerdown", start, { capture: true, passive: true })
  return () => {
    window.removeEventListener("pointerdown", start, true)
    finish?.()
  }
}
