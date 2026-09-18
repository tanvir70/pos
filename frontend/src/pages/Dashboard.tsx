import { useState, useEffect, useCallback } from "react"
import type { DashboardSummary, NavigationTab } from "../types"
import { getDashboardSummary, downloadDatabaseBackup } from "../api/endpoints"
import { StatCard } from "../components/ui/StatCard"
import {
  BarChart3,
  RefreshCw,
  Save,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  ShoppingCart,
  Calendar,
  Banknote,
  BookOpen,
  Crown,
  Check,
  Lock,
  Users,
  Package,
  Hourglass,
  ArrowRight,
} from "lucide-react"

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
      setErrorMessage(err?.message || "Failed to load dashboard data.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
    // Re-fetch when Owner Mode toggles: this endpoint is Owner-only server-side.
  }, [loadDashboard, isOwner])

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
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              <span>Analytics Dashboard</span>
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Live Data
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Daily and monthly sales, cash drawer status, outstanding dues, and expiry alerts
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={loadDashboard}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 shadow-xs transition-all cursor-pointer"
            title="Refresh latest data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Loading..." : "Refresh"}</span>
          </button>

          {/* Quick Backup */}
          <button
            onClick={handleBackup}
            disabled={isBackupLoading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer ${
              backupStatus === "success"
                ? "bg-emerald-600 text-white"
                : backupStatus === "error"
                ? "bg-red-600 text-white"
                : "bg-emerald-700 hover:bg-emerald-800 text-white"
            }`}
            title="Download a database backup file in one click"
          >
            {isBackupLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Backing up...</span>
              </>
            ) : backupStatus === "success" ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Backup download complete</span>
              </>
            ) : backupStatus === "error" ? (
              <>
                <XCircle className="w-4 h-4" />
                <span>Backup failed</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Database Backup</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="cursor-pointer text-red-600 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── Metric Cards Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={summary ? tk(summary.totalSalesToday) : "৳0.00"}
          subtitle="Total invoice value from cash and credit sales today"
          icon={<ShoppingCart className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="Monthly Sales"
          value={summary ? tk(summary.totalSalesMonth) : "৳0.00"}
          subtitle="Total sales from the 1st of the month to date"
          icon={<Calendar className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Cash in Drawer"
          value={summary ? tk(summary.cashInDrawerToday) : "৳0.00"}
          subtitle="Counter drawer cash (sales + debt recovery - refunds)"
          icon={<Banknote className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="Total Market Due"
          value={summary ? tk(summary.totalMarketDue) : "৳0.00"}
          subtitle="Outstanding dues from farmers and sub-dealers"
          icon={<BookOpen className="w-5 h-5" />}
          color="red"
        />
      </div>

      {/* ─── Row 2: Gross Profit (Protected) & Overview Badges ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Gross Profit Card (Owner Protected) - 7 cols */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-600" />
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                Gross Profit Margins
              </h2>
            </div>
            {isOwner ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Owner Mode Active
                <Check className="w-3 h-3" />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-300">
                <Lock className="w-3 h-3" />
                Protected in Cashier Mode
              </span>
            )}
          </div>

          <div className="py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard
                title="Today's Profit"
                value={summary ? tk(summary.grossProfitToday) : "৳0.00"}
                subtitle="Sales value minus purchase cost"
                icon={<Banknote className="w-5 h-5" />}
                color="emerald"
                isMasked={!isOwner}
                onUnlockClick={onOpenPinModal}
              />
              <StatCard
                title="Month's Profit"
                value={summary ? tk(summary.grossProfitMonth) : "৳0.00"}
                subtitle="Total net margin earned this month"
                icon={<BarChart3 className="w-5 h-5" />}
                color="blue"
                isMasked={!isOwner}
                onUnlockClick={onOpenPinModal}
              />
            </div>
            {!isOwner && (
              <p className="text-xs text-slate-500 mt-3 text-center">
                Net business profit is hidden from cashiers. Click a card and enter the owner's 4-digit PIN to view.
              </p>
            )}
          </div>

          <div className="text-[11px] text-slate-500 border-t border-slate-200/60 pt-2">
            * Profit is calculated based on the frozen unit cost (Freeze Unit Cost) of each invoice item.
          </div>
        </div>

        {/* Overview Stats (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">
              Store Summary
            </h2>
            <span className="text-xs text-slate-500">Agro Dealership</span>
          </div>

          <div className="space-y-3">
            {/* Total Customers */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/40 border border-slate-200">
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-xs font-bold text-slate-900">Total Customers</p>
                  <p className="text-[11px] text-slate-500">Retail farmers and wholesale dealers</p>
                </div>
              </div>
              <span className="text-lg font-bold tabular-nums text-slate-900">
                {summary?.totalCustomers ?? 0}
              </span>
            </div>

            {/* Low Stock Alert Count */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/40 border border-amber-200">
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4 text-amber-700" />
                <div>
                  <p className="text-xs font-bold text-amber-900">Low Stock Products</p>
                  <p className="text-[11px] text-amber-800/80">Products below alert threshold</p>
                </div>
              </div>
              <span className="text-lg font-bold tabular-nums text-amber-800">
                {summary?.lowStockCount ?? 0}
              </span>
            </div>

            {/* Expiring Soon Count */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-red-50/40 border border-red-200">
              <div className="flex items-center gap-2.5">
                <Hourglass className="w-4 h-4 text-red-700" />
                <div>
                  <p className="text-xs font-bold text-red-900">Expiring Lots (&lt;30 days)</p>
                  <p className="text-[11px] text-red-800/80">Urgent sale or return required</p>
                </div>
              </div>
              <span className="text-lg font-bold tabular-nums text-red-700">
                {summary?.expiringSoonCount ?? 0}
              </span>
            </div>
          </div>

          {/* Quick Link to Customers */}
          {onNavigate && (
            <button
              onClick={() => onNavigate("customers")}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-center text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer border border-emerald-200"
            >
              <span>View Ledger and Customer List</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Quick Actions Toolbar ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate?.("pos")}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>New Sale (POS)</span>
          </button>

          <button
            onClick={() => onNavigate?.("inventory")}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
          >
            <Package className="w-4 h-4" />
            <span>Inventory</span>
          </button>

          <button
            onClick={() => onNavigate?.("customers")}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>Ledger</span>
          </button>

          <button
            onClick={() => onNavigate?.("returns")}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Returns</span>
          </button>
        </div>
      </div>

      {/* ─── Alert Section 1: Expiring Soon Lots (<30 Days) ────────── */}
      <div className="bg-white border border-red-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-red-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <h2 className="font-bold text-red-800 text-base">
                Lots at Risk of Expiring (&lt; 30 days)
              </h2>
              <p className="text-xs text-red-600/80">
                Per FEFO priority, these lots must be sold at the counter or returned quickly
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            {summary?.expiringLots?.length ?? 0} lots at risk
          </span>
        </div>

        {summary?.expiringLots && summary.expiringLots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-red-50/50 text-red-900 border-b border-red-100 font-bold">
                <tr>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">Lot Number</th>
                  <th className="px-3 py-2.5">Expiry Date</th>
                  <th className="px-3 py-2.5 text-center">Days Left</th>
                  <th className="px-3 py-2.5 text-right">Current Stock</th>
                  <th className="px-3 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {summary.expiringLots.map((lot) => {
                  const isCritical = lot.daysUntilExpiry <= 15
                  return (
                    <tr key={lot.lotId} className="hover:bg-red-50/30">
                      <td className="px-3 py-2.5 font-bold text-slate-900">
                        {lot.productNameEn || lot.productNameBn}
                        <span className="block text-[11px] font-mono text-slate-500">
                          {lot.productCode}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-900">
                        {lot.lotNumber}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-900">
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
                          {lot.daysUntilExpiry} days left
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900">
                        {lot.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => onNavigate?.("pos")}
                          className="px-2.5 py-1 rounded text-[11px] font-bold bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 cursor-pointer"
                        >
                          Move to Counter
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>No lots are expiring within 30 days. All stock is safe.</span>
          </div>
        )}
      </div>

      {/* ─── Alert Section 2: Low Stock Products ───────────────────── */}
      <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-amber-100">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-700" />
            <div>
              <h2 className="font-bold text-amber-900 text-base">
                Low Stock Alert
              </h2>
              <p className="text-xs text-amber-800/80">
                Chemicals and products below the minimum stock threshold
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            {summary?.lowStockProducts?.length ?? 0} products low
          </span>
        </div>

        {summary?.lowStockProducts && summary.lowStockProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-50/50 text-amber-900 border-b border-amber-100 font-bold">
                <tr>
                  <th className="px-3 py-2.5">Product Code</th>
                  <th className="px-3 py-2.5">Product Name</th>
                  <th className="px-3 py-2.5 text-right">Minimum Threshold</th>
                  <th className="px-3 py-2.5 text-right">Current Total Stock</th>
                  <th className="px-3 py-2.5 text-center">Shortage</th>
                  <th className="px-3 py-2.5 text-center">Reorder Suggestion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {summary.lowStockProducts.map((p) => {
                  const shortage = p.minStockAlert - p.totalStock
                  return (
                    <tr key={p.productId} className="hover:bg-amber-50/30">
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-900">
                        {p.productCode}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-900">
                        {p.nameEn}
                        <span className="block text-[11px] font-normal text-slate-500">
                          {p.nameBn}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-900 font-medium">
                        {p.minStockAlert}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-red-600">
                        {p.totalStock}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                          {shortage > 0 ? `-${shortage}` : "0"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => onNavigate?.("inventory")}
                          className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-pointer"
                        >
                          Create Purchase Order
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>All products have adequate stock. No shortages.</span>
          </div>
        )}
      </div>
    </div>
  )
}
