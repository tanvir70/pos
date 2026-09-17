import { useState, useRef, useEffect } from "react"
import Navbar from "./components/Navbar"
import PosCounter from "./pages/PosCounter"
import Dashboard from "./pages/Dashboard"
import Inventory from "./pages/Inventory"
import Customers from "./pages/Customers"
import Returns from "./pages/Returns"
import type { NavigationTab } from "./types"

// BUSINESS DECISION: Default 4-digit Owner PIN is '1234'. Entering this PIN unlocks
// Owner Mode across the entire application shell, revealing purchase costs (কেনা দাম) and daily gross profits.
// Cashier counter staff operate in Cashier Mode to prevent wholesale cost leakage during bargaining.

const OWNER_PIN_DEFAULT = "1234"

export default function App() {
  const [tab, setTab] = useState<NavigationTab>("pos")
  const [isOwner, setIsOwner] = useState<boolean>(false)
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false)
  const [pinInput, setPinInput] = useState<string>("")
  const [pinError, setPinError] = useState<string | null>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isPinModalOpen) {
      setPinInput("")
      setPinError(null)
      setTimeout(() => pinInputRef.current?.focus(), 50)
    }
  }, [isPinModalOpen])

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput.trim() === OWNER_PIN_DEFAULT) {
      setIsOwner(true)
      setIsPinModalOpen(false)
      setPinInput("")
      setPinError(null)
    } else {
      setPinError("ভুল পিন কোড! সঠিক ৪ ডিজিটের পিন দিন (ডিফল্ট: 1234)")
      setPinInput("")
      pinInputRef.current?.focus()
    }
  }

  return (
    <div className="min-h-screen bg-frost-bg">
      <Navbar
        activeTab={tab}
        onTabChange={setTab}
        isOwner={isOwner}
        onToggleOwner={setIsOwner}
      />

      {/* Main Content Shell */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5">
        {tab === "pos" && <PosCounter isOwner={isOwner} />}
        {tab === "dashboard" && (
          <Dashboard
            isOwner={isOwner}
            onOpenPinModal={() => setIsPinModalOpen(true)}
            onNavigate={setTab}
          />
        )}
        {tab === "inventory" && <Inventory isOwner={isOwner} />}
        {tab === "customers" && <Customers isOwner={isOwner} />}
        {tab === "returns" && <Returns isOwner={isOwner} />}
      </main>

      {/* Owner PIN Unlock Modal (Triggered by Dashboard or child components) */}
      {isPinModalOpen && (
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
                onClick={() => setIsPinModalOpen(false)}
                className="text-frost-muted hover:text-frost-dark text-lg leading-none cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-frost-muted bn-text mt-2.5">
              কেনা দাম (Purchase Cost) এবং গ্রস প্রফিট দেখতে মালিকের ৪ ডিজিটের পিন নম্বর লিখুন।
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
                  onClick={() => setIsPinModalOpen(false)}
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
    </div>
  )
}
