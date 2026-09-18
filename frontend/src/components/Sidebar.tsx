import { useEffect, useState } from "react"
import type { NavigationTab } from "../types"
import { downloadDatabaseBackup } from "../api/endpoints"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import {
  Sprout,
  ShoppingCart,
  BarChart3,
  Package,
  BookOpen,
  RotateCcw,
  Download,
  CheckCircle2,
  XCircle,
  LogOut,
  X,
  Loader2,
  type LucideIcon,
} from "lucide-react"

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

const NAV_TABS: TabItem[] = [
  { id: "pos", label: "POS", icon: ShoppingCart },
  { id: "dashboard", label: "Analytics", icon: BarChart3 },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "customers", label: "Customer Ledger", icon: BookOpen },
  { id: "returns", label: "Sales Returns", icon: RotateCcw },
]

export default function Sidebar({ isOpen, onClose, activeTab, onTabChange }: SidebarProps) {
  const auth = useAuth()
  const { showSuccess, showError } = useToast()

  const [isBackupLoading, setIsBackupLoading] = useState(false)
  const [backupStatus, setBackupStatus] = useState<"idle" | "success" | "error">("idle")

  // Close on Escape (relevant on mobile, where the sidebar overlays content)
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && window.innerWidth < 768) onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const handleBackup = async () => {
    if (isBackupLoading) return
    try {
      setIsBackupLoading(true)
      setBackupStatus("idle")
      await downloadDatabaseBackup()
      setBackupStatus("success")
      showSuccess("Database backup downloaded successfully!", "Backup Complete")
      setTimeout(() => setBackupStatus("idle"), 3000)
    } catch (err) {
      setBackupStatus("error")
      showError(err, "Backup Download Failed")
      setTimeout(() => setBackupStatus("idle"), 4000)
    } finally {
      setIsBackupLoading(false)
    }
  }

  const displayName = auth.fullName || auth.username
  const initials = (displayName || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  // On mobile the sidebar overlays content, so picking a tab should close it;
  // on desktop it's a permanent panel, so it stays exactly as the user left it.
  const handleTabClick = (tab: NavigationTab) => {
    onTabChange(tab)
    if (window.innerWidth < 768) onClose()
  }

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
        } md:relative md:z-auto md:transform-none md:translate-x-0 md:shrink-0 md:h-full md:transition-[width] md:duration-250 md:ease-out md:overflow-hidden ${
          isOpen ? "md:w-72" : "md:w-0"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="w-72 h-full bg-white border-r border-slate-200 shadow-2xl md:shadow-none flex flex-col">
          {/* Brand */}
          <div className="flex items-center justify-between gap-2 px-4 h-16 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-sm shrink-0">
                <Sprout className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className="font-bold text-slate-900 text-sm leading-tight truncate">
                  Al-Amin Traders
                </div>
                <p className="text-[11px] text-slate-500 leading-none mt-0.5 truncate">
                  Agrochemical Dealership Cockpit
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
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Footer: user identity card + Backup / Logout action row */}
          <div className="border-t border-slate-200 p-3 space-y-2.5 shrink-0">
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {displayName || "Guest"}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {auth.isOwner ? "Owner" : "Cashier"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleBackup}
                disabled={isBackupLoading}
                title="Download the complete database as a 1-click SQL backup"
                className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                  backupStatus === "success"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : backupStatus === "error"
                      ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {isBackupLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : backupStatus === "success" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : backupStatus === "error" ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {backupStatus === "success"
                    ? "Backed Up"
                    : backupStatus === "error"
                      ? "Retry Backup"
                      : "Backup"}
                </span>
              </button>

              <button
                type="button"
                onClick={auth.logout}
                className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
