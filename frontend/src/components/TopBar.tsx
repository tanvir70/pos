import { PanelLeftClose, PanelLeftOpen, Sprout, Sun, Moon } from "lucide-react"
import type { NavigationTab } from "../types"
import { useTheme } from "../context/ThemeContext"
import NetworkStatusBadge from "./NetworkStatusBadge"
import Button from "./ui/Button"
import Badge from "./ui/Badge"
import { Separator } from "./ui/separator"
import { STORE_INFO } from "../constants/store"
import BrandLogo from "./ui/BrandLogo"

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
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 px-3 sm:px-4 shadow-xs transition-colors duration-200">
      <div className="flex items-center gap-3 min-w-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-9 w-9 -ml-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer shrink-0"
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="w-5 h-5" />
          ) : (
            <PanelLeftOpen className="w-5 h-5" />
          )}
        </Button>

        {/* Brand — only needed on mobile when the sidebar is fully hidden off-screen;
            on desktop the collapsed sidebar stays visible as an icon rail with its own brand mark. */}
        {!isSidebarOpen && (
          <div className="flex items-center gap-2 min-w-0 shrink-0 md:hidden">
            <BrandLogo size="xs" variant="image" />
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
              {STORE_INFO.name}
            </span>
          </div>
        )}

        <Separator orientation="vertical" className="h-5 bg-slate-200 dark:bg-slate-800" />

        <div className="flex items-center gap-2 min-w-0">
          <BrandLogo size="xs" variant="image" className="shrink-0" />
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {TAB_LABELS[activeTab]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Dark/Light Theme Quick Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="h-8.5 w-8.5 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all cursor-pointer shadow-2xs"
          title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle color theme"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600 hover:-rotate-12 transition-transform" />
          )}
        </button>

        <Separator orientation="vertical" className="h-4 bg-slate-200 dark:bg-slate-800" />
        <NetworkStatusBadge />
        <Separator orientation="vertical" className="h-4 bg-slate-200 dark:bg-slate-800 hidden sm:block" />
        <Badge
          variant="outline"
          className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 hidden sm:inline-flex"
        >
          Full access
        </Badge>
      </div>
    </header>
  )
}
