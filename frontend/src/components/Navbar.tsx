import { useState } from "react"
import type { NavigationTab } from "../types"
import { downloadDatabaseBackup } from "../api/endpoints"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import Button from "./ui/Button"

export interface NavbarProps {
  activeTab: NavigationTab
  onTabChange: (tab: NavigationTab) => void
  isOwner?: boolean
  onToggleOwner?: (isOwner: boolean) => void
}

interface TabItem {
  id: NavigationTab
  bn: string
  en: string
  icon: string
}

const NAV_TABS: TabItem[] = [
  { id: "pos", bn: "বিক্রয় কাউন্টার", en: "POS", icon: "🛒" },
  { id: "dashboard", bn: "ড্যাশবোর্ড", en: "Analytics", icon: "📊" },
  { id: "inventory", bn: "পণ্য ও স্টক", en: "Catalog", icon: "📦" },
  { id: "customers", bn: "বাকি খাতা", en: "Ledger", icon: "📒" },
  { id: "returns", bn: "পণ্য ফেরত", en: "Returns", icon: "🔄" },
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
      showSuccess("ডাটাবেস ব্যাকআপ সফলভাবে ডাউনলোড হয়েছে!", "ব্যাকআপ সম্পন্ন")
      setTimeout(() => setBackupStatus("idle"), 3000)
    } catch (err) {
      setBackupStatus("error")
      showError(err, "ব্যাকআপ ডাউনলোড ব্যর্থ")
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
      auth.lockToCashier()
    } else {
      auth.openPinModal()
    }
  }

  return (
    <header className="bg-white border-b border-frost-border sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Top Brand & Actions Bar */}
        <div className="flex items-center justify-between h-14 border-b border-frost-border/40 gap-2">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
              🌾
            </div>
            <div className="truncate">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="font-bold text-frost-dark bn-text text-base sm:text-lg leading-tight tracking-tight">
                  আল-আমিন ট্রেডার্স
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 bn-text border border-emerald-200">
                  অনুমোদিত কৃষি পরিবেশক
                </span>
              </div>
              <p className="text-[11px] text-frost-muted hidden sm:block leading-none mt-0.5">
                Al-Amin Traders (Agrochemical Dealership Cockpit)
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
              title="সম্পূর্ণ ডেটাবেস ১-ক্লিকে এসকিউএল ফাইলে ডাউনলোড করুন"
              className={backupStatus === "idle" ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100" : ""}
            >
              {backupStatus === "success" ? (
                <>
                  <span>✅</span>
                  <span className="bn-text hidden sm:inline">ব্যাকআপ সম্পন্ন</span>
                </>
              ) : backupStatus === "error" ? (
                <>
                  <span>❌</span>
                  <span className="bn-text hidden sm:inline">ব্যর্থ হয়েছে</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span className="bn-text">ব্যাকআপ ডাউনলোড</span>
                </>
              )}
            </Button>

            {/* Cashier / Owner Mode Toggle Button */}
            <button
              type="button"
              onClick={handleRoleToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-xs cursor-pointer ${
                isOwner
                  ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 ring-2 ring-amber-400/40"
                  : "bg-frost-surface text-frost-dark border-frost-border hover:bg-frost-hover"
              }`}
              title={
                isOwner
                  ? "মালিক মোড সক্রিয়: কেনা দাম ও মোট লাভ দৃশ্যমান। ক্লিক করলে ক্যাশিয়ার মোডে লক হবে।"
                  : "ক্যাশিয়ার মোড: কেনা দাম ও লাভ লুকানো। ৪ ডিজিটের পিন দিয়ে আনলক করুন।"
              }
            >
              <span>{isOwner ? "👑" : "🔒"}</span>
              <span className="bn-text font-bold">
                {isOwner ? "মালিক মোড (Admin)" : "ক্যাশিয়ার মোড"}
              </span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex gap-1 py-1.5 overflow-x-auto no-scrollbar">
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-frost-dark text-white shadow-xs"
                    : "text-frost-muted hover:bg-frost-hover hover:text-frost-dark"
                }`}
              >
                <span>{tab.icon}</span>
                <span className="bn-text font-medium">{tab.bn}</span>
                <span
                  className={`text-[11px] font-normal ${
                    isActive ? "text-gray-300" : "text-frost-muted/70"
                  }`}
                >
                  ({tab.en})
                </span>
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
