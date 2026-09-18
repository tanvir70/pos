import { useEffect, useState } from "react"
import type { NavigationTab } from "../types"
import { downloadDatabaseBackup } from "../api/endpoints"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import Button from "./ui/Button"
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
  ShieldCheck,
  Lock,
  LogOut,
  X,
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

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
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

  const handleRoleToggle = () => {
    if (auth.isOwner && auth.isElevated) {
      auth.lockToCashier()
    } else if (!auth.isOwner) {
      auth.openPinModal()
    }
  }

  const displayName = auth.fullName || auth.username

  const handleTabClick = (tab: NavigationTab) => {
    onTabChange(tab)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 bg-slate-900/40 z-40 transition-opacity duration-200 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-slate-200 shadow-2xl flex flex-col transition-transform duration-250 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!isOpen}
      >
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
            className="shrink-0 p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
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

        {/* Footer: Backup, User, Owner toggle, Logout */}
        <div className="border-t border-slate-200 p-3 space-y-2 shrink-0">
          <Button
            variant={
              backupStatus === "success" ? "primary" : backupStatus === "error" ? "danger" : "outline"
            }
            size="sm"
            fullWidth
            onClick={handleBackup}
            isLoading={isBackupLoading}
            title="Download the complete database as a 1-click SQL backup"
            className={
              backupStatus === "idle"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 justify-start"
                : "justify-start"
            }
          >
            {backupStatus === "success" ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Backup Complete</span>
              </>
            ) : backupStatus === "error" ? (
              <>
                <XCircle className="w-4 h-4" />
                <span>Backup Failed</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Backup Database</span>
              </>
            )}
          </Button>

          {auth.isOwner && !auth.isElevated ? (
            <span
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border shadow-xs bg-amber-100 text-amber-900 border-amber-300"
              title="Signed in as Owner: purchase cost and gross profit are visible."
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="font-bold">Owner (Admin)</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleRoleToggle}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all border shadow-xs cursor-pointer ${
                auth.isOwner
                  ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 ring-2 ring-amber-400/40"
                  : "bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100"
              }`}
              title={
                auth.isOwner
                  ? "Owner Mode unlocked: purchase cost and gross profit are visible. Click to lock back to Cashier Mode."
                  : "Cashier Mode: purchase cost and profit are hidden. Unlock with the 4-digit Owner PIN."
              }
            >
              {auth.isOwner ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span className="font-bold">
                {auth.isOwner ? "Owner Mode (Unlocked)" : "Cashier Mode"}
              </span>
            </button>
          )}

          {displayName && (
            <div className="px-1 text-xs text-slate-500 font-medium">
              Signed in as <span className="text-slate-900 font-bold">{displayName}</span>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onClick={auth.logout}
            className="text-slate-500 hover:text-red-600 justify-start"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>
    </>
  )
}
