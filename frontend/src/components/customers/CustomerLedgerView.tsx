import React, { useState, useEffect, useMemo, useCallback } from "react"
import type { Customer, CustomerLedger, SaleResponse } from "../../types"
import { getCustomerLedger, getCustomerPurchases } from "../../api/endpoints"
import { Button } from "../ui/Button"
import Pagination from "../ui/Pagination"
import RefreshButton from "../ui/RefreshButton"
import DateRangeFilter, { type DateRange, defaultDateRange } from "../ui/DateRangeFilter"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmptyState,
  TableLoadingState,
} from "../ui/Table"
import {
  ArrowLeft,
  History,
  ShoppingCart,
  Receipt,
  RotateCcw,
  CheckCircle2,
  Printer,
  Search,
  X,
  Package,
  Phone,
  MapPin,
  TrendingDown,
  TrendingUp,
  FileText,
  User,
  Users,
  Sprout,
  AlertCircle,
  Edit2,
  ChevronRight,
} from "lucide-react"

const getInitials = (name?: string) => {
  if (!name) return "C"
  const clean = name.replace(/^(haji|md|mrs|mr|dr)\.?\s+/i, "").trim()
  const target = clean || name.trim()
  const parts = target.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export interface CustomerLedgerViewProps {
  customer: Customer
  customers: Customer[]
  onSelectCustomer: (customer: Customer) => void
  onBack: () => void
  onOpenEdit: (customer: Customer) => void
  onOpenRepay: (customer: Customer) => void
  onPrintInvoice: (sale: SaleResponse) => void
  onRefreshCustomers: () => void
}

type TabType = "ALL" | "INVOICES" | "PAYMENTS" | "PURCHASES"

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatDate = (isoString?: string | null) => {
  if (!isoString) return "—"
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return isoString
  }
}

