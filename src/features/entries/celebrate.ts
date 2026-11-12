import confetti from "canvas-confetti"

// The dawn scene's own colours, so the confetti belongs to it.
const COLORS = ["#FFE08F", "#FBC692", "#F0A8BC", "#8C9AE6", "#7FA6C8", "#1E7A49", "#FFFFFF"]

/**
 * A big throw of confetti from the middle of `from`, fanned across the whole
 * page: three volleys up and outward, then a slow wide shower. Does nothing
 * for someone who has asked for reduced motion.
 */
export function celebrate(from: Element): void {
  const box = from.getBoundingClientRect()
  const origin = {
    x: (box.left + box.width / 2) / window.innerWidth,
    y: (box.top + box.height / 2) / window.innerHeight,
  }
  const shared = { origin, colors: COLORS, disableForReducedMotion: true }

  // Fast, narrow volleys that reach the top of the page, to either side and
  // straight up.
  for (const angle of [60, 90, 120]) {
    void confetti({
      ...shared,
      angle,
      particleCount: 90,
      spread: 55,
      startVelocity: 70,
      ticks: 260,
      scalar: 1.1,
    })
  }
  // Then a slower, wider one that hangs and drifts down over everything.
  setTimeout(() => {
    void confetti({
      ...shared,
      angle: 90,
      particleCount: 160,
      spread: 170,
      startVelocity: 42,
      gravity: 0.7,
      ticks: 340,
      scalar: 0.9,
    })
  }, 180)
}
