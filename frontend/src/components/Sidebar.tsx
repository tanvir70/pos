import { useEffect, useState, useRef } from "react"
import type { NavigationTab } from "../types"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import { focusPrimarySearch } from "../utils/keyboard"
import {
  Sprout,
  ShoppingCart,
  LayoutDashboard,
  Package,
  BookOpen,
  RotateCcw,
  Settings2,
  LogOut,
  X,
  History,
  type LucideIcon,
} from "lucide-react"
import {
  getWholesaleSettings,
  type WholesaleSettings,
} from "../utils/wholesaleSettings"

export interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  activeTab: NavigationTab
  onTabChange: (tab: NavigationTab) => void
}

interface TabItem {
  id: NavigationTab
  label: string
  icon: LucideIcon
}

interface TabTheme {
  activeBg: string
  activeText: string
  activeBorder: string
  activeBadge: string
  inactiveBadge: string
}

const TAB_THEMES: Record<NavigationTab, TabTheme> = {
  pos: {
    activeBg: "bg-emerald-50/90",
    activeText: "text-emerald-950 font-bold",
    activeBorder: "border-emerald-200/90 shadow-xs shadow-emerald-600/5",
    activeBadge: "bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-700/25",
    inactiveBadge: "bg-emerald-50 text-emerald-700 border-emerald-200/70 group-hover:bg-emerald-100 group-hover:border-emerald-300",
  },
  dashboard: {
    activeBg: "bg-blue-50/90",
    activeText: "text-blue-950 font-bold",
    activeBorder: "border-blue-200/90 shadow-xs shadow-blue-600/5",
    activeBadge: "bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-700/25",
    inactiveBadge: "bg-blue-50 text-blue-700 border-blue-200/70 group-hover:bg-blue-100 group-hover:border-blue-300",
  },
  inventory: {
    activeBg: "bg-amber-50/90",
    activeText: "text-amber-950 font-bold",
    activeBorder: "border-amber-200/90 shadow-xs shadow-amber-600/5",
    activeBadge: "bg-amber-600 text-white border-amber-500 shadow-sm shadow-amber-700/25",
    inactiveBadge: "bg-amber-50 text-amber-700 border-amber-200/70 group-hover:bg-amber-100 group-hover:border-amber-300",
  },
  customers: {
    activeBg: "bg-indigo-50/90",
    activeText: "text-indigo-950 font-bold",
    activeBorder: "border-indigo-200/90 shadow-xs shadow-indigo-600/5",
    activeBadge: "bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-700/25",
    inactiveBadge: "bg-indigo-50 text-indigo-700 border-indigo-200/70 group-hover:bg-indigo-100 group-hover:border-indigo-300",
  },
  returns: {
    activeBg: "bg-rose-50/90",
    activeText: "text-rose-950 font-bold",
    activeBorder: "border-rose-200/90 shadow-xs shadow-rose-600/5",
    activeBadge: "bg-rose-600 text-white border-rose-500 shadow-sm shadow-rose-700/25",
    inactiveBadge: "bg-rose-50 text-rose-700 border-rose-200/70 group-hover:bg-rose-100 group-hover:border-rose-300",
  },
  settings: {
    activeBg: "bg-purple-50/90",
    activeText: "text-purple-950 font-bold",
    activeBorder: "border-purple-200/90 shadow-xs shadow-purple-600/5",
    activeBadge: "bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-700/25",
    inactiveBadge: "bg-purple-50 text-purple-700 border-purple-200/70 group-hover:bg-purple-100 group-hover:border-purple-300",
  },
  "bin-card": {
    activeBg: "bg-teal-50/90",
    activeText: "text-teal-950 font-bold",
    activeBorder: "border-teal-200/90 shadow-xs shadow-teal-600/5",
    activeBadge: "bg-teal-600 text-white border-teal-500 shadow-sm shadow-teal-700/25",
    inactiveBadge: "bg-teal-50 text-teal-700 border-teal-200/70 group-hover:bg-teal-100 group-hover:border-teal-300",
  },
}

const NAV_TABS: TabItem[] = [
  { id: "pos", label: "POS", icon: ShoppingCart },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inventory", label: "Dokan Stock", icon: Package },
  { id: "bin-card", label: "Stock Ledger", icon: History },
  { id: "customers", label: "Customer Ledger", icon: BookOpen },
  { id: "returns", label: "Sales Returns", icon: RotateCcw },
  { id: "settings", label: "Settings", icon: Settings2 },
]