export default function CustomerLedgerView({
  customer,
  customers,
  onSelectCustomer,
  onBack,
  onOpenEdit,
  onOpenRepay,
  onPrintInvoice,
  onRefreshCustomers,
}: CustomerLedgerViewProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<TabType>("ALL")

  // Data states
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedger[]>([])
  const [isLedgerLoading, setIsLedgerLoading] = useState<boolean>(true)
  const [purchases, setPurchases] = useState<SaleResponse[]>([])
  const [isPurchasesLoading, setIsPurchasesLoading] = useState<boolean>(true)

  // Filters & Pagination
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [page, setPage] = useState<number>(0)
  const [pageSize, setPageSize] = useState<number>(15)

  // Purchases list pagination
  const [purchasePage, setPurchasePage] = useState<number>(0)
  const [purchasePageSize, setPurchasePageSize] = useState<number>(8)

  // Fetch data
  const loadData = useCallback(async () => {
    if (!customer?.id) return
    setIsLedgerLoading(true)
    setIsPurchasesLoading(true)
    try {
      const [ledgerData, purchaseData] = await Promise.all([
        getCustomerLedger(customer.id),
        getCustomerPurchases(customer.id),
      ])
      setLedgerEntries(ledgerData)
      setPurchases(purchaseData)
    } catch (err) {
      console.error("Failed to load customer ledger details:", err)
    } finally {
      setIsLedgerLoading(false)
      setIsPurchasesLoading(false)
    }
  }, [customer?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Reset pagination when filter/search changes
  useEffect(() => {
    setPage(0)
    setPurchasePage(0)
  }, [dateRange, searchQuery, activeTab])

  // Filtered Ledger Entries
  const filteredLedger = useMemo(() => {
    let result = ledgerEntries

    // Date range filter
    if (dateRange.preset !== "ALL" || dateRange.startDate || dateRange.endDate) {
      result = result.filter((item) => {
        if (!item.transactionDate) return true
        const d = new Date(item.transactionDate).toISOString().slice(0, 10)
        if (dateRange.startDate && d < dateRange.startDate) return false
        if (dateRange.endDate && d > dateRange.endDate) return false
        return true
      })
    }

    // Category / Tab filter
    if (activeTab === "INVOICES") {
      result = result.filter((item) => item.transactionType === "INVOICE_BILL")
    } else if (activeTab === "PAYMENTS") {
      result = result.filter(
        (item) => item.transactionType === "CASH_PAYMENT" || item.transactionType === "RETURN_CREDIT"
      )
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((item) => {
        const typeMatch = item.transactionType?.toLowerCase().includes(q)
        const refMatch =
          item.moneyReceiptNo?.toLowerCase().includes(q) ||
          (item.saleId ? `inv-${item.saleId}`.includes(q) : false)
        const notesMatch = item.notes?.toLowerCase().includes(q)
        return typeMatch || refMatch || notesMatch
      })
    }

    return result
  }, [ledgerEntries, dateRange, activeTab, searchQuery])

  // Summary Metrics for the date range
  const periodDebit = useMemo(() => {
    return filteredLedger.reduce((sum, item) => sum + (Number(item.debit) || 0), 0)
  }, [filteredLedger])

  const periodCredit = useMemo(() => {
    return filteredLedger.reduce((sum, item) => sum + (Number(item.credit) || 0), 0)
  }, [filteredLedger])

  const paginatedLedger = useMemo(() => {
    const start = page * pageSize
    return filteredLedger.slice(start, start + pageSize)
  }, [filteredLedger, page, pageSize])

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    if (!searchQuery.trim()) return purchases
    const q = searchQuery.trim().toLowerCase()
    return purchases.filter((sale) => {
      const invoiceMatch = sale.invoiceNo?.toLowerCase().includes(q)
      const itemMatch = sale.items?.some(
        (it) =>
          it.productNameEn?.toLowerCase().includes(q) ||
          it.productNameBn?.toLowerCase().includes(q) ||
          it.lotNumber?.toLowerCase().includes(q)
      )
      return invoiceMatch || itemMatch
    })
  }, [purchases, searchQuery])

  const paginatedPurchases = useMemo(() => {
    const start = purchasePage * purchasePageSize
    return filteredPurchases.slice(start, start + purchasePageSize)
  }, [filteredPurchases, purchasePage, purchasePageSize])

  const due = Number(customer.currentDue) || 0
  const lifetimeBuy = Number(customer.totalPurchases) || 0

  const handleCustomerSwitch = (customerIdStr: string) => {
    const target = customers.find((c) => String(c.id) === customerIdStr)
    if (target) {
      onSelectCustomer(target)
    }
  }

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "INVOICE_BILL":
        return {
          label: "Sales Invoice",
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          icon: <ShoppingCart className="w-3 h-3 text-blue-600" />,
        }
      case "CASH_PAYMENT":
        return {
          label: "Due Repayment",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: <CheckCircle2 className="w-3 h-3 text-emerald-600" />,
        }
      case "RETURN_CREDIT":
        return {
          label: "Return Credit",
          bg: "bg-purple-50 text-purple-700 border-purple-200",
          icon: <RotateCcw className="w-3 h-3 text-purple-600" />,
        }
      default:
        return {
          label: type,
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          icon: <Receipt className="w-3 h-3 text-slate-500" />,
        }
    }
  }

  const hasActiveFilters =
    activeTab !== "ALL" ||
    searchQuery.trim() !== "" ||
    dateRange.preset !== "ALL" ||
    Boolean(dateRange.startDate) ||
    Boolean(dateRange.endDate)

  const handleResetFilters = () => {
    setActiveTab("ALL")
    setSearchQuery("")
    setDateRange(defaultDateRange)
    setPage(0)
    setPurchasePage(0)
  }

  return (
    <div className="space-y-4">
      {/* ─── Unified Customer Master Header Card ──────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Navigation Breadcrumb & Account Switcher Strip */}
        <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="Return to customer accounts directory (Esc)"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Customers</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate max-w-[200px] sm:max-w-none">{customer.name}</span>
            </span>
          </div>

          {/* Quick Account Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">Switch Account:</span>
            <div className="w-60 sm:w-72">
              <Select
                value={String(customer.id)}
                onValueChange={handleCustomerSwitch}
              >
                <SelectTrigger className="w-full h-8 text-xs bg-white border-slate-200/90 font-medium">
                  <SelectValue placeholder="Select Customer" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {customers.map((c) => {
                    const cDue = Number(c.currentDue) || 0
                    return (
                      <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="font-medium text-slate-800 truncate">{c.name}</span>
                          <span className="text-[11px] text-slate-400 shrink-0">({c.phone})</span>
                          {cDue > 0 && (
                            <span className="ml-auto text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded shrink-0">
                              Due: {tk(cDue)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Identity & Financial Hero Row */}
        <div className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Left: Avatar + Identity + Metadata */}
          <div className="flex items-start sm:items-center gap-3.5">
            {/* Initials Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-100 border border-indigo-100/90 flex items-center justify-center shrink-0 shadow-2xs">
              <span className="text-base font-bold text-indigo-700 tracking-tight">
                {getInitials(customer.name)}
              </span>
            </div>

            <div className="space-y-1">
              {/* Name & Type */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  {customer.name}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    customer.customerType === "WHOLESALE"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}
                >
                  {customer.customerType === "WHOLESALE" ? "Wholesale Dealer" : "Retail Farmer"}
                </span>
              </div>

              {/* Clean Metadata Strip */}
              <div className="flex items-center gap-2.5 flex-wrap text-xs text-slate-500">
                <a
                  href={`tel:${customer.phone}`}
                  className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-slate-900 tabular-nums transition-colors"
                  title="Click to call customer phone"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{customer.phone || "No phone"}</span>
                </a>

                {customer.landArea && (
                  <>
                    <span className="text-slate-300">•</span>
                    <div className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                      <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{customer.landArea} Farm</span>
                    </div>
                  </>
                )}

                {customer.villageAddress && (
                  <>
                    <span className="text-slate-300">•</span>
                    <div className="inline-flex items-center gap-1.5 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{customer.villageAddress}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Financial KPI Blocks & Action Toolbar */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            {/* KPI 1: Outstanding Due, Advance Balance, or Settled */}
            <div
              className={`px-3.5 py-2 rounded-xl border flex flex-col justify-center min-w-[130px] ${
                due > 0
                  ? "bg-rose-50/90 border-rose-200/90 text-rose-900"
                  : due < 0
                  ? "bg-blue-50/90 border-blue-200/90 text-blue-900"
                  : "bg-emerald-50/80 border-emerald-200/80 text-emerald-900"
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[10px] font-bold uppercase tracking-wider">
                <span
                  className={
                    due > 0
                      ? "text-rose-600"
                      : due < 0
                      ? "text-blue-700"
                      : "text-emerald-700"
                  }
                >
                  {due > 0
                    ? "Outstanding Due"
                    : due < 0
                    ? "Advance Deposit"
                    : "Ledger Status"}
                </span>
                {due > 0 ? (
                  <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                ) : due < 0 ? (
                  <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                )}
              </div>
              <div
                className={`text-base sm:text-lg font-black font-mono tracking-tight mt-0.5 ${
                  due > 0
                    ? "text-rose-700"
                    : due < 0
                    ? `+${tk(Math.abs(due))}`
                    : "Settled (৳0)"
                }`}
              >
                {due > 0
                  ? tk(due)
                  : due < 0
                  ? `+${tk(Math.abs(due))}`
                  : "Settled (৳0)"}
              </div>
            </div>

            {/* KPI 2: Lifetime Purchases */}
            <div className="px-3.5 py-2 rounded-xl border border-slate-200/90 bg-slate-50/90 flex flex-col justify-center min-w-[130px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Lifetime Buy
              </span>
              <div className="text-base sm:text-lg font-bold font-mono tracking-tight text-slate-900 mt-0.5">
                {tk(lifetimeBuy)}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {purchases.length} total orders
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 ml-auto sm:ml-0">
              {due > 0 ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onOpenRepay(customer)}
                  leftIcon={<Receipt className="w-3.5 h-3.5" />}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs cursor-pointer h-9 px-3.5 rounded-xl transition-all"
                  title="Collect outstanding customer due payment"
                >
                  Collect Due
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenRepay(customer)}
                  leftIcon={<Receipt className="w-3.5 h-3.5 text-slate-500" />}
                  className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 font-medium shadow-xs cursor-pointer h-9 px-3 rounded-xl transition-all"
                  title="Record advance payment or credit adjustment"
                >
                  Payment / Credit
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenEdit(customer)}
                leftIcon={<Edit2 className="w-3.5 h-3.5 text-slate-400" />}
                className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 font-semibold shadow-xs cursor-pointer h-9 px-3 rounded-xl transition-all"
                title="Edit customer account details"
              >
                Edit
              </Button>

              <RefreshButton
                onClick={() => {
                  loadData()
                  onRefreshCustomers()
                }}
                isLoading={isLedgerLoading || isPurchasesLoading}
                title="Refresh ledger records"
              />
            </div>
          </div>
        </div>
      </div>


      {/* ─── Filter & Navigation Toolbar ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Primary Segmented Strip */}
        <div className="px-3.5 py-2 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                activeTab === "ALL"
                  ? "bg-slate-900 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>All Ledger Logs ({ledgerEntries.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("INVOICES")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                activeTab === "INVOICES"
                  ? "bg-blue-700 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />
              <span>Sales Invoices</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("PAYMENTS")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                activeTab === "PAYMENTS"
                  ? "bg-emerald-700 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-500" />
              <span>Repayments & Credits</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("PURCHASES")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                activeTab === "PURCHASES"
                  ? "bg-slate-900 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <Package className="w-3.5 h-3.5 text-slate-500" />
              <span>Invoice Items ({purchases.length})</span>
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer flex items-center gap-1 shrink-0 ml-auto pl-2"
              title="Reset all filters"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Secondary Filter Bar: Search + Date Range Filter */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "PURCHASES"
                    ? "Search invoice number or product name..."
                    : "Search by voucher, invoice number, or note..."
                }
                className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-xs text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date Filter (for ledger transactions) */}
            {activeTab !== "PURCHASES" && (
              <div className="flex items-center gap-2 flex-wrap">
                <DateRangeFilter
                  value={dateRange}
                  onChange={(newRange) => {
                    setDateRange(newRange)
                    setPage(0)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Main Content Views ─────────────────────────────────────── */}
      {activeTab === "PURCHASES" ? (
        /* Itemized Purchases History List */
        <div className="space-y-3">
          {isPurchasesLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500">
              Loading purchase records...
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500">
              No invoice records found matching criteria.
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedPurchases.map((sale) => {
                const saleDue = Number(sale.dueAmount) || 0
                return (
                  <div
                    key={sale.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">
                          Invoice #{sale.invoiceNo}
                        </span>
                        <span className="text-slate-500">
                          {formatDate(sale.saleDate)}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          {sale.saleMode || "RETAIL"}
                        </span>
                        {saleDue > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Due: {tk(saleDue)}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Paid in Full
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-bold text-slate-900 text-sm tabular-nums block">
                            {tk(sale.totalAmount)}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            Paid: {tk((sale.cashPaid || 0) + (sale.digitalPaid || 0))}
                          </span>
                        </div>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onPrintInvoice(sale)}
                          leftIcon={<Printer className="w-3.5 h-3.5 text-slate-500" />}
                        >
                          Print Memo
                        </Button>
                      </div>
                    </div>

                    {/* Item details */}
                    <div className="pt-2.5 overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                          <tr>
                            <th className="py-1">Product Description</th>
                            <th className="py-1">Batch / Lot</th>
                            <th className="py-1 text-right">Unit Price</th>
                            <th className="py-1 text-right">Quantity</th>
                            <th className="py-1 text-right">Line Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sale.items?.map((it, idx) => (
                            <tr key={idx} className="text-slate-800">
                              <td className="py-1.5 font-medium">
                                {it.productNameEn || it.productNameBn || "Item"}
                              </td>
                              <td className="py-1.5 font-mono text-slate-500 text-[11px]">
                                {it.lotNumber || "LOT-01"}
                              </td>
                              <td className="py-1.5 text-right tabular-nums text-slate-600">
                                {tk(it.unitPrice)}
                              </td>
                              <td className="py-1.5 text-right tabular-nums font-semibold text-slate-900">
                                {it.totalQuantity}
                              </td>
                              <td className="py-1.5 text-right tabular-nums font-bold text-slate-900">
                                {tk(it.subtotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}

              <Pagination
                page={purchasePage}
                pageSize={purchasePageSize}
                totalElements={filteredPurchases.length}
                onPageChange={setPurchasePage}
                onPageSizeChange={(newSize) => {
                  setPurchasePageSize(newSize)
                  setPurchasePage(0)
                }}
                pageSizeOptions={[5, 8, 15]}
                itemLabel="invoices"
              />
            </div>
          )}
        </div>
      ) : (
        /* ─── Standard Ledger Table ────────────────────────────────── */
        <div className="space-y-3">
          <Table containerClassName="overflow-hidden">
            <TableHeader className="bg-slate-50/80 border-b border-slate-200 select-none">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-slate-500 text-[11px] uppercase tracking-wider py-3 whitespace-nowrap">
                  Transaction Date
                </TableHead>
                <TableHead className="font-bold text-slate-500 text-[11px] uppercase tracking-wider py-3 whitespace-nowrap">
                  Transaction Type
                </TableHead>
                <TableHead className="font-bold text-slate-500 text-[11px] uppercase tracking-wider py-3 whitespace-nowrap">
                  Ref / Voucher No.
                </TableHead>
                <TableHead align="right" className="font-bold text-slate-500 text-[11px] uppercase tracking-wider py-3 whitespace-nowrap">
                  Billed (+Debit)
                </TableHead>
                <TableHead align="right" className="font-bold text-slate-500 text-[11px] uppercase tracking-wider py-3 whitespace-nowrap">
                  Paid (-Credit)
                </TableHead>
                <TableHead align="right" className="font-bold text-slate-500 text-[11px] uppercase tracking-wider py-3 whitespace-nowrap">
                  Balance After
                </TableHead>
                <TableHead className="font-bold text-slate-500 text-[11px] uppercase tracking-wider py-3">
                  Notes
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLedgerLoading ? (
                <TableLoadingState colSpan={7} text="Loading ledger statement..." />
              ) : filteredLedger.length === 0 ? (
                <TableEmptyState
                  colSpan={7}
                  title="No Transactions Found"
                  description="No ledger transactions match the selected filters or date range."
                />
              ) : (
                paginatedLedger.map((row) => {
                  const badge = getTransactionBadge(row.transactionType)
                  return (
                    <TableRow key={row.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Date */}
                      <TableCell className="tabular-nums text-slate-700 whitespace-nowrap py-3 font-medium">
                        {formatDate(row.transactionDate)}
                      </TableCell>

                      {/* Type Badge */}
                      <TableCell className="whitespace-nowrap py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${badge.bg}`}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </TableCell>

                      {/* Ref / Voucher No */}
                      <TableCell className="tabular-nums text-slate-700 font-mono text-xs whitespace-nowrap py-3">
                        {row.moneyReceiptNo || (row.saleId ? `INV-${row.saleId}` : "—")}
                      </TableCell>

                      {/* Debit (+Bill) */}
                      <TableCell align="right" className="tabular-nums font-semibold whitespace-nowrap py-3 text-rose-600">
                        {row.debit > 0 ? tk(row.debit) : "—"}
                      </TableCell>

                      {/* Credit (-Paid) */}
                      <TableCell align="right" className="tabular-nums font-semibold whitespace-nowrap py-3 text-emerald-700">
                        {row.credit > 0 ? tk(row.credit) : "—"}
                      </TableCell>

                      {/* Balance After */}
                      <TableCell align="right" className="tabular-nums font-bold text-slate-900 whitespace-nowrap py-3">
                        {tk(row.balanceAfter)}
                      </TableCell>

                      {/* Notes */}
                      <TableCell className="text-slate-500 max-w-[200px] truncate py-3 text-xs">
                        {row.notes || "—"}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {!isLedgerLoading && filteredLedger.length > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              totalElements={filteredLedger.length}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setPage(0)
              }}
              pageSizeOptions={[10, 15, 25, 50]}
              itemLabel="transactions"
            />
          )}
        </div>
      )}
    </div>
  )
}
