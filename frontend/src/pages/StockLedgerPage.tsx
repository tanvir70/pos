import { useState, useEffect, useCallback, useMemo } from "react"
import type { StockMovement, Product, StockItem, PagedResponse } from "../types"
import { getStockMovements, getProducts, getStock } from "../api/endpoints"
import GotposStatCard from "../components/dashboard/GotposStatCard"
import Button from "../components/ui/Button"
import Pagination from "../components/ui/Pagination"
import DateRangeFilter, { type DateRange, defaultDateRange } from "../components/ui/DateRangeFilter"
import { formatLotNumber } from "../utils/lotNumber"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmptyState,
  TableLoadingState,
} from "../components/ui/Table"
import {
  History,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Search,
  Package,
  Layers,
  Flame,
  Printer,
  FileText,
  X,
  ShoppingCart,
  RotateCcw,
  ClipboardCheck,
  BookOpen,
} from "lucide-react"

const MOVEMENT_CATEGORIES = [
  { id: "ALL", label: "All Logs", icon: History },
  { id: "SALE", label: "POS Sales", icon: ShoppingCart },
  { id: "LOT_ENTRY", label: "Lot Inwards", icon: ArrowUpRight, color: "text-emerald-600" },
  { id: "DAMAGE_ALL", label: "Damage Write-Offs", icon: Flame, color: "text-rose-600" },
  { id: "RETURN_ALL", label: "Customer Returns", icon: RotateCcw, color: "text-purple-600" },
  { id: "PHYSICAL_AUDIT_VARIANCE", label: "Audit Variances", icon: ClipboardCheck, color: "text-amber-600" },
  { id: "PROMOTIONAL_SAMPLE", label: "Farmer Demos", icon: Package, color: "text-teal-600" },
  { id: "OPENING_BALANCE", label: "Opening Balances", icon: BookOpen, color: "text-slate-600" },
]

export interface StockLedgerPageProps {
  initialProductId?: number
  initialLotId?: number
  onNavigateBack?: () => void
}

