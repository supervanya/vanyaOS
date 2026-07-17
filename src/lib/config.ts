// Tracked metrics, habits, goals and the active life-theme.
// Seeded from the prototype (see docs/REQUIREMENTS.md). Treated as a "config
// file" for now — edit these defaults directly; an in-app settings UI is deferred.

export type Metric = {
  id: string
  label: string
  group: string
  higherIsBetter: boolean // symptoms are false -> inverted in the wellness score
  scale: number // max value; sliders run 0..scale (we use 0-5)
}

export type Habit = { id: string; label: string }

export type Goal = { id: string; label: string; progress: number; note?: string }

export type Config = {
  activeTheme: string
  themes: string[]
  metrics: Metric[]
  habits: Habit[]
  goals: Goal[]
}

export const DEFAULT_CONFIG: Config = {
  activeTheme: 'recovery',
  themes: ['recovery', 'deep-work'],
  metrics: [
    { id: 'eating_health', label: 'Eating healthy', group: 'Discipline', higherIsBetter: true, scale: 5 },
    { id: 'movement_health', label: 'Movement', group: 'Discipline', higherIsBetter: true, scale: 5 },
    { id: 'iq_stimulation', label: 'IQ stimulation', group: 'Stimulation', higherIsBetter: true, scale: 5 },
    { id: 'reading', label: 'Reading', group: 'Stimulation', higherIsBetter: true, scale: 5 },
    { id: 'brain_fog', label: 'Brain fog', group: 'Symptoms', higherIsBetter: false, scale: 5 },
    { id: 'lower_back_pain', label: 'Lower back pain', group: 'Symptoms', higherIsBetter: false, scale: 5 },
    // Appended last: sort_order is the array index, and existing accounts keep
    // their persisted sort_order — inserting mid-list would collide with it.
    { id: 'sleep_quality', label: 'Sleep quality', group: 'Recovery', higherIsBetter: true, scale: 5 },
  ],
  habits: [
    { id: 'strength', label: 'Strength' },
    { id: 'breathwork', label: 'Breathwork' },
    { id: 'steps_7k', label: '7k steps' },
    { id: 'no_dessert', label: 'No dessert' },
    { id: 'book_night', label: 'Book at night' },
  ],
  goals: [
    { id: 'vo2', label: 'VO2 max → 48', progress: 0.62, note: '62%' },
    { id: 'yoga', label: 'Yoga month', progress: 0.4, note: 'day 12' },
    { id: 'no_brain_fog', label: 'No brain fog', progress: 0.7, note: 'trend ↑' },
  ],
}
