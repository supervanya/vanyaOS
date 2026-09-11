import { useCallback, useLayoutEffect, useRef } from "react"

// Size a textarea to fit its content. The `rows` attribute stays the minimum
// (height:auto falls back to it); cap growth with a CSS max-height plus
// overflow-y-auto where the box must not take over the screen.
function fit(el: HTMLTextAreaElement) {
  // Collapsing to auto can briefly shorten the page and clamp the scroll
  // position — restore it so a tall editor doesn't jump while typing.
  const scrollY = window.scrollY
  el.style.height = "auto"
  // scrollHeight excludes borders; border-box height needs them back or the
  // last line sits 1–2px short and a scrollbar appears.
  const border = el.offsetHeight - el.clientHeight
  el.style.height = `${el.scrollHeight + border}px`
  if (window.scrollY !== scrollY) window.scrollTo({ top: scrollY })
}

// Returns a callback ref: it fits on mount (covers textareas that appear with
// a value already in them) and again whenever `value` changes.
export function useAutoGrow(value: string) {
  const node = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    if (node.current) fit(node.current)
  }, [value])

  return useCallback((el: HTMLTextAreaElement | null) => {
    node.current = el
    if (el) fit(el)
  }, [])
}
