import { useEffect, useState } from "react"
import type { NavigationTab } from "../types"
import { useAuth } from "../context/AuthContext"
import {
  Sprout,
  ShoppingCart,
  BarChart3,
  Package,
  BookOpen,
  RotateCcw,
  Settings2,
  KeyRound,
  LogOut,
  X,
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
  activeBar: string
  activeBadge: string
  inactiveBadge: string
}

const TAB_THEMES: Record<NavigationTab, TabTheme> = {
  pos: {
    activeBg: "bg-emerald-50/90",
    activeText: "text-emerald-950 font-bold",
    activeBorder: "border-emerald-200/90 shadow-xs shadow-emerald-600/5",
    activeBar: "bg-emerald-600",
    activeBadge: "bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-700/25 scale-105",
    inactiveBadge: "bg-emerald-50 text-emerald-700 border-emerald-200/70 group-hover:bg-emerald-100 group-hover:border-emerald-300 group-hover:scale-105",
  },
  dashboard: {
    activeBg: "bg-blue-50/90",
    activeText: "text-blue-950 font-bold",
    activeBorder: "border-blue-200/90 shadow-xs shadow-blue-600/5",
    activeBar: "bg-blue-600",
    activeBadge: "bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-700/25 scale-105",
    inactiveBadge: "bg-blue-50 text-blue-700 border-blue-200/70 group-hover:bg-blue-100 group-hover:border-blue-300 group-hover:scale-105",
  },
  inventory: {
    activeBg: "bg-amber-50/90",
    activeText: "text-amber-950 font-bold",
    activeBorder: "border-amber-200/90 shadow-xs shadow-amber-600/5",
    activeBar: "bg-amber-600",
    activeBadge: "bg-amber-600 text-white border-amber-500 shadow-sm shadow-amber-700/25 scale-105",
    inactiveBadge: "bg-amber-50 text-amber-700 border-amber-200/70 group-hover:bg-amber-100 group-hover:border-amber-300 group-hover:scale-105",
  },
  customers: {
    activeBg: "bg-indigo-50/90",
    activeText: "text-indigo-950 font-bold",
    activeBorder: "border-indigo-200/90 shadow-xs shadow-indigo-600/5",
    activeBar: "bg-indigo-600",
    activeBadge: "bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-700/25 scale-105",
    inactiveBadge: "bg-indigo-50 text-indigo-700 border-indigo-200/70 group-hover:bg-indigo-100 group-hover:border-indigo-300 group-hover:scale-105",
  },
  returns: {
    activeBg: "bg-rose-50/90",
    activeText: "text-rose-950 font-bold",
    activeBorder: "border-rose-200/90 shadow-xs shadow-rose-600/5",
    activeBar: "bg-rose-600",
    activeBadge: "bg-rose-600 text-white border-rose-500 shadow-sm shadow-rose-700/25 scale-105",
    inactiveBadge: "bg-rose-50 text-rose-700 border-rose-200/70 group-hover:bg-rose-100 group-hover:border-rose-300 group-hover:scale-105",
  },
  wholesale: {
    activeBg: "bg-purple-50/90",
    activeText: "text-purple-950 font-bold",
    activeBorder: "border-purple-200/90 shadow-xs shadow-purple-600/5",
    activeBar: "bg-purple-600",
    activeBadge: "bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-700/25 scale-105",
    inactiveBadge: "bg-purple-50 text-purple-700 border-purple-200/70 group-hover:bg-purple-100 group-hover:border-purple-300 group-hover:scale-105",
  },
  settings: {
    activeBg: "bg-purple-50/90",
    activeText: "text-purple-950 font-bold",
    activeBorder: "border-purple-200/90 shadow-xs shadow-purple-600/5",
    activeBar: "bg-purple-600",
    activeBadge: "bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-700/25 scale-105",
    inactiveBadge: "bg-purple-50 text-purple-700 border-purple-200/70 group-hover:bg-purple-100 group-hover:border-purple-300 group-hover:scale-105",
  },
}

const NAV_TABS: TabItem[] = [
  { id: "pos", label: "POS", icon: ShoppingCart },
  { id: "dashboard", label: "Analytics", icon: BarChart3 },
  { id: "inventory", label: "Dokan Stock", icon: Package },
  { id: "customers", label: "Customer Ledger", icon: BookOpen },
  { id: "returns", label: "Sales Returns", icon: RotateCcw },
]

