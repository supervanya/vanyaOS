import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "motion/react";
import { Check, ArrowLeft } from "lucide-react";
import confetti from "canvas-confetti";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/playground")({ component: Playground });

// ---- shared bits -----------------------------------------------------------

function buzz() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.(7);
  }
}

const pillCls = (on: boolean) =>
  cn(
    "relative inline-flex h-12 w-44 items-center justify-center rounded-full border text-sm font-medium transition-colors select-none",
    on
      ? "border-success/50 bg-success/15 text-success"
      : "text-muted-foreground border-border",
  );

// invisible native switch overlay -> iOS Taptic Engine on real taps
function HapticInput({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <input
      type="checkbox"
      {...{ switch: "" }}
      checked={checked}
      onChange={() => {
        buzz();
        onToggle();
      }}
      className="absolute inset-0 m-0 size-full cursor-pointer opacity-0 [clip-path:inset(0)]"
    />
  );
}

// ---- A. Confetti -----------------------------------------------------------

function ConfettiVariant() {
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const toggle = () => {
    const willOn = !on;
    setOn(willOn);
    if (willOn && ref.current) {
      const r = ref.current.getBoundingClientRect();
      confetti({
        particleCount: 70,
        spread: 75,
        startVelocity: 30,
        ticks: 120,
        scalar: 0.8,
        origin: {
          x: (r.left + r.width / 2) / window.innerWidth,
          y: (r.top + r.height / 2) / window.innerHeight,
        },
      });
    }
  };
  return (
    <span ref={ref} className={pillCls(on)}>
      <span>Habit</span>
      <HapticInput checked={on} onToggle={toggle} />
    </span>
  );
}

// ---- B. Particle burst -----------------------------------------------------

function ParticleVariant() {
  const [on, setOn] = useState(false);
  const [burst, setBurst] = useState(0);
  const toggle = () => {
    const willOn = !on;
    setOn(willOn);
    if (willOn) setBurst((b) => b + 1);
  };
  const colors = ["#34d399", "#fbbf24", "#60a5fa", "#f472b6"];
  return (
    <span className={pillCls(on)}>
      <span>Habit</span>
      {burst > 0 && (
        <span
          key={burst}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const dist = 34 + (i % 3) * 9;
            return (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist,
                  opacity: 0,
                  scale: 0.4,
                }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute size-1.5 rounded-full"
                style={{ background: colors[i % colors.length] }}
              />
            );
          })}
        </span>
      )}
      <HapticInput checked={on} onToggle={toggle} />
    </span>
  );
}

// ---- C. Radial fill + center check ----------------------------------------

function FillVariant() {
  const [on, setOn] = useState(false);
  return (
    <span
      className={cn(
        "relative inline-flex h-12 w-44 items-center justify-center overflow-hidden rounded-full border text-sm font-medium select-none",
        on ? "border-success" : "border-border text-muted-foreground",
      )}
    >
      <motion.span
        className="bg-success absolute inset-0 rounded-full"
        initial={false}
        animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      />
      <motion.span animate={{ opacity: on ? 0 : 1 }} className="relative">
        Habit
      </motion.span>
      <AnimatePresence>
        {on && (
          <motion.span
            key="c"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 24,
              delay: 0.05,
            }}
            className="absolute flex items-center gap-1 font-semibold text-white"
          >
            <Check size={16} /> Done
          </motion.span>
        )}
      </AnimatePresence>
      <HapticInput checked={on} onToggle={() => setOn((v) => !v)} />
    </span>
  );
}

// ---- D. Glow ring pulse + pop ---------------------------------------------

function RingVariant() {
  const [on, setOn] = useState(false);
  const [pulse, setPulse] = useState(0);
  const controls = useAnimationControls();
  const toggle = () => {
    const willOn = !on;
    setOn(willOn);
    if (willOn) {
      setPulse((p) => p + 1);
      controls.start({ scale: [1, 1.12, 1], transition: { duration: 0.3 } });
    }
  };
  return (
    <motion.span animate={controls} className={pillCls(on)}>
      <span>Habit</span>
      {pulse > 0 && (
        <motion.span
          key={pulse}
          className="border-success pointer-events-none absolute inset-0 rounded-full border-2"
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      )}
      <HapticInput checked={on} onToggle={toggle} />
    </motion.span>
  );
}

// ---- E. Corner stamp -------------------------------------------------------

function StampVariant() {
  const [on, setOn] = useState(false);
  return (
    <span className={pillCls(on)}>
      <span>Habit</span>
      <AnimatePresence>
        {on && (
          <motion.span
            key="s"
            initial={{ scale: 2.2, opacity: 0, rotate: -18 }}
            animate={{ scale: 1, opacity: 1, rotate: -10 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 18 }}
            className="border-success text-success absolute -top-2 right-2 rounded-md border-2 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase"
          >
            Done
          </motion.span>
        )}
      </AnimatePresence>
      <HapticInput checked={on} onToggle={() => setOn((v) => !v)} />
    </span>
  );
}

// ---- F. Emoji pop ----------------------------------------------------------

function EmojiVariant() {
  const [on, setOn] = useState(false);
  const [burst, setBurst] = useState(0);
  const toggle = () => {
    const willOn = !on;
    setOn(willOn);
    if (willOn) setBurst((b) => b + 1);
  };
  const emojis = ["🎉", "✨", "⭐️", "💪", "🔥"];
  return (
    <span className={pillCls(on)}>
      <span>Habit</span>
      {burst > 0 && (
        <span
          key={burst}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          {Array.from({ length: 6 }).map((_, i) => {
            const angle = -Math.PI / 2 + ((i - 2.5) / 6) * Math.PI * 1.2;
            const dist = 42;
            return (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist - 10,
                  opacity: 0,
                  scale: 1.1,
                }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="absolute text-sm"
              >
                {emojis[i % emojis.length]}
              </motion.span>
            );
          })}
        </span>
      )}
      <HapticInput checked={on} onToggle={toggle} />
    </span>
  );
}

// ---- page ------------------------------------------------------------------

const VARIANTS: { name: string; desc: string; el: React.ReactNode }[] = [
  {
    name: "A · Confetti",
    desc: "Real confetti bursts from the button center.",
    el: <ConfettiVariant />,
  },
  {
    name: "B · Particle burst",
    desc: "A ring of colored dots flings outward and fades.",
    el: <ParticleVariant />,
  },
  {
    name: "C · Radial fill",
    desc: "Green fill springs out from the center to a ✓ Done.",
    el: <FillVariant />,
  },
  {
    name: "D · Glow ring",
    desc: "A quick pop plus an expanding ring pulse.",
    el: <RingVariant />,
  },
  {
    name: "E · Corner stamp",
    desc: "A 'DONE' stamp slams in with an overshoot.",
    el: <StampVariant />,
  },
  {
    name: "F · Emoji pop",
    desc: "A little spray of 🎉✨⭐️ shoots upward.",
    el: <EmojiVariant />,
  },
];

function Playground() {
  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 py-6">
      <Link
        to="/"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-xs"
      >
        <ArrowLeft size={14} /> Back to reflection
      </Link>
      <h1 className="text-lg font-semibold">Habit animation playground</h1>
      <p className="text-muted-foreground mt-1 text-xs">
        Tap each habit to feel its completion animation (tap again to reset).
        None of them shift layout. The reflection screen currently uses{" "}
        <strong>A · Confetti</strong>.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        {VARIANTS.map((v) => (
          <div key={v.name} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{v.name}</span>
              <span className="text-muted-foreground text-right text-[11px]">
                {v.desc}
              </span>
            </div>
            <div className="flex justify-center py-2">{v.el}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
