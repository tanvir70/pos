import { useState, useRef, useEffect } from "react"
import type { NavigationTab } from "../types"
import { downloadDatabaseBackup } from "../api/endpoints"

// BUSINESS DECISION: Default 4-digit Owner PIN is "1234". Entering this PIN unlocks
// Owner Mode, revealing purchase costs (কেনা দাম) and daily gross profits on counter terminals.
// Cashier counter staff operate in Cashier Mode to prevent wholesale cost leakage during bargaining.
const OWNER_PIN_DEFAULT = "1234"

export interface NavbarProps {
  activeTab: NavigationTab
  onTabChange: (tab: NavigationTab) => void
  isOwner: boolean
  onToggleOwner: (isOwner: boolean) => void
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
  { id: "godown", bn: "গুদাম ও চালান", en: "Godown", icon: "🏭" },
  { id: "customers", bn: "বাকি খাতা", en: "Ledger", icon: "📒" },
  { id: "returns", bn: "পণ্য ফেরত", en: "Returns", icon: "🔄" },
]

export default function Navbar({
  activeTab,
  onTabChange,
  isOwner,
  onToggleOwner,
}: NavbarProps) {
  const [isBackupLoading, setIsBackupLoading] = useState(false)
  const [backupStatus, setBackupStatus] =
    useState<"idle" | "success" | "error">("idle")
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [pinError, setPinError] = useState<string | null>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showPinModal) {
      setPinInput("")
      setPinError(null)
      setTimeout(() => pinInputRef.current?.focus(), 50)
    }
  }, [showPinModal])

  const handleBackup = async () => {
    if (isBackupLoading) return
    try {
      setIsBackupLoading(true)
      setBackupStatus("idle")
      await downloadDatabaseBackup()
      setBackupStatus("success")
      setTimeout(() => setBackupStatus("idle"), 3000)
    } catch {
      setBackupStatus("error")
      setTimeout(() => setBackupStatus("idle"), 4000)
    } finally {
      setIsBackupLoading(false)
    }
  }

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput.trim() === OWNER_PIN_DEFAULT) {
      onToggleOwner(true)
      setShowPinModal(false)
      setPinInput("")
      setPinError(null)
    } else {
      setPinError("ভুল পিন কোড! সঠিক ৪ ডিজিটের পিন দিন (ডিফল্ট: 1234)")
      setPinInput("")
      pinInputRef.current?.focus()
    }
  }

  const handleRoleToggle = () => {
    if (isOwner) {
      // Lock back to Cashier Mode immediately
      onToggleOwner(false)
    } else {
      // Prompt for PIN to unlock Owner Mode
      setShowPinModal(true)
    }
  }

  return (
    <header className="bg-white border-b border-frost-border sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Top Brand & Actions Bar */}
        <div className="flex items-center justify-between h-14 border-b border-frost-border/40 gap-2">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
              🌾
            </div>
            <div className="truncate">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="font-bold text-frost-dark bn-text text-base sm:text-lg leading-tight tracking-tight">
                  আল-আমিন ট্রেডার্স
                </span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 bn-text border border-emerald-200">
                  সিনজেনটা ডিলার
                </span>
              </div>
              <p className="text-[11px] text-frost-muted hidden sm:block leading-none mt-0.5">
                Al-Amin Traders (Syngenta Authorized Dealership)
              </p>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 1-Click DB Backup Button */}
            <button
              onClick={handleBackup}
              disabled={isBackupLoading}
              title="সম্পূর্ণ ডেটাবেস ১-ক্লিকে এসকিউএল ফাইলে ডাউনলোড করুন"
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                backupStatus === "success"
                  ? "bg-emerald-600 text-white"
                  : backupStatus === "error"
                    ? "bg-red-600 text-white"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100"
              }`}
            >
              {isBackupLoading ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span className="bn-text hidden sm:inline">
                    ব্যাকআপ হচ্ছে...
                  </span>
                </>
              ) : backupStatus === "success" ? (
                <>
                  <span className="text-sm">✅</span>
                  <span className="bn-text hidden sm:inline">ব্যাকআপ সম্পন্ন</span>
                </>
              ) : backupStatus === "error" ? (
                <>
                  <span className="text-sm">❌</span>
                  <span className="bn-text hidden sm:inline">ব্যর্থ হয়েছে</span>
                </>
              ) : (
                <>
                  <span className="text-sm">💾</span>
                  <span className="bn-text">ব্যাকআপ ডাউনলোড</span>
                </>
              )}
            </button>

            {/* Cashier / Owner Mode Toggle Button */}
            <button
              onClick={handleRoleToggle}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-xs cursor-pointer ${
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

      {/* 4-Digit Owner PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-frost-border max-w-sm w-full p-5">
            <div className="flex items-center justify-between pb-3 border-b border-frost-border">
              <div className="flex items-center gap-2">
                <span className="text-xl">👑</span>
                <h3 className="font-bold text-frost-dark bn-text text-base">
                  মালিক মোড আনলক করুন
                </h3>
              </div>
              <button
                onClick={() => setShowPinModal(false)}
                className="text-frost-muted hover:text-frost-dark text-lg leading-none cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-frost-muted bn-text mt-2.5">
              কেনা দাম (Purchase Cost) এবং দৈনন্দিন গ্রস প্রফিট দেখতে মালিকের ৪
              ডিজিটের পিন নম্বর লিখুন।
            </p>

            <form onSubmit={handlePinSubmit} className="mt-4">
              <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                ৪ ডিজিটের পিন কোড:
              </label>
              <input
                ref={pinInputRef}
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value)
                  if (pinError) setPinError(null)
                }}
                placeholder="**** (ডিফল্ট: 1234)"
                className="w-full text-center tracking-[0.5em] text-xl font-bold py-2 px-3 border-2 border-frost-border rounded-lg focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />

              {pinError && (
                <p className="text-xs text-red-600 font-medium bn-text mt-2">
                  {pinError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-frost-muted hover:bg-frost-hover cursor-pointer bn-text"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer bn-text"
                >
                  আনলক করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}
