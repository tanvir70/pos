import { PanelLeftClose, PanelLeftOpen, ShieldCheck, Lock, Sprout } from "lucide-react"
import type { NavigationTab } from "../types"
import { useAuth } from "../context/AuthContext"

export interface TopBarProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  activeTab: NavigationTab
}

const TAB_LABELS: Record<NavigationTab, string> = {
  pos: "POS",
  dashboard: "Analytics",
  inventory: "Dokan Stock",
  customers: "Customer Ledger",
  returns: "Sales Returns",
  wholesale: "Wholesale Settings",
  settings: "Settings",
}

export default function TopBar({ isSidebarOpen, onToggleSidebar, activeTab }: TopBarProps) {
  const auth = useAuth()

  const handleRoleClick = () => {
    if (auth.isOwner && auth.isElevated) {
      auth.lockToCashier()
    } else if (!auth.isOwner) {
      auth.openPinModal()
    }
  }

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
              Al-Amin Traders
            </span>
          </div>
        )}

        <div className="h-5 w-px bg-slate-200 shrink-0" />

        <span className="text-sm font-bold text-slate-900 truncate">
          {TAB_LABELS[activeTab]}
        </span>
      </div>

      {/* Owner / Cashier status */}
      <button
        type="button"
        onClick={handleRoleClick}
        disabled={auth.isOwner && !auth.isElevated}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0 ${
          auth.isOwner
            ? auth.isElevated
              ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 cursor-pointer ring-2 ring-amber-400/30"
              : "bg-amber-100 text-amber-900 border-amber-300 cursor-default"
            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer"
        }`}
        title={
          auth.isOwner
            ? auth.isElevated
              ? "Owner Mode unlocked: purchase cost and gross profit are visible. Click to lock back to Cashier Mode."
              : "Signed in as Owner: purchase cost and gross profit are visible."
            : "Cashier Mode: purchase cost and profit are hidden. Unlock with the 4-digit Owner PIN."
        }
      >
        {auth.isOwner ? <ShieldCheck className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">
          {auth.isOwner ? "Owner (Admin)" : "Cashier Mode"}
        </span>
      </button>
    </header>
  )
}
