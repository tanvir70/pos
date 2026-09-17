import { useState, useEffect, useCallback } from "react"
import type { DashboardSummary, NavigationTab } from "../types"
import { getDashboardSummary, downloadDatabaseBackup } from "../api/endpoints"

// BUSINESS DECISION: Daily Gross Profit and Monthly Profit metrics are strictly masked unless Owner Mode is
// active (unlocked via 4-digit PIN) to prevent counter assistants from viewing wholesale dealer margins during sales.
// BUSINESS DECISION: Expiring lots with <30 days remaining are highlighted with priority alert banners to
// enforce First Expired, First Out (FEFO) clearance before chemical shelf-life lapses in agro-dealerships.
// BUSINESS DECISION: Live Cash in Drawer dynamically reconciles today's counter cash: (sales cash + debt recovery
// cash - cash refunds) for end-of-day till balancing.

export interface DashboardProps {
  isOwner: boolean
  onOpenPinModal: () => void
  onNavigate?: (tab: NavigationTab) => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Dashboard({
  isOwner,
  onOpenPinModal,
  onNavigate,
}: DashboardProps) {
  // ─── State ──────────────────────────────────────────────────────────
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Backup State
  const [isBackupLoading, setIsBackupLoading] = useState<boolean>(false)
  const [backupStatus, setBackupStatus] = useState<"idle" | "success" | "error">("idle")

  // ─── Data Fetching ──────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const data = await getDashboardSummary()
      setSummary(data)
    } catch (err: any) {
      setErrorMessage(err?.message || "ড্যাশবোর্ড তথ্য লোড করতে সমস্যা হয়েছে।")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // ─── Database Backup Action ─────────────────────────────────────────
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

  return (
    <div className="space-y-6">
      {/* Top Header & Refresh / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-frost-dark bn-text flex items-center gap-2">
              <span>📊</span>
              <span>ব্যবসা বিশ্লেষণ ও ড্যাশবোর্ড (Analytics Dashboard)</span>
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 bn-text border border-emerald-200">
              লাইভ ডেটা
            </span>
          </div>
          <p className="text-xs sm:text-sm text-frost-muted bn-text mt-0.5">
            দৈনিক ও মাসিক বিক্রয়, ক্যাশ ড্রয়ার স্থিতি, বাকির খাতা ও মেয়াদোত্তীর্ণ সতর্কবার্তা
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={loadDashboard}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-frost-surface border border-frost-border text-frost-dark shadow-xs transition-all cursor-pointer bn-text"
            title="সর্বশেষ ডেটা রিফ্রেশ করুন"
          >
            <span className={isLoading ? "animate-spin" : ""}>🔄</span>
            <span>{isLoading ? "লোড হচ্ছে..." : "রিফ্রেশ"}</span>
          </button>

          {/* Quick Backup */}
          <button
            onClick={handleBackup}
            disabled={isBackupLoading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer bn-text ${
              backupStatus === "success"
                ? "bg-emerald-600 text-white"
                : backupStatus === "error"
                ? "bg-red-600 text-white"
                : "bg-emerald-700 hover:bg-emerald-800 text-white"
            }`}
            title="১-ক্লিকে ডেটাবেজের ব্যাকআপ ফাইল ডাউনলোড করুন"
          >
            {isBackupLoading ? (
              <>
                <span className="animate-spin text-xs">⏳</span>
                <span>ব্যাকআপ হচ্ছে...</span>
              </>
            ) : backupStatus === "success" ? (
              <>
                <span>✅</span>
                <span>ব্যাকআপ ডাউনলোড সম্পন্ন</span>
              </>
            ) : backupStatus === "error" ? (
              <>
                <span>❌</span>
                <span>ব্যর্থ হয়েছে</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>ডাটাবেজ ব্যাকআপ</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs sm:text-sm font-semibold bn-text flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="cursor-pointer text-red-600 hover:text-red-900">✕</button>
        </div>
      )}

      {/* ─── Metric Cards Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Today's Sales */}
        <div className="bg-white border border-frost-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-frost-muted uppercase tracking-wider bn-text">
              আজকের বিক্রয় (Today)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-base">
              🛒
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold text-frost-dark tabular-nums">
              {summary ? tk(summary.totalSalesToday) : "৳০.০০"}
            </p>
            <p className="text-[11px] text-frost-muted bn-text mt-1">
              আজকের ক্যাশ ও বাকির মোট ইনভয়েস মূল্য
            </p>
          </div>
        </div>

        {/* 2. Month's Sales */}
        <div className="bg-white border border-frost-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-frost-muted uppercase tracking-wider bn-text">
              চলতি মাসের বিক্রয় (Month)
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center text-base">
              📅
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold text-frost-dark tabular-nums">
              {summary ? tk(summary.totalSalesMonth) : "৳০.০০"}
            </p>
            <p className="text-[11px] text-frost-muted bn-text mt-1">
              ১ম তারিখ হতে আজ পর্যন্ত মোট বিক্রয়
            </p>
          </div>
        </div>

        {/* 3. Live Cash in Drawer */}
        <div className="bg-white border border-emerald-300 rounded-2xl p-5 shadow-xs bg-emerald-50/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider bn-text">
              ক্যাশ ড্রয়ারে বর্তমান নগদ
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-base">
              💵
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums">
              {summary ? tk(summary.cashInDrawerToday) : "৳০.০০"}
            </p>
            <p className="text-[11px] text-emerald-800/80 bn-text mt-1">
              কাউন্টার ড্রয়ারের নগদ (বিক্রয় + বাকি আদায় - ফেরত)
            </p>
          </div>
        </div>

        {/* 4. Total Market Due */}
        <div className="bg-white border border-red-200 rounded-2xl p-5 shadow-xs bg-red-50/25 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-700 uppercase tracking-wider bn-text">
              বাজারে মোট বাকি (Market Due)
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center text-base">
              📒
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold text-red-600 tabular-nums">
              {summary ? tk(summary.totalMarketDue) : "৳০.০০"}
            </p>
            <p className="text-[11px] text-red-600/80 bn-text mt-1">
              কৃষক ও সাব-ডিলারদের কাছে অবশিষ্ট পাওনা
            </p>
          </div>
        </div>
      </div>

      {/* ─── Row 2: Gross Profit (Protected) & Overview Badges ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Gross Profit Card (Owner Protected) - 7 cols */}
        <div className="lg:col-span-7 bg-white border border-frost-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-frost-border">
            <div className="flex items-center gap-2">
              <span className="text-lg">👑</span>
              <h2 className="font-bold text-frost-dark bn-text text-sm sm:text-base">
                মোট গ্রস প্রফিট (Gross Profit Margins)
              </h2>
            </div>
            {isOwner ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 bn-text">
                মালিক মোড সক্রিয় ✓
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-300 bn-text">
                🔒 ক্যাশিয়ার মোডে সুরক্ষিত
              </span>
            )}
          </div>

          <div className="py-4">
            {isOwner ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4">
                  <span className="text-xs font-bold text-emerald-800 bn-text">
                    আজকের গ্রস লাভ (Today's Profit)
                  </span>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums mt-1">
                    {summary ? tk(summary.grossProfitToday) : "৳০.০০"}
                  </p>
                  <p className="text-[11px] text-emerald-800/80 bn-text mt-1">
                    বিক্রয় মূল্য থেকে কেনা খরচ বাদ
                  </p>
                </div>

                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4">
                  <span className="text-xs font-bold text-blue-800 bn-text">
                    চলতি মাসের মোট লাভ (Month's Profit)
                  </span>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-700 tabular-nums mt-1">
                    {summary ? tk(summary.grossProfitMonth) : "৳০.০০"}
                  </p>
                  <p className="text-[11px] text-blue-800/80 bn-text mt-1">
                    চলতি মাসের মোট অর্জিত নিট মার্জিন
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-frost-surface/60 border border-frost-border rounded-xl p-6 text-center">
                <div className="text-3xl mb-1">🔒</div>
                <h3 className="text-sm font-bold text-frost-dark bn-text">
                  গ্রস প্রফিট ও কেনা দাম লক করা
                </h3>
                <p className="text-xs text-frost-muted bn-text mt-1 max-w-sm mx-auto">
                  ক্যাশিয়ারদের সামনে ব্যবসার নিট লাভ গোপন রাখা হয়েছে। মালিকের ৪ ডিজিটের পিন দিয়ে দেখুন।
                </p>
                <button
                  onClick={onOpenPinModal}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition-all shadow-xs cursor-pointer bn-text"
                >
                  <span>🔑</span>
                  <span>মালিক পিন দিয়ে দেখুন (Unlock PIN)</span>
                </button>
              </div>
            )}
          </div>

          <div className="text-[11px] text-frost-muted bn-text border-t border-frost-border/60 pt-2">
            * ইনভয়েসের প্রতিটি আইটেমের ফ্রিজকৃত ক্রয় মূল্যের (Freeze Unit Cost) উপর ভিত্তি করে লাভ নির্ণীত হয়।
          </div>
        </div>

        {/* Overview Stats (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-frost-border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-frost-border">
            <h2 className="font-bold text-frost-dark bn-text text-sm sm:text-base">
              দ্রুত পরিসংখ্যান (Store Summary)
            </h2>
            <span className="text-xs text-frost-muted">সিনজেনটা ডিলারশিপ</span>
          </div>

          <div className="space-y-3">
            {/* Total Customers */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-frost-surface/40 border border-frost-border">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">👥</span>
                <div>
                  <p className="text-xs font-bold text-frost-dark bn-text">মোট গ্রাহক সংখ্যা</p>
                  <p className="text-[11px] text-frost-muted bn-text">খুচরা কৃষক ও পাইকারি ডিলার</p>
                </div>
              </div>
              <span className="text-lg font-bold tabular-nums text-frost-dark">
                {summary?.totalCustomers ?? 0} জন
              </span>
            </div>

            {/* Low Stock Alert Count */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/40 border border-amber-200">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">📦</span>
                <div>
                  <p className="text-xs font-bold text-amber-900 bn-text">স্টক ঘাটতি পণ্য</p>
                  <p className="text-[11px] text-amber-800/80 bn-text">সতর্কতার নিচে থাকা পণ্য</p>
                </div>
              </div>
              <span className="text-lg font-bold tabular-nums text-amber-800">
                {summary?.lowStockCount ?? 0} টি
              </span>
            </div>

            {/* Expiring Soon Count */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-red-50/40 border border-red-200">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">⏳</span>
                <div>
                  <p className="text-xs font-bold text-red-900 bn-text">মেয়াদ শেষ হবার লট (&lt;৩০ দিন)</p>
                  <p className="text-[11px] text-red-800/80 bn-text">জরুরি বিক্রয় বা ফেরত প্রয়োজন</p>
                </div>
              </div>
              <span className="text-lg font-bold tabular-nums text-red-700">
                {summary?.expiringSoonCount ?? 0} টি
              </span>
            </div>
          </div>

          {/* Quick Link to Customers */}
          {onNavigate && (
            <button
              onClick={() => onNavigate("customers")}
              className="w-full py-2 text-center text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer bn-text border border-emerald-200"
            >
              বাকি খাতা ও কাস্টমার তালিকা দেখুন →
            </button>
          )}
        </div>
      </div>

      {/* ─── Quick Actions Toolbar ─────────────────────────────────── */}
      <div className="bg-white border border-frost-border rounded-2xl p-4 shadow-xs">
        <h3 className="text-xs font-bold text-frost-muted uppercase tracking-wider bn-text mb-3">
          দ্রুত কার্যধারা (Quick Actions)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate?.("pos")}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer bn-text"
          >
            <span>🛒</span>
            <span>নতুন বিক্রয় (POS)</span>
          </button>

          <button
            onClick={() => onNavigate?.("inventory")}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer bn-text"
          >
            <span>📦</span>
            <span>ইনভেন্টরি (Inventory)</span>
          </button>

          <button
            onClick={() => onNavigate?.("customers")}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer bn-text"
          >
            <span>📒</span>
            <span>বাকি আদায় (Ledger)</span>
          </button>

          <button
            onClick={() => onNavigate?.("returns")}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer bn-text"
          >
            <span>🔄</span>
            <span>পণ্য ফেরত (Returns)</span>
          </button>
        </div>
      </div>

      {/* ─── Alert Section 1: Expiring Soon Lots (<30 Days) ────────── */}
      <div className="bg-white border border-red-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-red-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <div>
              <h2 className="font-bold text-red-800 bn-text text-base">
                মেয়াদোত্তীর্ণের ঝুঁকিতে থাকা লট (&lt; ৩০ দিন)
              </h2>
              <p className="text-xs text-red-600/80 bn-text">
                FEFO অগ্রাধিকার অনুযায়ী এই লটগুলো দ্রুত কাউন্টারে বিক্রয় বা ফেরত দেওয়া আবশ্যক
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 bn-text">
            {summary?.expiringLots?.length ?? 0} টি ঝুঁকিপূর্ণ লট
          </span>
        </div>

        {summary?.expiringLots && summary.expiringLots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-red-50/50 text-red-900 border-b border-red-100 font-bold bn-text">
                <tr>
                  <th className="px-3 py-2.5">পণ্য</th>
                  <th className="px-3 py-2.5">লট নম্বর</th>
                  <th className="px-3 py-2.5">মেয়াদ শেষের তারিখ</th>
                  <th className="px-3 py-2.5 text-center">বাকি দিন</th>
                  <th className="px-3 py-2.5 text-right">বর্তমান মজুদ</th>
                  <th className="px-3 py-2.5 text-center">করণীয়</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {summary.expiringLots.map((lot) => {
                  const isCritical = lot.daysUntilExpiry <= 15
                  return (
                    <tr key={lot.lotId} className="hover:bg-red-50/30">
                      <td className="px-3 py-2.5 font-bold text-frost-dark bn-text">
                        {lot.productNameBn || lot.productNameEn}
                        <span className="block text-[11px] font-mono text-frost-muted">
                          {lot.productCode}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-frost-dark">
                        {lot.lotNumber}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-frost-dark">
                        {lot.expiryDate}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold tabular-nums ${
                            isCritical
                              ? "bg-red-600 text-white animate-pulse"
                              : "bg-amber-100 text-amber-800 border border-amber-300"
                          }`}
                        >
                          {lot.daysUntilExpiry} দিন বাকি
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-frost-dark">
                        {lot.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => onNavigate?.("pos")}
                          className="px-2.5 py-1 rounded text-[11px] font-bold bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 cursor-pointer bn-text"
                        >
                          কাউন্টারে তুলুন
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold bn-text flex items-center gap-2">
            <span>✅</span>
            <span>কোনো লটের মেয়াদ ৩০ দিনের মধ্যে শেষ হচ্ছে না। সব স্টক নিরাপদ।</span>
          </div>
        )}
      </div>

