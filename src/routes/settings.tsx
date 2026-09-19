import { createFileRoute, Link } from "@tanstack/react-router"
import { LayoutDashboard } from "lucide-react"
import { AiSettingsSection } from "@/features/ai/AiSettingsSection"
import { aiSettingsQuery } from "@/features/ai/queries"
import { retroAreasQuery } from "@/features/retro/queries"
import { GoalsSection } from "@/features/settings/GoalsSection"
import { HabitsSection } from "@/features/settings/HabitsSection"
import { MetricsSection } from "@/features/settings/MetricsSection"
import { RetroAreasSection } from "@/features/settings/RetroAreasSection"
import { goalRowsQuery, habitRowsQuery, metricRowsQuery } from "@/features/settings/queries"

export const Route = createFileRoute("/settings")({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(metricRowsQuery),
      queryClient.ensureQueryData(habitRowsQuery),
      queryClient.ensureQueryData(goalRowsQuery),
      queryClient.ensureQueryData(retroAreasQuery),
      queryClient.ensureQueryData(aiSettingsQuery),
    ]),
  component: Settings,
})

function Settings() {
  return (
    <>
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-muted-foreground hover:text-foreground"
        >
          <LayoutDashboard size={15} />
          VanyaOS
        </Link>
        <span className="text-xs text-muted-foreground">Settings</span>
      </div>

      <h1 className="mt-3 text-[15px] font-medium">Setup</h1>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Archive instead of delete — history keeps its data. Changes apply immediately everywhere.
      </p>

      <MetricsSection />
      <HabitsSection />
      <GoalsSection />
      <RetroAreasSection />
      <AiSettingsSection />
    </>
  )
}
