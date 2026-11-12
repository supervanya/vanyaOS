import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { configQuery } from "@/features/config/queries"
import { MorningDay, MorningSkeleton } from "@/features/entries/MorningDay"
import { morningQuery } from "@/features/entries/queries"
import { tasksQuery } from "@/features/tasks/queries"
import { trendSeriesQuery } from "@/features/trends/queries"
import { todayISO } from "@/lib/dates"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const Route = createFileRoute("/morning")({
  // As on /reflect, the day lives in the URL (?date=YYYY-MM-DD), so a missed
  // morning can be filled in later. No date = today: a morning is always
  // about the day it starts.
  validateSearch: (search: Record<string, unknown>): { date?: string } =>
    typeof search.date === "string" && ISO_DATE.test(search.date) ? { date: search.date } : {},
  loaderDeps: ({ search }) => ({ date: search.date ?? todayISO() }),
  loader: async ({ context: { queryClient }, deps: { date } }) => {
    void queryClient.prefetchQuery(trendSeriesQuery) // the date picker's heatmap
    await Promise.all([
      queryClient.ensureQueryData(configQuery),
      queryClient.ensureQueryData(morningQuery(date)),
      queryClient.ensureQueryData(tasksQuery),
    ])
  },
  pendingComponent: MorningSkeleton,
  component: Morning,
})

function Morning() {
  const selectedDate = Route.useSearch().date ?? todayISO()
  const navigate = Route.useNavigate()
  const { data: config } = useSuspenseQuery(configQuery)
  const { data: morning } = useSuspenseQuery(morningQuery(selectedDate))
  const goTo = (date: string) => void navigate({ search: date === todayISO() ? {} : { date } })
  // Keyed by date: each day gets a fresh editor seeded from its loaded morning.
  return (
    <MorningDay
      key={selectedDate}
      config={config}
      loaded={morning}
      selectedDate={selectedDate}
      goTo={goTo}
    />
  )
}
