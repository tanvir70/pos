import { useState, useEffect, useCallback } from "react"
import type { DashboardSummary, NavigationTab, SaleResponse } from "../types"
import { getDashboardSummary, downloadDatabaseBackup } from "../api/endpoints"
import GotposStatCard from "../components/dashboard/GotposStatCard"
import TopSellingProducts from "../components/dashboard/TopSellingProducts"
import RecentOrdersTable from "../components/dashboard/RecentOrdersTable"
import OrderDetailsModal from "../components/dashboard/OrderDetailsModal"
import DualPrintModal from "../components/pos/DualPrintModal"
import Badge from "../components/ui/Badge"
import Button from "../components/ui/Button"
import RefreshButton from "../components/ui/RefreshButton"
import {
  BarChart3,
  Loader2,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-700" />
            <span>Executive Business Dashboard</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time daily sales performance, gross profit, inventory valuation, and customer receivables
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <RefreshButton
            onClick={loadDashboard}
            isLoading={isLoading}
            title="Refresh dashboard metrics"
          />

          {/* Quick Backup */}
          <Button
            type="button"
            variant={backupStatus === "error" ? "danger" : "primary"}
            size="sm"
            onClick={handleBackup}
            disabled={isBackupLoading}
            leftIcon={
              isBackupLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : backupStatus === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : backupStatus === "error" ? (
                <XCircle className="w-3.5 h-3.5" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )
            }
            className="text-xs font-semibold cursor-pointer"
            title="Download a database backup file in one click"
          >
            {isBackupLoading
              ? "Backing up..."
              : backupStatus === "success"
              ? "Backup complete"
              : backupStatus === "error"
              ? "Backup failed"
              : "Database Backup"}
          </Button>
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
        {/* Left: Recent Orders (Expanded to 8 cols on lg / 9 cols on 2xl to eliminate horizontal scroll) */}
        <div className="lg:col-span-8 2xl:col-span-9">
          <RecentOrdersTable
            onViewDetails={(sale) => setSelectedSaleForDetails(sale)}
            onPrintReceipt={(sale) => setSelectedSaleForPrint(sale)}
            onNavigateToPos={() => onNavigate?.("pos")}
          />
        </div>

        {/* Right: Top Selling Products (Compact 4 cols on lg / 3 cols on 2xl) */}
        <div className="lg:col-span-4 2xl:col-span-3">
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
