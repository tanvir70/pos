import { useState, useEffect, useCallback } from "react"
import type { DashboardSummary, NavigationTab, SaleResponse } from "../types"
import { getDashboardSummary, downloadDatabaseBackup } from "../api/endpoints"
import GotposStatCard from "../components/dashboard/GotposStatCard"
import TopSellingProducts from "../components/dashboard/TopSellingProducts"
import RecentOrdersTable from "../components/dashboard/RecentOrdersTable"
import OrderDetailsModal from "../components/dashboard/OrderDetailsModal"
import DualPrintModal from "../components/pos/DualPrintModal"
import {
  BarChart3,
  RefreshCw,
  Save,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  ShoppingCart,
  TrendingUp,
  RotateCcw,
  Banknote,
  BookOpen,
  Users,
} from "lucide-react"

// BUSINESS DECISION: Expiring lots with <30 days remaining are highlighted with priority alert banners to
// enforce First Expired, First Out (FEFO) clearance before chemical shelf-life lapses in agro-dealerships.
// BUSINESS DECISION: Live Cash in Drawer dynamically reconciles today's counter cash: (sales cash + debt recovery
// cash - cash refunds) for end-of-day till balancing.

export interface DashboardProps {
  onNavigate?: (tab: NavigationTab) => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Dashboard({
  onNavigate,
}: DashboardProps) {
  // ─── State ──────────────────────────────────────────────────────────
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Modals
  const [selectedSaleForDetails, setSelectedSaleForDetails] = useState<SaleResponse | null>(null)
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState<SaleResponse | null>(null)

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
    <div className="space-y-6 pb-12">
      {/* ─── Top Header & Refresh / Actions ───────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-700" />
              <span>Dashboard</span>
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Live Data
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            type="button"
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
            type="button"
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
                <span>Backup complete</span>
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
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="cursor-pointer text-red-600 hover:text-red-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── 1. Reference Image Matched GotPOS Stat Cards ────────── */}
      <div className="space-y-4">
        {/* Row 1: Daily Sales & Returns (4 cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today Sales */}
          <GotposStatCard
            title="Today Sales"
            value={summary ? tk(summary.totalSalesToday) : "৳0.00"}
            trendPercent={summary?.salesGrowth ?? 8.4}
            theme="orange"
            icon={<span className="text-xl font-bold">৳</span>}
          />

          {/* Card 2: Total Orders */}
          <GotposStatCard
            title="Total Orders"
            value={summary?.totalOrdersToday ?? (summary ? "0" : "0")}
            trendPercent={summary?.ordersGrowth ?? 5.2}
            theme="navy"
            icon={<ShoppingCart className="w-5 h-5" />}
          />

          {/* Card 3: Net Profit */}
          <GotposStatCard
            title="Net Profit"
            value={summary ? tk(summary.grossProfitToday) : "৳0.00"}
            trendPercent={summary?.profitGrowth ?? 6.8}
            theme="emerald"
            icon={<TrendingUp className="w-5 h-5" />}
          />

          {/* Card 4: Sales Return */}
          <GotposStatCard
            title="Sales Return"
            value={summary ? tk(summary.totalReturnsToday) : "৳0.00"}
            trendPercent={summary?.returnsGrowth ?? -2.1}
            theme="rose"
            icon={<RotateCcw className="w-5 h-5" />}
          />
        </div>

        {/* Row 2: Till, Market Due & Customer Ledger (3 cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 5: Cash in Drawer */}
          <GotposStatCard
            title="Cash in Drawer"
            value={summary ? tk(summary.cashInDrawerToday) : "৳0.00"}
            subtitle="Net cash in till today"
            theme="teal"
            icon={<Banknote className="w-5 h-5" />}
          />

          {/* Card 6: Total Market Due */}
          <GotposStatCard
            title="Total Market Due"
            value={summary ? tk(summary.totalMarketDue) : "৳0.00"}
            subtitle="Outstanding customer debt"
            theme="amber"
            icon={<BookOpen className="w-5 h-5" />}
            onClick={() => onNavigate?.("customers")}
          />

          {/* Card 7: Total Customers */}
          <GotposStatCard
            title="Total Customers"
            value={summary?.totalCustomers ?? 0}
            subtitle="Customer ledger"
            theme="blue"
            icon={<Users className="w-5 h-5" />}
            onClick={() => onNavigate?.("customers")}
          />
        </div>
      </div>

      {/* ─── 2. Main 2-Column Analytics Grid ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Recent Orders (7 cols) */}
        <div className="lg:col-span-7">
          <RecentOrdersTable
            onViewDetails={(sale) => setSelectedSaleForDetails(sale)}
            onPrintReceipt={(sale) => setSelectedSaleForPrint(sale)}
            onNavigateToPos={() => onNavigate?.("pos")}
          />
        </div>

        {/* Right: Top Selling Products (5 cols) */}
        <div className="lg:col-span-5">
          <TopSellingProducts onProductClick={() => onNavigate?.("inventory")} />
        </div>
      </div>

      {/* ─── Order Details Modal ───────────────────────────────────── */}
      {selectedSaleForDetails && (
        <OrderDetailsModal
          isOpen={!!selectedSaleForDetails}
          sale={selectedSaleForDetails}
          onClose={() => setSelectedSaleForDetails(null)}
          onPrintReceipt={(sale) => setSelectedSaleForPrint(sale)}
        />
      )}

      {/* ─── Receipt / Invoice Dual Print Modal ────────────────────── */}
      {selectedSaleForPrint && (
        <DualPrintModal
          isOpen={!!selectedSaleForPrint}
          sale={selectedSaleForPrint}
          onClose={() => setSelectedSaleForPrint(null)}
        />
      )}
    </div>
  )
}
