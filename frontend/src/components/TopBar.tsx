import { PanelLeftClose, PanelLeftOpen, Sprout } from "lucide-react"
import type { NavigationTab } from "../types"
import NetworkStatusBadge from "./NetworkStatusBadge"

export interface TopBarProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  activeTab: NavigationTab
}

const TAB_LABELS: Record<NavigationTab, string> = {
  pos: "POS",
  dashboard: "Dashboard",
  inventory: "Dokan Stock",
  customers: "Customer Ledger",
  returns: "Sales Returns",
  settings: "Settings",
  "bin-card": "Stock Ledger",
}

export default function TopBar({ isSidebarOpen, onToggleSidebar, activeTab }: TopBarProps) {
  return (
    <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between gap-3 px-3 sm:px-4 shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 -ml-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0 transition-colors"
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="w-5 h-5" />
          ) : (
            <PanelLeftOpen className="w-5 h-5" />
          )}
        </button>

        {/* Brand — only needed on mobile when the sidebar is fully hidden off-screen;
            on desktop the collapsed sidebar stays visible as an icon rail with its own brand mark. */}
        {!isSidebarOpen && (
          <div className="flex items-center gap-2 min-w-0 shrink-0 md:hidden">
            <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <Sprout className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 text-sm truncate">
              Rajib Enterprise
            </span>
          </div>
        )}

        <div className="h-5 w-px bg-slate-200 shrink-0" />

        <span className="text-sm font-bold text-slate-900 truncate">
          {TAB_LABELS[activeTab]}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <NetworkStatusBadge />
        <div className="h-4 w-px bg-slate-200" />
        <div className="text-[11px] font-semibold text-slate-500 shrink-0">
          Full access
        </div>
      </div>
    </header>
  )
}
