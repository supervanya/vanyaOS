import { useId, type CSSProperties, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { IntentionLived } from "./api"

export type Scene = IntentionLived | "none"

// The scene is one drawing, 342 x 220 units, scaled as a whole with the page
// width. Its bottom 48 units sit behind the caption banner, so everything
// meant to be seen ends above y = 172. Its colours are fixed and don't follow
// the theme: a night sky has to stay dark in light mode too.
const WIDTH = 342
const HEIGHT = 220

const SKY = {
  none: "bg-zinc-200 dark:bg-zinc-800",
  no: "bg-[#1B1F4B]",
  partly: "bg-[#F58E6C]",
  yes: "bg-[#A99EDD]",
} satisfies Record<Scene, string>

// Each text colour passes contrast on the banner it sits on.
const BANNER = {
  none: "bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  no: "bg-[#0E1030] text-white",
  partly: "bg-[#B8432A] text-white",
  yes: "bg-linear-to-b from-[#1F8052] to-[#196B40] text-white",
} satisfies Record<Scene, string>

// The sun's centre: out of sight, a sliver, half up, or risen behind the ridge.
const SUN_Y = { none: 166, no: 206, partly: 172, yes: 96 } satisfies Record<Scene, number>
const SUN_FILL = {
  none: "#A1A1AA",
  no: "#8B8FD9",
  partly: "#FFD166",
  yes: "#FFE08F",
} satisfies Record<Scene, string>

const PINE = "M0-100-22-55-10-55-30-25-12-25-36 0 36 0 12-25 30-25 10-55 22-55Z"
// [x, scale]: a tall stand in the left corner stepping down toward the middle,
// and a row on the right growing toward the edge.
const PINES_LEFT = [
  [40, 0.68],
  [13, 0.46],
  [66, 0.48],
  [86, 0.36],
  [102, 0.26],
  [115, 0.18],
] as const
const PINES_RIGHT = [
  [250, 0.14],
  [262, 0.18],
  [275, 0.23],
  [289, 0.29],
  [304, 0.36],
  [320, 0.44],
  [337, 0.52],
] as const

const move = "transition-[translate,opacity] ease-out motion-reduce:transition-none"

/**
 * The picture behind "did you live your morning intention?". No answer and
 * "no" and "partly" stay plain: a flat sky and the sun at its height, with
 * stars on a no and a dusk ridge on a partly. A yes turns the sky to dawn and
 * builds a landscape from back to front: snowy peaks, misty hills, then pines.
 */
export function LivedScene({ scene, caption }: { scene: Scene; caption: string }) {
  const yes = scene === "yes"
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative aspect-[342/220] overflow-hidden rounded-3xl transition-colors duration-500",
        SKY[scene],
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-linear-to-b from-[#8C9AE6] via-[#F0A8BC] via-58% to-[#FBC692] to-80% transition-opacity duration-700",
          yes ? "opacity-100" : "opacity-0",
        )}
      />
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="absolute inset-0 size-full">
        <g
          fill="white"
          className={cn(
            "transition-opacity duration-500",
            scene === "no" ? "opacity-100" : "opacity-0",
          )}
        >
          <circle cx="40" cy="30" r="2" />
          <circle cx="96" cy="66" r="1.5" />
          <circle cx="150" cy="24" r="2.5" />
          <circle cx="214" cy="52" r="1.5" />
          <circle cx="268" cy="28" r="2" />
          <circle cx="306" cy="80" r="1.5" />
          <circle cx="62" cy="104" r="1.5" />
          <circle cx="182" cy="96" r="1.5" />
        </g>

        <Sun scene={scene} />

        <Cloud x={26} y={24} scale={1} from={-70} show={yes} tones={CLOUD_PINK} />
        <Cloud x={266} y={20} scale={0.86} from={70} show={yes} tones={CLOUD_PEACH} delay={-3} />

        {/* Partly: a plain dusk ridge, halfway up. It reaches below the
            banner's top, so its bounce never lifts its foot into view. */}
        <g
          className="transition-[translate] duration-700 ease-[cubic-bezier(.3,1.4,.5,1)] motion-reduce:transition-none"
          style={{ translate: scene === "partly" ? "0 44px" : "0 100px" }}
        >
          <g transform="translate(0 92) scale(1.06875 1.25)">
            <path
              fill="#D9573A"
              d="M0 64 50 14 95 50 120 36 150 64V76H0ZM170 64 205 40 235 54 275 10 320 56V76H170Z"
            />
            <path fill="#B8432A" d="M0 64 28 38 70 64V76H0ZM236 64 300 30 320 48V76H236Z" />
          </g>
        </g>

        {/* Yes: the landscape, back to front. Each cap's outer edges run along
            its peak's own slopes. */}
        <Layer show={yes} order={0} lift={36}>
          <path
            fill="#7482C8"
            d="M-10 175 20 140 62 92 100 132 140 122 175 160 205 138 228 118 250 136 282 78 325 130 352 150V270H-10Z"
          />
          <path
            fill="#5F6FB8"
            d="M62 92 100 132 140 122 175 160V270H62ZM282 78 325 130 352 150V270H282Z"
          />
          <path
            fill="white"
            d="M62 92 44.5 112 52 108 58 115 64 107 71 114 76 109 81 112ZM282 78 268.8 102 275 98 280 106 286 97 292 105 297 100 301.8 102ZM228 118 218.8 126 224 124.5 228 129 232 124.5 237.8 126Z"
          />
          <path
            fill="#D3DCF7"
            d="M62 92 64 107 71 114 76 109 81 112ZM282 78 286 97 292 105 297 100 301.8 102ZM228 118 228 129 232 124.5 237.8 126Z"
          />
        </Layer>
        <Layer show={yes} order={1} lift={44}>
          <path
            fill="#8E8ECF"
            d="M-10 190 40 152 80 170 120 144 170 174 215 152 260 172 300 154 352 178V270H-10Z"
          />
          <path
            fill="white"
            d="M120 144 111.4 149.6 116 149 120 153 124.5 148.5 129.3 149.6ZM215 152 208 155.4 212 155.5 215.5 159 219 155 223 155.6Z"
          />
        </Layer>
        <Layer show={yes} order={2} lift={52}>
          <path
            fill="#A9BCDD"
            d="M-10 186C40 162 90 166 130 180S220 200 260 178 330 166 352 172V270H-10Z"
          />
          <path
            fill="white"
            fillOpacity="0.4"
            d="M-10 196C60 186 120 200 180 194S300 186 352 196V212C290 204 200 214 150 208S50 202-10 210Z"
          />
        </Layer>
        <Layer show={yes} order={3} lift={62}>
          <path fill="#7FA6C8" d="M-10 206C50 186 110 190 160 204S260 214 352 190V270H-10Z" />
          <path
            fill="white"
            fillOpacity="0.3"
            d="M40 214C100 206 170 220 240 212S320 204 352 208V222C300 216 230 226 170 222S90 216 40 224Z"
          />
        </Layer>
        <Layer show={yes} order={4} lift={0}>
          <path fill="#4F88A8" d="M120 240C180 150 270 146 352 152V240Z" />
          <path fill="#3D7B8C" d="M-10 156C40 148 100 158 150 240H-10Z" />
          <path
            fill="white"
            fillOpacity="0.22"
            d="M150 166C210 158 280 164 352 160V170C290 172 220 168 160 176Z"
          />
        </Layer>
        <Layer show={yes} order={5} lift={0}>
          <g fill="#1F5A5E">
            {PINES_LEFT.map(([x, scale]) => (
              <path key={x} d={PINE} transform={`translate(${x} 180) scale(${scale})`} />
            ))}
            {PINES_RIGHT.map(([x, scale]) => (
              <path key={x} d={PINE} transform={`translate(${x} 178) scale(${scale})`} />
            ))}
          </g>
        </Layer>
      </svg>
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex h-[21.8%] items-center justify-center rounded-3xl text-[15px] font-semibold transition-colors duration-500",
          BANNER[scene],
        )}
      >
        {caption}
      </div>
    </div>
  )
}

