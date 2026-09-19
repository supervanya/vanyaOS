import { Link, type LinkProps } from "@tanstack/react-router"
import { ArrowLeft, LayoutDashboard } from "lucide-react"
import type { ReactNode } from "react"

/**
 * The top row of every screen except the dashboard: the way back on the left
 * (the dashboard unless `back` says otherwise), and on the right either the
 * screen's `label` or its own controls as `children`.
 */
export function PageHeader({
  back,
  label,
  children,
}: {
  back?: { to: NonNullable<LinkProps["to"]>; label: string }
  label?: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <Link
        to={back?.to ?? "/"}
        className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-muted-foreground hover:text-foreground"
      >
        {back ? <ArrowLeft size={15} /> : <LayoutDashboard size={15} />}
        {back?.label ?? "VanyaOS"}
      </Link>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      {children}
    </div>
  )
}
