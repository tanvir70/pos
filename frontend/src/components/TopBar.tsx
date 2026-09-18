import { Menu, Sprout } from "lucide-react"
import type { NavigationTab } from "../types"

export interface TopBarProps {
  onOpenMenu: () => void
  activeTab: NavigationTab
}

const TAB_LABELS: Record<NavigationTab, string> = {
  pos: "POS",
  dashboard: "Analytics",
  inventory: "Inventory",
  customers: "Customer Ledger",
  returns: "Sales Returns",
}

export default function TopBar({ onOpenMenu, activeTab }: TopBarProps) {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center gap-3 px-3 sm:px-4 shadow-xs">
      <button
        type="button"
        onClick={onOpenMenu}
        className="p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0"
        aria-label="Open menu"
        title="Menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
          <Sprout className="w-4 h-4" />
        </div>
        <span className="font-bold text-slate-900 text-sm truncate hidden sm:inline">
          Al-Amin Traders
        </span>
      </div>

      <div className="h-4 w-px bg-slate-200 hidden sm:block" />

      <span className="text-sm font-semibold text-slate-500 truncate">
        {TAB_LABELS[activeTab]}
      </span>
    </header>
  )
}