export default function Sidebar({ isOpen, onClose, activeTab, onTabChange }: SidebarProps) {
  const auth = useAuth()

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
                    Al-Amin Traders
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
            {NAV_TABS.filter((tab) => {
              // Cashier mode cannot see Analytics
              if (tab.id === "dashboard" && !auth.isOwner) return false
              return true
            }).map((tab) => {
              const isActive = activeTab === tab.id
              const Icon = tab.icon
              const theme = TAB_THEMES[tab.id]
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  title={isRail ? tab.label : undefined}
                  className={`group relative w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer border ${
                    isRail ? "md:justify-center md:px-0" : ""
                  } ${
                    isActive
                      ? `${theme.activeBg} ${theme.activeText} ${theme.activeBorder}`
                      : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {/* Subtle active accent indicator bar */}
                  {isActive && (
                    <span
                      className={`absolute left-0.5 top-2 bottom-2 w-1 rounded-full ${theme.activeBar} ${
                        isRail ? "md:left-0.5" : ""
                      }`}
                    />
                  )}

                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-200 ${
                      isActive
                        ? theme.activeBadge
                        : `${theme.inactiveBadge} shadow-2xs group-hover:scale-105`
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`truncate text-left flex-1 ${isRail ? "md:hidden" : ""}`}>
                    {tab.label}
                  </span>

                  {/* Active subtle pill dot indicator when open */}
                  {isActive && !isRail && (
                    <span className={`w-1.5 h-1.5 rounded-full ${theme.activeBar} opacity-80 shrink-0`} />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Footer: Owner sees Settings; Cashier mode sees Cashier status (Settings hidden) */}
          <div className={`border-t border-slate-200/80 p-3 space-y-2 shrink-0 bg-slate-50/40 ${isRail ? "md:px-2" : ""}`}>
            {auth.isOwner ? (
              <button
                type="button"
                onClick={() => handleTabClick("settings")}
                title={isRail ? `Settings (Wholesale: -${wholesaleSettings.discountPercentage}%)` : undefined}
                className={`group relative w-full flex items-center gap-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  isRail ? "md:justify-center md:px-0 px-2.5 py-2" : "px-2.5 py-2"
                } ${
                  activeTab === "settings"
                    ? "bg-purple-50/90 text-purple-950 border-purple-200 shadow-xs ring-1 ring-purple-500/10"
                    : "bg-white text-slate-800 border-slate-200/80 hover:bg-purple-50/50 hover:border-purple-200 hover:shadow-2xs"
                }`}
              >
                {activeTab === "settings" && (
                  <span
                    className={`absolute left-0.5 top-2 bottom-2 w-1 rounded-full bg-purple-600 ${
                      isRail ? "md:left-0.5" : ""
                    }`}
                  />
                )}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-300 ${
                    activeTab === "settings"
                      ? "bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-600/20 scale-105"
                      : "bg-purple-50 text-purple-700 border-purple-200/80 shadow-2xs group-hover:scale-105 group-hover:rotate-45"
                  }`}
                >
                  <Settings2 className="w-4 h-4" />
                </div>
                <div className={`min-w-0 flex-1 text-left ${isRail ? "md:hidden" : ""}`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold leading-tight truncate">
                      Settings
                    </span>
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 border bg-purple-100 text-purple-800 border-purple-200"
                    >
                      -{wholesaleSettings.discountPercentage}%
                    </span>
                  </div>
                  <div
                    className={`text-[10px] font-medium truncate mt-0.5 ${
                      activeTab === "settings" ? "text-purple-700/80 font-semibold" : "text-slate-500 font-medium"
                    }`}
                  >
                    {displayName || "Owner"} • Owner Mode
                  </div>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => auth.openPinModal()}
                title={isRail ? "Owner Access (Enter PIN)" : "Owner Access - Click to enter PIN and unlock Owner Mode"}
                className={`group w-full flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white hover:bg-emerald-50/80 hover:border-emerald-300 text-slate-700 hover:text-emerald-950 transition-all duration-200 cursor-pointer shadow-2xs ${
                  isRail ? "md:justify-center md:px-0 px-2.5 py-2" : "px-2.5 py-2"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white flex items-center justify-center text-xs font-bold shrink-0 border border-emerald-500/30 shadow-2xs group-hover:scale-105 transition-transform">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div className={`min-w-0 flex-1 text-left ${isRail ? "md:hidden" : ""}`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-950 truncate">
                      Owner Access
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 border bg-emerald-100 text-emerald-800 border-emerald-200">
                      PIN
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 group-hover:text-emerald-700 font-medium truncate mt-0.5">
                    Click to enter Owner PIN
                  </div>
                </div>
              </button>
            )}

            {/* Perfectly Aligned Logout Button */}
            <button
              type="button"
              onClick={auth.logout}
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
