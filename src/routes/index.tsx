import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Moon,
  Activity,
  Flag,
  Repeat,
  Lightbulb,
  Target,
  Copy,
  Download,
  Plus,
  X,
} from 'lucide-react'
import {
  loadConfig,
  loadOrInitDay,
  loadDay,
  listDayDates,
  saveDay,
  todayISO,
  loadAllDays,
} from '../lib/storage'
import type { DayEntry } from '../lib/storage'
import { wellness, dayToMarkdown, exportAll } from '../lib/markdown'
import type { Config, Metric } from '../lib/config'

export const Route = createFileRoute('/')({ component: Reflection })

type Scope = 'tomorrow' | 'week'

function Reflection() {
  const [config, setConfig] = useState<Config | null>(null)
  const [entry, setEntry] = useState<DayEntry | null>(null)
  const [toast, setToast] = useState('')
  const [drafts, setDrafts] = useState<Record<Scope, string>>({ tomorrow: '', week: '' })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Load config + today's entry on the client (localStorage is browser-only).
  useEffect(() => {
    const c = loadConfig()
    setConfig(c)
    setEntry(loadOrInitDay(todayISO(), c))
  }, [])

  // Autosave on every change — localStorage is the only store this phase.
  useEffect(() => {
    if (entry) saveDay(entry)
  }, [entry])

  // Auto-grow the reflection textarea to fit its content (no drag handle).
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [entry?.reflection])

  const score = useMemo(
    () => (entry && config ? wellness(entry, config) : 0),
    [entry, config],
  )

  // Wellness of the most recent prior day, for the "vs last" delta.
  const prevScore = useMemo(() => {
    if (!config || !entry) return null
    const priors = listDayDates().filter((d) => d < entry.date)
    const p = priors.length ? loadDay(priors[priors.length - 1]) : null
    return p ? wellness(p, config) : null
  }, [config, entry?.date])

  const groups = useMemo(() => {
    if (!config) return []
    const order: string[] = []
    const byGroup: Record<string, Metric[]> = {}
    for (const m of config.metrics) {
      if (!byGroup[m.group]) {
        byGroup[m.group] = []
        order.push(m.group)
      }
      byGroup[m.group].push(m)
    }
    return order.map((g) => ({
      group: g,
      metrics: byGroup[g],
      inverted: byGroup[g].every((m) => !m.higherIsBetter),
    }))
  }, [config])

  if (!config || !entry) return null

  const flash = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1800)
  }

  const stamp = () => new Date().toISOString()
  const setMetric = (id: string, v: number) =>
    setEntry((e) => (e ? { ...e, metrics: { ...e.metrics, [id]: v }, updatedAt: stamp() } : e))
  const toggleHabit = (id: string) =>
    setEntry((e) => (e ? { ...e, habits: { ...e.habits, [id]: !e.habits[id] }, updatedAt: stamp() } : e))
  const setReflection = (text: string) =>
    setEntry((e) => (e ? { ...e, reflection: text, updatedAt: stamp() } : e))

  const addTodo = (scope: Scope) => {
    const text = drafts[scope].trim()
    if (!text) return
    setEntry((e) =>
      e ? { ...e, todos: { ...e.todos, [scope]: [...e.todos[scope], { text, done: false }] }, updatedAt: stamp() } : e,
    )
    setDrafts((d) => ({ ...d, [scope]: '' }))
  }
  const toggleTodo = (scope: Scope, i: number) =>
    setEntry((e) =>
      e
        ? {
            ...e,
            todos: { ...e.todos, [scope]: e.todos[scope].map((t, idx) => (idx === i ? { ...t, done: !t.done } : t)) },
            updatedAt: stamp(),
          }
        : e,
    )
  const delTodo = (scope: Scope, i: number) =>
    setEntry((e) =>
      e ? { ...e, todos: { ...e.todos, [scope]: e.todos[scope].filter((_, idx) => idx !== i) }, updatedAt: stamp() } : e,
    )

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        /* ignore */
      }
      ta.remove()
    }
    flash(msg)
  }

  function downloadMd(filename: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToday = () => copy(dayToMarkdown(entry, config), 'Today copied — paste into notes or an AI')
  const exportEverything = () => {
    downloadMd(`vanyaos-export-${todayISO()}.md`, exportAll(loadAllDays(), config))
    flash('Exported all entries (.md)')
  }

  const prettyDate = new Date(entry.date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  // Color-code wellness on the 0-5 scale.
  const scoreColor = score >= 3.75 ? 'text-emerald-400' : score >= 2.5 ? 'text-amber-400' : 'text-rose-400'
  const delta = prevScore == null ? null : score - prevScore

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 py-5">
      {/* Brand + date */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <span className="inline-block size-2 rounded-full bg-indigo-400" />
          VanyaOS
        </span>
        <span className="text-xs text-neutral-500">{prettyDate}</span>
      </div>

      <h1 className="mt-3 flex items-center gap-2 text-[15px] font-medium text-neutral-200">
        <Moon size={17} className="text-indigo-300" />
        Evening reflection
      </h1>

      {/* Wellness score + delta vs last entry */}
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={`text-4xl font-semibold tabular-nums ${scoreColor}`}>{score.toFixed(1)}</span>
        <span className="text-xs text-neutral-400">wellness</span>
        {delta != null && (
          <span
            className={`text-xs font-medium ${
              delta > 0.05 ? 'text-emerald-400' : delta < -0.05 ? 'text-rose-400' : 'text-neutral-500'
            }`}
          >
            {delta > 0.05 ? '▲' : delta < -0.05 ? '▼' : '—'} {delta > 0 ? '+' : ''}
            {delta.toFixed(1)} vs last
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-neutral-500">symptoms inverted · theme: {entry.theme}</p>

      {/* Metric groups */}
      {groups.map(({ group, metrics, inverted }) => (
        <section key={group} className="mt-4">
          <p className={`mb-2 flex items-center gap-1.5 text-xs ${inverted ? 'text-rose-300' : 'text-neutral-400'}`}>
            {inverted ? <Activity size={14} /> : group === 'Stimulation' ? <Lightbulb size={14} /> : <Target size={14} />}
            {group}
            {inverted ? ' · 0 is best' : ''}
          </p>
          {metrics.map((m) => {
            const val = entry.metrics[m.id] ?? 0
            const fill = (val / m.scale) * 100
            return (
              <div key={m.id} className="mb-3 flex items-center gap-3">
                <span className="w-24 shrink-0 text-[13px] text-neutral-300">{m.label}</span>
                <div className="flex-1">
                  <input
                    type="range"
                    min={0}
                    max={m.scale}
                    step={1}
                    value={val}
                    onChange={(ev) => setMetric(m.id, Number(ev.target.value))}
                    className="vslider"
                    style={{ '--accent': inverted ? '#fb7185' : '#818cf8', '--fill': `${fill}%` } as React.CSSProperties}
                  />
                  <div className="mt-0.5 flex justify-between px-0.5 text-[9px] tabular-nums text-neutral-600">
                    {Array.from({ length: m.scale + 1 }, (_, i) => (
                      <span key={i}>{i}</span>
                    ))}
                  </div>
                </div>
                <span className="w-4 text-right text-[15px] font-semibold tabular-nums">{val}</span>
              </div>
            )
          })}
        </section>
      ))}

      {/* Goals */}
      <section className="mt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs text-neutral-400">
          <Flag size={14} /> Goal check · what you're building toward
        </p>
        {config.goals.map((g) => (
          <div key={g.id} className="mb-2 flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-neutral-300">{g.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.round(g.progress * 100)}%` }} />
            </div>
            <span className="w-12 text-right text-[11px] text-neutral-500">{g.note ?? `${Math.round(g.progress * 100)}%`}</span>
          </div>
        ))}
      </section>

      {/* Habits */}
      <section className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-xs text-neutral-400">
          <Repeat size={14} /> Habits
        </p>
        <div className="flex flex-wrap gap-2">
          {config.habits.map((h) => {
            const on = !!entry.habits[h.id]
            return (
              <button
                key={h.id}
                onClick={() => toggleHabit(h.id)}
                className={`rounded-full border px-3.5 py-2 text-[13px] transition-colors ${
                  on
                    ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                    : 'border-neutral-700 text-neutral-400'
                }`}
              >
                {h.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Todos */}
      <section className="mt-5 grid grid-cols-1 gap-4">
        {(['tomorrow', 'week'] as Scope[]).map((scope) => (
          <div key={scope}>
            <p className="mb-2 text-xs text-neutral-400">{scope === 'tomorrow' ? 'Must do tomorrow' : 'This week'}</p>
            <div className="flex flex-col gap-2">
              {entry.todos[scope].map((t, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleTodo(scope, i)}
                    className="size-5 accent-emerald-400"
                  />
                  <span className={`flex-1 text-[13px] ${t.done ? 'text-neutral-600 line-through' : 'text-neutral-200'}`}>
                    {t.text}
                  </span>
                  <button onClick={() => delTodo(scope, i)} className="p-1 text-neutral-600 hover:text-neutral-300">
                    <X size={15} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  value={drafts[scope]}
                  onChange={(ev) => setDrafts((d) => ({ ...d, [scope]: ev.target.value }))}
                  onKeyDown={(ev) => ev.key === 'Enter' && addTodo(scope)}
                  placeholder="Add a todo…"
                  className="flex-1 rounded-md border border-neutral-800 bg-neutral-900/60 px-2.5 py-2 text-base outline-none focus:border-neutral-600"
                />
                <button
                  onClick={() => addTodo(scope)}
                  className="rounded-md border border-neutral-800 p-2 text-neutral-400 hover:text-neutral-200"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Reflection */}
      <section className="mt-5">
        <textarea
          ref={taRef}
          rows={3}
          value={entry.reflection}
          onChange={(ev) => setReflection(ev.target.value)}
          placeholder="Verbal reflection: how was today? (copied out with your metrics)"
          className="w-full resize-none overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 text-base outline-none focus:border-neutral-600"
        />
      </section>

      {/* Actions */}
      <section className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={copyToday}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-3 text-[13px] font-medium text-white hover:bg-indigo-400"
        >
          <Copy size={15} /> Copy today
        </button>
        <button
          onClick={exportEverything}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-3 text-[13px] text-neutral-200 hover:bg-neutral-900"
        >
          <Download size={15} /> Export all
        </button>
      </section>

      <p className="mt-3 text-center text-[11px] text-neutral-600">Saved locally · theme: {entry.theme}</p>

      {/* Toast */}
      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="rounded-full bg-neutral-100 px-4 py-2 text-[13px] font-medium text-neutral-900 shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
