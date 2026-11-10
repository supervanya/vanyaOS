import { Link, type LinkProps } from "@tanstack/react-router"
import { ArrowLeft, LayoutDashboard } from "lucide-react"
import type { ReactNode } from "react"

import { TopBar } from "./TopBar"

/**
 * The sticky top bar of every screen except the dashboard: the way back on the
 * left (the dashboard unless `back` says otherwise), then either the screen's
 * `label` or its own controls as `children`, then the cloud-save indicator.
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
    <TopBar>
      <Link
        to={back?.to ?? "/"}
        className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-muted-foreground hover:text-foreground"
      >
        {back ? <ArrowLeft size={15} /> : <LayoutDashboard size={15} />}
        {back?.label ?? "VanyaOS"}
      </Link>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      {children}
    </TopBar>
  )
}