// One layer of the yes landscape. It waits below the frame and rises with a
// small bounce, later the nearer it is; it leaves at once. `lift` places the
// drawing inside the layer, so the rise itself stays a plain slide.
function Layer({
  show,
  order,
  lift,
  children,
}: {
  show: boolean
  order: number
  lift: number
  children: ReactNode
}) {
  const style: CSSProperties = show
    ? { translate: "0 0", transitionDelay: `${50 + order * 80}ms` }
    : { translate: "0 190px" }
  return (
    <g
      className={cn(
        "transition-[translate] motion-reduce:transition-none",
        show ? "duration-800 ease-[cubic-bezier(.3,1.35,.5,1)]" : "duration-500 ease-in",
      )}
      style={style}
    >
      <g transform={`translate(0 ${-lift})`}>{children}</g>
    </g>
  )
}

function Sun({ scene }: { scene: Scene }) {
  const yes = scene === "yes"
  const glow = useId()
  return (
    <g
      className="transition-[translate] duration-800 ease-[cubic-bezier(.3,1.4,.5,1)] motion-reduce:transition-none"
      style={{ translate: `0 ${SUN_Y[scene]}px` }}
    >
      <defs>
        <linearGradient id={glow} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF2A6" />
          <stop offset="1" stopColor="#FFCF7A" />
        </linearGradient>
      </defs>
      {/* Three soft rings, only once it has risen. */}
      <g
        className={cn(
          "transition-opacity duration-700 motion-reduce:transition-none",
          yes ? "opacity-100 delay-200" : "opacity-0",
        )}
      >
        <circle cx="171" r="116" fill="#FFBAA0" fillOpacity="0.16" />
        <circle cx="171" r="90" fill="#FFC496" fillOpacity="0.22" />
        <circle cx="171" r="66" fill="#FFD696" fillOpacity="0.32" />
      </g>
      <circle
        cx="171"
        r="46"
        fill={yes ? `url(#${glow})` : SUN_FILL[scene]}
        className="transition-[fill] duration-500"
      />
    </g>
  )
}

const CLOUD_PINK = ["#F3B6CB", "#F6BFC9", "#F9CDBF", "#F9C9C2"] as const
const CLOUD_PEACH = ["#F6BFC9", "#FBD0BE", "#FCD8B8", "#FBD3BC"] as const

// Three puffs over a rounded base, so every edge is round. Slides in from
// `from` units to the side on a yes, then sways.
function Cloud({
  x,
  y,
  scale,
  from,
  show,
  tones,
  delay = 0,
}: {
  x: number
  y: number
  scale: number
  from: number
  show: boolean
  tones: readonly [string, string, string, string]
  delay?: number
}) {
  return (
    <g
      className={cn(move, "duration-800", show ? "opacity-100 delay-250" : "opacity-0")}
      style={{ translate: show ? "0 0" : `${from}px 0` }}
    >
      <g className="lived-drift motion-reduce:animate-none" style={{ animationDelay: `${delay}s` }}>
        <g transform={`translate(${x} ${y}) scale(${scale})`}>
          <circle cx="20" cy="20" r="9" fill={tones[0]} />
          <circle cx="36" cy="14" r="13" fill={tones[1]} />
          <circle cx="52" cy="20" r="9" fill={tones[2]} />
          <rect x="6" y="20" width="60" height="9" rx="4.5" fill={tones[3]} />
        </g>
      </g>
    </g>
  )
}