export default function Sidebar({ isOpen, onClose, activeTab, onTabChange }: SidebarProps) {
  const auth = useAuth()
  const { showToast, dismissToast } = useToast()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const [wholesaleSettings, setWholesaleSettings] = useState<WholesaleSettings>(getWholesaleSettings)

  useEffect(() => {
    const handleSettingsUpdated = (e: Event) => {
      const custom = e as CustomEvent<WholesaleSettings>
      if (custom.detail) {
        setWholesaleSettings(custom.detail)
      }
    }
    window.addEventListener("wholesale-settings-updated", handleSettingsUpdated)
    return () => window.removeEventListener("wholesale-settings-updated", handleSettingsUpdated)
  }, [])

  // Close on Escape (relevant on mobile, where the sidebar overlays content)
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && window.innerWidth < 768) onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const displayName = auth.fullName || auth.username

  // On mobile the sidebar overlays content, so picking a tab should close it;
  // on desktop it's a permanent panel (open full or collapsed to an icon rail),
  // so it stays exactly as the user left it.
  const handleTabClick = (tab: NavigationTab) => {
    onTabChange(tab)
    if (window.innerWidth < 768) onClose()
  }

  const confirmLogout = () => {
    let toastId = ""
    toastId = showToast({
      type: "warning",
      title: "Confirm logout",
      message: "End the current session and return to the sign-in screen?",
      duration: 0,
      presentation: "confirmation",
      actions: [
        {
          label: "Cancel",
          onClick: () => dismissToast(toastId),
        },
        {
          label: "Logout",
          intent: "danger",
          onClick: () => {
            dismissToast(toastId)
            auth.logout()
          },
        },
      ],
    })
  }

  // Desktop: full width when open, a narrow icon-only rail when collapsed (never
  // fully hidden). Mobile: full width overlay that slides fully off-screen when closed.
  const isRail = !isOpen

  return (
    <>
      {/* Backdrop — mobile only, where the panel overlays instead of pushing content */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 bg-slate-900/40 z-40 md:hidden transition-opacity duration-200 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel: overlay + slide on mobile, permanent width-collapsible column on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform transition-transform duration-250 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:relative md:z-auto md:transform-none md:translate-x-0 md:shrink-0 md:h-full md:transition-[width] md:duration-250 md:ease-out ${
          isRail ? "md:w-16" : "md:w-72"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="w-72 md:w-full h-full bg-white border-r border-slate-200 shadow-2xl md:shadow-none flex flex-col overflow-hidden">
          {/* Brand */}
          <div
            className={`flex items-center justify-between px-4 h-16 border-b border-slate-200/80 shrink-0 gap-2.5 bg-gradient-to-r from-slate-50/70 via-white to-slate-50/20 ${
              isRail ? "md:justify-center md:px-0" : ""
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white flex items-center justify-center shadow-md shadow-emerald-700/20 ring-1 ring-emerald-500/20 shrink-0">
                <Sprout className="w-5 h-5 drop-shadow-xs" />
              </div>
              <div className={`truncate ${isRail ? "md:hidden" : ""}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 text-sm leading-tight truncate">
                    Rajib Enterprise
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="System Online" />
                </div>
                <p className="text-[11px] text-slate-500 leading-none mt-0.5 truncate font-medium">
                  Agrochemical Cockpit
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer md:hidden"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 overflow-y-auto p-3 space-y-1.5 ${isRail ? "md:px-2" : ""}`}>
            {NAV_TABS.map((tab, index) => {
              const isActive = activeTab === tab.id
              const Icon = tab.icon
              const theme = TAB_THEMES[tab.id]
              return (
                <button
                  ref={(el) => {
                    tabRefs.current[index] = el
                  }}
                  type="button"
                  key={tab.id}
                  data-sidebar-tab="true"
                  data-tab-id={tab.id}
                  data-active={isActive ? "true" : "false"}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleTabClick(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault()
                      const nextIndex = (index + 1) % NAV_TABS.length
                      const nextTab = NAV_TABS[nextIndex]
                      handleTabClick(nextTab.id)
                      setTimeout(() => tabRefs.current[nextIndex]?.focus(), 15)
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault()
                      const prevIndex = (index - 1 + NAV_TABS.length) % NAV_TABS.length
                      const prevTab = NAV_TABS[prevIndex]
                      handleTabClick(prevTab.id)
                      setTimeout(() => tabRefs.current[prevIndex]?.focus(), 15)
                    } else if (e.key === "Home") {
                      e.preventDefault()
                      const firstTab = NAV_TABS[0]
                      handleTabClick(firstTab.id)
                      setTimeout(() => tabRefs.current[0]?.focus(), 15)
                    } else if (e.key === "End") {
                      e.preventDefault()
                      const lastTab = NAV_TABS[NAV_TABS.length - 1]
                      handleTabClick(lastTab.id)
                      setTimeout(() => tabRefs.current[NAV_TABS.length - 1]?.focus(), 15)
                    } else if (e.key === "ArrowRight") {
                      e.preventDefault()
                      focusPrimarySearch()
                    }
                  }}
                  title={isRail ? tab.label : undefined}
                  className={`group relative w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-semibold cursor-pointer border focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-slate-100 ${
                    isRail ? "md:justify-center md:px-0" : ""
                  } ${
                    isActive
                      ? `${theme.activeBg} ${theme.activeText} ${theme.activeBorder}`
                      : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      isActive
                        ? theme.activeBadge
                        : `${theme.inactiveBadge} shadow-2xs`
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`truncate text-left flex-1 ${isRail ? "md:hidden" : ""}`}>
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </nav>

          {/* Footer */}
          <div className={`border-t border-slate-200/80 p-3 space-y-2 shrink-0 bg-slate-50/40 ${isRail ? "md:px-2" : ""}`}>
            {/* Perfectly Aligned Logout Button */}
            <button
              type="button"
              onClick={confirmLogout}
              title={isRail ? "Logout" : undefined}
              className={`group w-full flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white hover:bg-rose-50/80 hover:border-rose-200/90 text-slate-700 hover:text-rose-700 text-sm font-semibold transition-all duration-200 cursor-pointer shadow-2xs ${
                isRail ? "md:justify-center md:px-0 px-2.5 py-2" : "px-2.5 py-2"
              }`}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-slate-200/80 bg-slate-50 text-slate-500 shadow-2xs group-hover:bg-rose-100 group-hover:border-rose-200 group-hover:text-rose-600 group-hover:scale-105 transition-all duration-200">
                <LogOut className="w-4 h-4" />
              </div>
              <div className={`min-w-0 flex-1 text-left ${isRail ? "md:hidden" : ""}`}>
                <div className="text-xs font-bold leading-tight truncate">
                  Logout
                </div>
                <div className="text-[10px] text-slate-400 group-hover:text-rose-600 font-medium truncate mt-0.5">
                  End active session
                </div>
              </div>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
