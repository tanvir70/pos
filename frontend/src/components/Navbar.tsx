import { useState } from "react"
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
  type LucideIcon,
} from "lucide-react"

export interface NavbarProps {
  activeTab: NavigationTab
  onTabChange: (tab: NavigationTab) => void
  isOwner?: boolean
  onToggleOwner?: (isOwner: boolean) => void
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

export default function Navbar({
  activeTab,
  onTabChange,
  isOwner: propIsOwner,
  onToggleOwner: propOnToggleOwner,
}: NavbarProps) {
  const auth = useAuth()
  const { showSuccess, showError } = useToast()

  const isOwner = propIsOwner !== undefined ? propIsOwner : auth.isOwner

  const [isBackupLoading, setIsBackupLoading] = useState(false)
  const [backupStatus, setBackupStatus] = useState<"idle" | "success" | "error">("idle")

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
    if (isOwner) {
      if (propOnToggleOwner) {
        propOnToggleOwner(false)
      }
      if (auth.isElevated) {
        auth.lockToCashier()
      }
    } else {
      auth.openPinModal()
    }
  }

  const displayName = auth.fullName || auth.username

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Top Brand & Actions Bar */}
        <div className="flex items-center justify-between h-14 border-b border-slate-200/40 gap-2">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-sm shrink-0">
              <Sprout className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="font-bold text-slate-900 text-base sm:text-lg leading-tight tracking-tight">
                  Al-Amin Traders
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Authorized Agrochemical Dealer
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block leading-none mt-0.5">
                Agrochemical Dealership Cockpit
              </p>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 1-Click DB Backup Button */}
            <Button
              variant={
                backupStatus === "success"
                  ? "primary"
                  : backupStatus === "error"
                    ? "danger"
                    : "outline"
              }
              size="sm"
              onClick={handleBackup}
              isLoading={isBackupLoading}
              title="Download the complete database as a 1-click SQL backup"
              className={backupStatus === "idle" ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100" : ""}
            >
              {backupStatus === "success" ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Backup Complete</span>
                </>
              ) : backupStatus === "error" ? (
                <>
                  <XCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Backup Failed</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Backup Database</span>
                </>
              )}
            </Button>

            {/* Signed-in User */}
            {displayName && (
              <span className="hidden md:inline text-xs text-slate-500 font-medium">
                Hi, <span className="text-slate-900 font-bold">{displayName}</span>
              </span>
            )}

            {/* Cashier / Owner Mode Toggle */}
            {isOwner && !auth.isElevated ? (
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-xs bg-amber-100 text-amber-900 border-amber-300"
                title="Signed in as Owner: purchase cost and gross profit are visible."
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="font-bold">Owner (Admin)</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRoleToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-xs cursor-pointer ${
                  isOwner
                    ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 ring-2 ring-amber-400/40"
                    : "bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100"
                }`}
                title={
                  isOwner
                    ? "Owner Mode unlocked: purchase cost and gross profit are visible. Click to lock back to Cashier Mode."
                    : "Cashier Mode: purchase cost and profit are hidden. Unlock with the 4-digit Owner PIN."
                }
              >
                {isOwner ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span className="font-bold">
                  {isOwner ? "Owner Mode (Unlocked)" : "Cashier Mode"}
                </span>
              </button>
            )}

            {/* Logout */}
            <Button
              variant="ghost"
              size="sm"
              onClick={auth.logout}
              title="Sign out"
              className="text-slate-500 hover:text-red-600"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex gap-1 py-1.5 overflow-x-auto no-scrollbar">
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