const formatDate = (isoString?: string) => {
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

const getMovementBadge = (type: string) => {
  switch (type) {
    case "LOT_ENTRY":
    case "LOT_INWARD":
      return {
        label: "Lot Inward",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />,
        isAddition: true,
      }
    case "SALE":
      return {
        label: "POS Sale",
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        icon: <ArrowDownRight className="w-3.5 h-3.5 text-blue-600" />,
        isAddition: false,
      }
    case "RETURN_RESTOCKED":
      return {
        label: "Return Restock",
        bg: "bg-purple-50 text-purple-700 border-purple-200",
        icon: <ArrowUpRight className="w-3.5 h-3.5 text-purple-600" />,
        isAddition: true,
      }
    case "RETURN_QUARANTINED":
      return {
        label: "Damaged Return",
        bg: "bg-orange-50 text-orange-700 border-orange-200",
        icon: <ArrowUpRight className="w-3.5 h-3.5 text-orange-600" />,
        isAddition: true,
      }
    case "BREAKAGE_LEAKAGE":
    case "DAMAGE_WRITE_OFF":
    case "DAMAGE_WRITEOFF":
      return {
        label: "Damage Write-Off",
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        icon: <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />,
        isAddition: false,
      }
    case "DAMAGE_SPOILAGE":
      return {
        label: "Moisture Spoilage",
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        icon: <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />,
        isAddition: false,
      }
    case "EXPIRED_SCRAP":
      return {
        label: "Expired Scrap",
        bg: "bg-red-50 text-red-700 border-red-200",
        icon: <ArrowDownRight className="w-3.5 h-3.5 text-red-600" />,
        isAddition: false,
      }
    case "PHYSICAL_AUDIT_VARIANCE":
      return {
        label: "Audit Variance",
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        icon: <Filter className="w-3.5 h-3.5 text-amber-600" />,
        isAddition: false,
      }
    case "PROMOTIONAL_SAMPLE":
      return {
        label: "Demo Sample",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />,
        isAddition: false,
      }
    case "ADJUSTMENT":
      return {
        label: "Adjustment",
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        icon: <ArrowDownRight className="w-3.5 h-3.5 text-amber-600" />,
        isAddition: false,
      }
    case "DAMAGE_TO_QUARANTINE":
      return {
        label: "To Quarantine",
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        icon: <ArrowDownRight className="w-3.5 h-3.5 text-amber-600" />,
        isAddition: false,
      }
    case "DAMAGE_RECEIVED_QUARANTINE":
      return {
        label: "Quarantine Hold",
        bg: "bg-violet-50 text-violet-700 border-violet-200",
        icon: <ArrowUpRight className="w-3.5 h-3.5 text-violet-600" />,
        isAddition: true,
      }
    case "QUARANTINE_DISPOSAL":
      return {
        label: "Hazard Disposal",
        bg: "bg-slate-100 text-slate-700 border-slate-300",
        icon: <ArrowDownRight className="w-3.5 h-3.5 text-slate-500" />,
        isAddition: false,
      }
    case "OPENING_BALANCE":
      return {
        label: "Opening Balance",
        bg: "bg-teal-50 text-teal-700 border-teal-200",
        icon: <Package className="w-3.5 h-3.5 text-teal-600" />,
        isAddition: true,
      }
    default:
      return {
        label: type.replace(/_/g, " "),
        bg: "bg-slate-50 text-slate-600 border-slate-200",
        icon: <Filter className="w-3.5 h-3.5 text-slate-500" />,
        isAddition: false,
      }
  }
}

export default function StockLedgerPage({
  initialProductId,
  initialLotId,
  onNavigateBack,
}: StockLedgerPageProps) {
  // ─── Filter State ───────────────────────────────────────────────
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>(initialProductId)
  const [selectedLotId, setSelectedLotId] = useState<number | undefined>(initialLotId)
  const [selectedType, setSelectedType] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange)
  const [page, setPage] = useState<number>(0)
  const [pageSize, setPageSize] = useState<number>(20)

  // ─── Remote Data State ──────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([])
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [pagedMovements, setPagedMovements] = useState<PagedResponse<StockMovement> | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Sync initial props if changed
  useEffect(() => {
    setSelectedProductId(initialProductId)
    setSelectedLotId(initialLotId)
    setPage(0)
  }, [initialProductId, initialLotId])

  // Load product catalog for dropdown filters
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const [prods, stk] = await Promise.all([getProducts(), getStock()])
        setProducts(prods)
        setStocks(stk)
      } catch (err) {
        console.error("Failed to load catalog for ledger filters:", err)
      }
    }
    fetchCatalog()
  }, [])

  // Load paginated movements from backend
  const loadMovements = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await getStockMovements(
        selectedProductId,
        selectedLotId,
        page,
        pageSize,
        dateRange.startDate,
        dateRange.endDate
      )
      setPagedMovements(data)
    } catch (err) {
      console.error("Failed to fetch stock movements:", err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedProductId, selectedLotId, page, pageSize, dateRange.startDate, dateRange.endDate])

  useEffect(() => {
    loadMovements()
  }, [loadMovements])

  // Active product details
  const currentProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  )

  // Lots available for the currently selected product
  const availableLots = useMemo(() => {
    if (!selectedProductId) return stocks
    return stocks.filter((s) => s.productId === selectedProductId)
  }, [stocks, selectedProductId])

  const selectedLot = useMemo(
    () => availableLots.find((l) => l.lotId === selectedLotId),
    [availableLots, selectedLotId]
  )

  const hasActiveFilters = Boolean(
    selectedProductId ||
    selectedLotId ||
    selectedType !== "ALL" ||
    searchQuery.trim() ||
    dateRange.preset !== "ALL"
  )

  const handleResetFilters = useCallback(() => {
    setSelectedProductId(undefined)
    setSelectedLotId(undefined)
    setSelectedType("ALL")
    setSearchQuery("")
    setDateRange(defaultDateRange)
    setPage(0)
  }, [])

  // Client-side filtering on current page content (type filter & search query)
  const rawMovements = pagedMovements?.content || []
  const filteredMovements = useMemo(() => {
    return rawMovements.filter((m) => {
      // 1. Movement type filter
      if (selectedType !== "ALL") {
        if (selectedType === "DAMAGE_ALL") {
          if (
            m.movementType !== "BREAKAGE_LEAKAGE" &&
            m.movementType !== "DAMAGE_WRITE_OFF" &&
            m.movementType !== "DAMAGE_WRITEOFF" &&
            m.movementType !== "DAMAGE_SPOILAGE" &&
            m.movementType !== "EXPIRED_SCRAP" &&
            m.movementType !== "DAMAGE_TO_QUARANTINE" &&
            m.movementType !== "QUARANTINE_DISPOSAL"
          ) {
            return false
          }
        } else if (selectedType === "RETURN_ALL") {
          if (
            m.movementType !== "RETURN_RESTOCKED" &&
            m.movementType !== "RETURN_QUARANTINED"
          ) {
            return false
          }
        } else if (selectedType === "LOT_ENTRY") {
          if (
            m.movementType !== "LOT_ENTRY" &&
            m.movementType !== "LOT_INWARD"
          ) {
            return false
          }
        } else if (m.movementType !== selectedType) {
          return false
        }
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const matchRef = m.referenceDocNo?.toLowerCase().includes(q)
        const matchLot = m.lotNumber?.toLowerCase().includes(q)
        const matchProd =
          m.productNameEn?.toLowerCase().includes(q) ||
          m.productCode?.toLowerCase().includes(q)
        const matchRemarks = m.remarks?.toLowerCase().includes(q)
        const matchUser = m.performedBy?.toLowerCase().includes(q)
        if (!matchRef && !matchLot && !matchProd && !matchRemarks && !matchUser) {
          return false
        }
      }

      return true
    })
  }, [rawMovements, selectedType, searchQuery])

  // Summary Metrics Calculation across current page / database
  const metrics = useMemo(() => {
    let inwardCount = 0
    let outwardCount = 0
    let damageLossUnits = 0

    rawMovements.forEach((m) => {
      const isAdd =
        m.quantityChange > 0 ||
        m.movementType === "LOT_ENTRY" ||
        m.movementType === "LOT_INWARD" ||
        m.movementType === "RETURN_RESTOCKED" ||
        m.movementType === "OPENING_BALANCE"

      if (isAdd) {
        inwardCount += Math.abs(m.quantityChange)
      } else {
        outwardCount += Math.abs(m.quantityChange)
      }

      if (
        m.movementType === "BREAKAGE_LEAKAGE" ||
        m.movementType === "DAMAGE_WRITE_OFF" ||
        m.movementType === "DAMAGE_WRITEOFF" ||
        m.movementType === "DAMAGE_SPOILAGE" ||
        m.movementType === "EXPIRED_SCRAP" ||
        m.movementType === "QUARANTINE_DISPOSAL"
      ) {
        damageLossUnits += Math.abs(m.quantityChange)
      }
    })

    return {
      inwardCount,
      outwardCount,
      damageLossUnits,
      totalRecords: pagedMovements?.totalElements || 0,
    }
  }, [rawMovements, pagedMovements])

  return (
    <div className="space-y-4">
      {/* ─── Top Header Toolbar ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-teal-700" />
                <span>Stock Ledger</span>
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200 uppercase tracking-wider">
                Immutable Audit Log
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete chronological store inventory transaction log, running balances, and document audit trails
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-4 h-4 text-slate-600" />}
            title="Print or export current ledger report"
            className="text-xs"
          >
            Print Ledger
          </Button>
          <button
            type="button"
            onClick={() => {
              setPage(0)
              loadMovements()
            }}
            disabled={isLoading}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-900 rounded-xl border border-slate-200 cursor-pointer transition-colors text-xs"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ─── KPI Summary Strip ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Audit Records */}
        <GotposStatCard
          title="Total Logged Entries"
          value={metrics.totalRecords}
          subtitle="Immutable database transactions"
          theme="teal"
          icon={<History className="w-5 h-5" />}
        />

        {/* 2. Inward Quantity (Page) */}
        <GotposStatCard
          title="Inward Movements (+)"
          value={`${metrics.inwardCount} units`}
          subtitle="Lot entries, returns, opening stock"
          theme="emerald"
          icon={<ArrowUpRight className="w-5 h-5" />}
        />

        {/* 3. Outward Quantity (Page) */}
        <GotposStatCard
          title="Outward Deductions (-)"
          value={`${metrics.outwardCount} units`}
          subtitle="POS sales, write-offs, transfers"
          theme="navy"
          icon={<ArrowDownRight className="w-5 h-5" />}
        />

        {/* 4. Damage / Shrinkage Loss (Page) */}
        <GotposStatCard
          title="Damage / Scrap Write-Offs"
          value={`${metrics.damageLossUnits} units`}
          valueColor={metrics.damageLossUnits > 0 ? "text-rose-600" : "text-slate-900"}
          subtitle="Breakage, moisture, expired write-offs"
          theme={metrics.damageLossUnits > 0 ? "rose" : "amber"}
          icon={<Flame className="w-5 h-5" />}
        />
      </div>

      {/* ─── Filter & Scope Toolbar ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* 1. Category Segmented Navigation Strip */}
        <div className="px-3.5 py-2 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 shrink-0">
            {MOVEMENT_CATEGORIES.map((cat) => {
              const isSelected = selectedType === cat.id
              const IconComponent = cat.icon
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedType(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    isSelected
                      ? "bg-teal-700 text-white shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  <IconComponent className={`w-3.5 h-3.5 ${isSelected ? "text-white" : cat.color || "text-slate-400"}`} />
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer flex items-center gap-1 shrink-0 ml-auto pl-2"
              title="Reset all filters"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* 2. Secondary Filter Bar: Search + Product + Batch + Date Range */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reference #INV, #ADJ, batch, or notes..."
                className="w-full text-xs pl-9 pr-8 py-2 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Product Selector */}
            <div className="relative lg:w-56 shrink-0">
              <Package className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedProductId || ""}
                onChange={(e) => {
                  const val = Number(e.target.value) || undefined
                  setSelectedProductId(val)
                  setSelectedLotId(undefined)
                  setPage(0)
                }}
                className="w-full text-xs font-semibold pl-8 pr-7 py-2 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden cursor-pointer appearance-none transition-all truncate"
              >
                <option value="">All Products ({products.length})</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameEn} ({p.productCode})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Batch / Lot Selector */}
            <div className="relative lg:w-48 shrink-0">
              <Layers className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedLotId || ""}
                onChange={(e) => {
                  const val = Number(e.target.value) || undefined
                  setSelectedLotId(val)
                  setPage(0)
                }}
                disabled={availableLots.length === 0}
                className="w-full text-xs font-semibold pl-8 pr-7 py-2 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:border-teal-600 focus:outline-hidden cursor-pointer appearance-none transition-all font-mono truncate disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">All Batches / Lots</option>
                {availableLots.map((l) => (
                  <option key={l.lotId} value={l.lotId}>
                    {formatLotNumber(l.lotNumber)} ({l.nameEn})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Date Range Filter */}
            <div className="shrink-0">
              <DateRangeFilter
                value={dateRange}
                onChange={(newRange) => {
                  setDateRange(newRange)
                  setPage(0)
                }}
              />
            </div>
          </div>

          {/* 3. Active Filter Chips & Context Bar */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Active Filters:
              </span>

              {currentProduct && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-xs font-medium">
                  <Package className="w-3 h-3 text-teal-600" />
                  <span>{currentProduct.nameEn}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductId(undefined)
                      setSelectedLotId(undefined)
                      setPage(0)
                    }}
                    className="hover:text-teal-950 cursor-pointer p-0.5 ml-0.5"
                    title="Remove product filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedLot && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-800 border border-violet-200 text-xs font-medium font-mono">
                  <Layers className="w-3 h-3 text-violet-600" />
                  <span>{formatLotNumber(selectedLot.lotNumber)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLotId(undefined)
                      setPage(0)
                    }}
                    className="hover:text-violet-950 cursor-pointer p-0.5 ml-0.5"
                    title="Remove batch filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedType !== "ALL" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 text-xs font-medium">
                  <span>Category: {MOVEMENT_CATEGORIES.find((c) => c.id === selectedType)?.label || selectedType}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedType("ALL")}
                    className="hover:text-slate-900 cursor-pointer p-0.5 ml-0.5"
                    title="Reset category"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {dateRange.preset !== "ALL" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
                  <span>Date: {dateRange.preset.replace(/_/g, " ")}</span>
                  <button
                    type="button"
                    onClick={() => setDateRange(defaultDateRange)}
                    className="hover:text-emerald-950 cursor-pointer p-0.5 ml-0.5"
                    title="Reset date filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-xs font-medium">
                  <span>Search: &ldquo;{searchQuery.trim()}&rdquo;</span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="hover:text-blue-950 cursor-pointer p-0.5 ml-0.5"
                    title="Clear search query"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleResetFilters}
                className="ml-auto text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Clear All</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── High-Density Full-Width Bin Card Table ───────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date &amp; Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Product &amp; Code</TableHead>
              <TableHead>Batch / Lot</TableHead>
              <TableHead>Document Reference</TableHead>
              <TableHead align="right">Qty Change</TableHead>
              <TableHead align="center">Running Balance</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Remarks / User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoadingState colSpan={9} text="Loading audit records..." />
            ) : filteredMovements.length === 0 ? (
              <TableEmptyState
                colSpan={9}
                title="No stock movements found"
                description={
                  selectedProductId || selectedType !== "ALL" || searchQuery
                    ? "No transactions match your current filter parameters. Try clearing your filters."
                    : "No stock movements have been recorded yet."
                }
              />
            ) : (
              filteredMovements.map((m) => {
                const badge = getMovementBadge(m.movementType)
                const isAdd = m.quantityChange > 0 || badge.isAddition
                const isDeduction = m.quantityChange < 0

                return (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs">
                    {/* 1. Date & Time */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                      {formatDate(m.movementTime)}
                    </td>

                    {/* 2. Movement Type Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] border ${badge.bg}`}
                      >
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    {/* 3. Product & Code */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 leading-tight">
                        {m.productNameEn || `Product #${m.productId}`}
                      </div>
                      {m.productCode && (
                        <div className="font-mono text-[10px] text-slate-500 mt-0.5">
                          #{m.productCode}
                        </div>
                      )}
                    </td>

                    {/* 4. Batch / Lot Number */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-[11px] text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                        {m.lotNumber || `Lot #${m.lotId}`}
                      </span>
                    </td>

                    {/* 5. Document Reference */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {m.referenceDocNo ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-300 shadow-2xs">
                          <FileText className="w-3 h-3 text-slate-500" />
                          <span>{m.referenceDocNo}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">—</span>
                      )}
                    </td>

                    {/* 6. Quantity Change */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span
                        className={`font-mono font-bold text-xs ${
                          isAdd
                            ? "text-emerald-700"
                            : isDeduction
                            ? "text-rose-700"
                            : "text-slate-500"
                        }`}
                      >
                        {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}{" "}
                        <span className="text-[10px] font-normal text-slate-500">{m.unit}</span>
                      </span>
                    </td>

                    {/* 7. Running Balance (Before -> After) */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 font-mono text-xs">
                        <span className="text-slate-400">{m.balanceBefore}</span>
                        <span className="text-slate-300 font-bold">→</span>
                        <span className="font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          {m.balanceAfter}
                        </span>
                      </div>
                    </td>

                    {/* 8. Location */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          m.location === "QUARANTINE"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {m.location === "QUARANTINE" ? "Quarantine" : "Dokan Shelf"}
                      </span>
                    </td>

                    {/* 9. Remarks & Operator */}
                    <td className="py-3 px-4 text-slate-600 max-w-xs">
                      <div className="text-xs truncate font-medium" title={m.remarks || ""}>
                        {m.remarks || "—"}
                      </div>
                      {m.performedBy && (
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          By: {m.performedBy}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* ─── Pagination Footer ────────────────────────────────────── */}
        <Pagination
          page={page}
          pageSize={pageSize}
          totalElements={pagedMovements?.totalElements || 0}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize)
            setPage(0)
          }}
          pageSizeOptions={[10, 20, 50, 100]}
          itemLabel="movements"
        />
      </div>
    </div>
  )
}
