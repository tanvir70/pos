import { useEffect, useState, useRef } from "react"
import type { NavigationTab } from "../types"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import { focusPrimarySearch } from "../utils/keyboard"
import {
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
import { STORE_INFO } from "../constants/store"
import BrandLogo from "./ui/BrandLogo"

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
  activeBar: string
}

const TAB_THEMES: Record<NavigationTab, TabTheme> = {
  pos: {
    activeBg: "bg-white dark:bg-slate-800/95 border-emerald-400/80 dark:border-emerald-500/50 shadow-xs dark:shadow-md dark:shadow-emerald-500/10 ring-1 ring-emerald-500/15 dark:ring-emerald-400/20",
    activeText: "text-emerald-950 dark:text-emerald-100 font-bold",
    activeBorder: "border-emerald-400/80 dark:border-emerald-500/50",
    activeBadge: "bg-emerald-600 text-white border-emerald-500 shadow-xs shadow-emerald-600/25 dark:bg-emerald-500 dark:border-emerald-400 dark:shadow-emerald-500/30",
    inactiveBadge: "text-emerald-800/80 dark:text-emerald-400 group-hover:text-emerald-950 dark:group-hover:text-emerald-200",
    activeBar: "bg-emerald-600 dark:bg-emerald-400",
  },
  dashboard: {
    activeBg: "bg-white dark:bg-slate-800/95 border-sky-400/80 dark:border-sky-500/50 shadow-xs dark:shadow-md dark:shadow-sky-500/10 ring-1 ring-sky-500/15 dark:ring-sky-400/20",
    activeText: "text-sky-950 dark:text-sky-100 font-bold",
    activeBorder: "border-sky-400/80 dark:border-sky-500/50",
    activeBadge: "bg-sky-600 text-white border-sky-500 shadow-xs shadow-sky-600/25 dark:bg-sky-500 dark:border-sky-400 dark:shadow-sky-500/30",
    inactiveBadge: "text-sky-800/80 dark:text-sky-400 group-hover:text-sky-950 dark:group-hover:text-sky-200",
    activeBar: "bg-sky-600 dark:bg-sky-400",
  },
  inventory: {
    activeBg: "bg-white dark:bg-slate-800/95 border-amber-400/80 dark:border-amber-500/50 shadow-xs dark:shadow-md dark:shadow-amber-500/10 ring-1 ring-amber-500/15 dark:ring-amber-400/20",
    activeText: "text-amber-950 dark:text-amber-100 font-bold",
    activeBorder: "border-amber-400/80 dark:border-amber-500/50",
    activeBadge: "bg-amber-600 text-white border-amber-500 shadow-xs shadow-amber-600/25 dark:bg-amber-500 dark:border-amber-400 dark:shadow-amber-500/30",
    inactiveBadge: "text-amber-800/80 dark:text-amber-400 group-hover:text-amber-950 dark:group-hover:text-amber-200",
    activeBar: "bg-amber-600 dark:bg-amber-400",
  },
  customers: {
    activeBg: "bg-white dark:bg-slate-800/95 border-indigo-400/80 dark:border-indigo-500/50 shadow-xs dark:shadow-md dark:shadow-indigo-500/10 ring-1 ring-indigo-500/15 dark:ring-indigo-400/20",
    activeText: "text-indigo-950 dark:text-indigo-100 font-bold",
    activeBorder: "border-indigo-400/80 dark:border-indigo-500/50",
    activeBadge: "bg-indigo-600 text-white border-indigo-500 shadow-xs shadow-indigo-600/25 dark:bg-indigo-500 dark:border-indigo-400 dark:shadow-indigo-500/30",
    inactiveBadge: "text-indigo-800/80 dark:text-indigo-400 group-hover:text-indigo-950 dark:group-hover:text-indigo-200",
    activeBar: "bg-indigo-600 dark:bg-indigo-400",
  },
  returns: {
    activeBg: "bg-white dark:bg-slate-800/95 border-rose-400/80 dark:border-rose-500/50 shadow-xs dark:shadow-md dark:shadow-rose-500/10 ring-1 ring-rose-500/15 dark:ring-rose-400/20",
    activeText: "text-rose-950 dark:text-rose-100 font-bold",
    activeBorder: "border-rose-400/80 dark:border-rose-500/50",
    activeBadge: "bg-rose-600 text-white border-rose-500 shadow-xs shadow-rose-600/25 dark:bg-rose-500 dark:border-rose-400 dark:shadow-rose-500/30",
    inactiveBadge: "text-rose-800/80 dark:text-rose-400 group-hover:text-rose-950 dark:group-hover:text-rose-200",
    activeBar: "bg-rose-600 dark:bg-rose-400",
  },
  settings: {
    activeBg: "bg-white dark:bg-slate-800/95 border-purple-400/80 dark:border-purple-500/50 shadow-xs dark:shadow-md dark:shadow-purple-500/10 ring-1 ring-purple-500/15 dark:ring-purple-400/20",
    activeText: "text-purple-950 dark:text-purple-100 font-bold",
    activeBorder: "border-purple-400/80 dark:border-purple-500/50",
    activeBadge: "bg-purple-600 text-white border-purple-500 shadow-xs shadow-purple-600/25 dark:bg-purple-500 dark:border-purple-400 dark:shadow-purple-500/30",
    inactiveBadge: "text-purple-800/80 dark:text-purple-400 group-hover:text-purple-950 dark:group-hover:text-purple-200",
    activeBar: "bg-purple-600 dark:bg-purple-400",
  },
  "bin-card": {
    activeBg: "bg-white dark:bg-slate-800/95 border-teal-400/80 dark:border-teal-500/50 shadow-xs dark:shadow-md dark:shadow-teal-500/10 ring-1 ring-teal-500/15 dark:ring-teal-400/20",
    activeText: "text-teal-950 dark:text-teal-100 font-bold",
    activeBorder: "border-teal-400/80 dark:border-teal-500/50",
    activeBadge: "bg-teal-600 text-white border-teal-500 shadow-xs shadow-teal-600/25 dark:bg-teal-500 dark:border-teal-400 dark:shadow-teal-500/30",
    inactiveBadge: "text-teal-800/80 dark:text-teal-400 group-hover:text-teal-950 dark:group-hover:text-teal-200",
    activeBar: "bg-teal-600 dark:bg-teal-400",
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
        className={`fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-xs transition-opacity duration-200 ${
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
        <div className="relative w-72 md:w-full h-full bg-gradient-to-b from-[#dcf1e2] via-[#cae7d1] to-[#b8ddc0] dark:from-[#091018] dark:via-[#0c1420] dark:to-[#07130f] text-slate-800 dark:text-slate-200 border-r border-emerald-400/60 dark:border-slate-800/80 shadow-2xl md:shadow-none flex flex-col overflow-hidden transition-colors duration-200 select-none">
          {/* Delicate agricultural dot-mesh texture */}
          <div
            className="absolute inset-0 opacity-[0.05] dark:opacity-[0.045] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, #047857 1px, transparent 0)`,
              backgroundSize: "16px 16px",
            }}
          />

          {/* Soft organic atmospheric mesh glows */}
          <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-emerald-300/40 via-teal-200/25 to-transparent dark:from-emerald-950/25 dark:via-teal-950/10 dark:to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-emerald-300/45 via-teal-200/25 to-transparent dark:from-emerald-950/35 dark:via-teal-950/10 dark:to-transparent pointer-events-none" />

          {/* Unified Botanical Foliage Watermark (Cohesive organic etching with vertical fade masking) */}
          <div
            className="absolute bottom-16 -right-6 w-72 h-[340px] pointer-events-none select-none overflow-hidden"
            style={{
              maskImage: "linear-gradient(to top, transparent 0%, black 18%, black 82%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to top, transparent 0%, black 18%, black 82%, transparent 100%)",
            }}
          >
            <svg
              viewBox="0 0 240 360"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full text-emerald-800/[0.13] dark:text-emerald-400/[0.07] transform rotate-3 translate-x-2"
            >
              {/* Main organic stem */}
              <path
                d="M130 355 Q 115 250 142 140 Q 155 70 170 15"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Node 1 - Lower left leaf */}
              <path
                d="M124 300 C 65 290 35 250 45 210 C 85 210 124 255 124 300 Z"
                fill="currentColor"
              />
              <path
                d="M124 300 Q 85 260 45 210"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeOpacity="0.4"
                strokeLinecap="round"
              />
              {/* Node 2 - Lower right leaf */}
              <path
                d="M133 245 C 182 232 212 195 205 155 C 165 155 133 205 133 245 Z"
                fill="currentColor"
              />
              <path
                d="M133 245 Q 168 205 205 155"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeOpacity="0.4"
                strokeLinecap="round"
              />
              {/* Node 3 - Mid left leaf */}
              <path
                d="M138 185 C 92 172 68 135 75 95 C 115 98 136 145 138 185 Z"
                fill="currentColor"
              />
              <path
                d="M138 185 Q 108 145 75 95"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeOpacity="0.4"
                strokeLinecap="round"
              />
              {/* Node 4 - Mid right leaf */}
              <path
                d="M147 130 C 190 115 210 80 200 45 C 165 50 146 95 147 130 Z"
                fill="currentColor"
              />
              <path
                d="M147 130 Q 174 95 200 45"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeOpacity="0.4"
                strokeLinecap="round"
              />
              {/* Node 5 - Terminal leaf */}
              <path
                d="M158 65 C 142 30 152 10 170 15 C 184 40 170 60 158 65 Z"
                fill="currentColor"
              />
              {/* Subtle companion seedling on bottom left */}
              <path
                d="M50 340 Q 60 300 75 270"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeOpacity="0.6"
              />
              <path
                d="M75 270 C 60 255 45 258 40 270 C 45 285 65 280 75 270 Z"
                fill="currentColor"
                fillOpacity="0.8"
              />
              <path
                d="M75 270 C 90 260 102 268 100 280 C 88 288 78 280 75 270 Z"
                fill="currentColor"
                fillOpacity="0.8"
              />
            </svg>
          </div>

          {/* Brand */}
          <div
            className={`relative z-10 flex items-center justify-between px-4 h-16 border-b border-emerald-400/50 dark:border-slate-800/80 shrink-0 gap-2.5 bg-[#dcf1e2]/90 dark:bg-slate-900/80 backdrop-blur-md ${
              isRail ? "md:justify-center md:px-0" : ""
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <BrandLogo size="md" variant="image" className="shrink-0 transition-transform hover:scale-105" />
              <div className={`truncate ${isRail ? "md:hidden" : ""}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 dark:text-white text-sm leading-tight tracking-tight truncate">
                    {STORE_INFO.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-700/12 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-300 border border-emerald-600/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate">
                    Agro Cockpit
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono ml-auto">v2.6</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer md:hidden"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className={`relative z-10 flex-1 overflow-y-auto p-3 space-y-1.5 ${isRail ? "md:px-2" : ""}`}>
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
                  className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold cursor-pointer border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                    isRail ? "md:justify-center md:px-0" : ""
                  } ${
                    isActive
                      ? `${theme.activeBg} ${theme.activeText} ${theme.activeBorder}`
                      : "border-transparent text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:border-emerald-200/50 dark:hover:border-slate-700/50 hover:shadow-2xs"
                  }`}
                >
                  {/* Active docked interior accent indicator */}
                  {isActive && (
                    <span
                      className={`absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-md ${theme.activeBar} ${
                        isRail ? "md:hidden" : ""
                      }`}
                    />
                  )}

                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150 ${
                      isActive
                        ? `${theme.activeBadge} border shadow-xs`
                        : `${theme.inactiveBadge} group-hover:scale-105`
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

          {/* Footer - Executive User Profile & Session Card */}
          <div
            className={`relative z-10 border-t border-emerald-400/50 dark:border-slate-800/80 p-3 shrink-0 bg-[#cae7d1]/90 dark:bg-slate-900/80 backdrop-blur-md ${
              isRail ? "md:px-2" : ""
            }`}
          >
            <div
              className={`flex items-center rounded-xl bg-white/95 dark:bg-slate-900/90 border border-emerald-300/70 dark:border-slate-800 shadow-2xs transition-all ${
                isRail ? "md:p-1.5 md:justify-center" : "p-2 justify-between gap-2"
              }`}
            >
              {/* User Avatar + Identity */}
              <div className={`flex items-center gap-2.5 min-w-0 ${isRail ? "md:hidden" : ""}`}>
                {/* Avatar Badge with User Initial */}
                <div className="w-8 h-8 rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs shadow-emerald-600/25">
                  {(displayName || "Owner").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                    {displayName || "Shop Owner"}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
                    <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider truncate">
                      {auth.role ? auth.role.replace("ROLE_", "") : "OWNER"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sleek Logout Action */}
              <button
                type="button"
                onClick={confirmLogout}
                title="Logout (End session)"
                aria-label="Logout"
                className={`group flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-all duration-150 cursor-pointer ${
                  isRail ? "w-9 h-9" : "p-1.5 shrink-0"
                }`}
              >
                <LogOut className="w-4 h-4 transition-transform group-hover:scale-110" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