      {/* ─── Alert Section 2: Low Stock Products ───────────────────── */}
      <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-amber-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">📦</span>
            <div>
              <h2 className="font-bold text-amber-900 bn-text text-base">
                স্টক ঘাটতি সতর্কতা (Low Stock Alert)
              </h2>
              <p className="text-xs text-amber-800/80 bn-text">
                ন্যূনতম নির্ধারিত সীমার নিচে থাকা রাসায়নিক ও পণ্যসমূহ
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 bn-text">
            {summary?.lowStockProducts?.length ?? 0} টি পণ্য ঘাটতিতে
          </span>
        </div>

        {summary?.lowStockProducts && summary.lowStockProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-50/50 text-amber-900 border-b border-amber-100 font-bold bn-text">
                <tr>
                  <th className="px-3 py-2.5">পণ্য কোড</th>
                  <th className="px-3 py-2.5">পণ্যের নাম</th>
                  <th className="px-3 py-2.5 text-right">ন্যূনতম সীমা</th>
                  <th className="px-3 py-2.5 text-right">বর্তমান মোট মজুদ</th>
                  <th className="px-3 py-2.5 text-center">ঘাটতি</th>
                  <th className="px-3 py-2.5 text-center">পুনর্বিন্যাস পরামর্শ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {summary.lowStockProducts.map((p) => {
                  const shortage = p.minStockAlert - p.totalStock
                  return (
                    <tr key={p.productId} className="hover:bg-amber-50/30">
                      <td className="px-3 py-2.5 font-mono font-semibold text-frost-dark">
                        {p.productCode}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-frost-dark bn-text">
                        {p.nameBn}
                        <span className="block text-[11px] font-normal text-frost-muted">
                          {p.nameEn}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-frost-dark font-medium">
                        {p.minStockAlert}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-red-600">
                        {p.totalStock}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                          {shortage > 0 ? `-${shortage}` : "০"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => onNavigate?.("inventory")}
                          className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-pointer bn-text"
                        >
                          নতুন চালান তুলুন
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold bn-text flex items-center gap-2">
            <span>✅</span>
            <span>সকল পণ্যের মজুদ পর্যাপ্ত রয়েছে। কোনো ঘাটতি নেই।</span>
          </div>
        )}
      </div>
    </div>
  )
}
