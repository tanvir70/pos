import React, { useState, useEffect, useCallback } from "react"
import type { StockMovement, PagedResponse } from "../types"
import { getStockMovements } from "../api/endpoints"
import Pagination from "./ui/Pagination"
import DateRangeFilter, { type DateRange, defaultDateRange } from "./ui/DateRangeFilter"
import { formatLotNumber } from "../utils/lotNumber"
import {
  X,
  History,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileText,
  AlertTriangle,
  Package,
} from "lucide-react"

export interface StockLedgerModalProps {
  isOpen: boolean
  productId?: number
  productName?: string
  productCode?: string
  lotId?: number
  lotNumber?: string
  onClose: () => void
}

const formatDate = (isoString?: string) => {
  if (!isoString) return "-"
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
        icon: <ArrowUpRight className="w-3 h-3 text-emerald-600" />,
        isAddition: true,
      }
    case "SALE":
      return {
        label: "POS Sale",
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        icon: <ArrowDownRight className="w-3 h-3 text-blue-600" />,
        isAddition: false,
      }
    case "RETURN_RESTOCKED":
      return {
        label: "Return Restock",
        bg: "bg-purple-50 text-purple-700 border-purple-200",
        icon: <ArrowUpRight className="w-3 h-3 text-purple-600" />,
        isAddition: true,
      }
    case "RETURN_QUARANTINED":
      return {
        label: "Damaged Return",
        bg: "bg-orange-50 text-orange-700 border-orange-200",
        icon: <ArrowUpRight className="w-3 h-3 text-orange-600" />,
        isAddition: true,
      }
    case "BREAKAGE_LEAKAGE":
    case "DAMAGE_WRITE_OFF":
    case "DAMAGE_WRITEOFF":
      return {
        label: "Damage Write-Off",
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        icon: <ArrowDownRight className="w-3 h-3 text-rose-600" />,
        isAddition: false,
      }
    case "DAMAGE_SPOILAGE":
      return {
        label: "Moisture Spoilage",
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        icon: <ArrowDownRight className="w-3 h-3 text-rose-600" />,
        isAddition: false,
      }
    case "EXPIRED_SCRAP":
      return {
        label: "Expired Scrap",
        bg: "bg-red-50 text-red-700 border-red-200",
        icon: <ArrowDownRight className="w-3 h-3 text-red-600" />,
        isAddition: false,
      }
    case "PHYSICAL_AUDIT_VARIANCE":
      return {
        label: "Audit Variance",
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        icon: <Filter className="w-3 h-3 text-amber-600" />,
        isAddition: false,
      }
    case "PROMOTIONAL_SAMPLE":
      return {
        label: "Demo Sample",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: <ArrowDownRight className="w-3 h-3 text-emerald-600" />,
        isAddition: false,
      }
    case "ADJUSTMENT":
      return {
        label: "Adjustment",
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        icon: <ArrowDownRight className="w-3 h-3 text-amber-600" />,
        isAddition: false,
      }
    case "DAMAGE_TO_QUARANTINE":
      return {
        label: "To Quarantine",
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        icon: <ArrowDownRight className="w-3 h-3 text-amber-600" />,
        isAddition: false,
      }
    case "DAMAGE_RECEIVED_QUARANTINE":
      return {
        label: "Quarantine Hold",
        bg: "bg-violet-50 text-violet-700 border-violet-200",
        icon: <ArrowUpRight className="w-3 h-3 text-violet-600" />,
        isAddition: true,
      }
    case "QUARANTINE_DISPOSAL":
      return {
        label: "Hazard Disposal",
        bg: "bg-slate-100 text-slate-700 border-slate-300",
        icon: <ArrowDownRight className="w-3 h-3 text-slate-500" />,
        isAddition: false,
      }
    case "OPENING_BALANCE":
      return {
        label: "Opening Balance",
        bg: "bg-teal-50 text-teal-700 border-teal-200",
        icon: <Package className="w-3 h-3 text-teal-600" />,
        isAddition: true,
      }
    default:
      return {
        label: type.replace(/_/g, " "),
        bg: "bg-slate-50 text-slate-600 border-slate-200",
        icon: <History className="w-3 h-3" />,
        isAddition: false,
      }
  }
}

export default function StockLedgerModal({
  isOpen,
  productId,
  productName,
  productCode,
  lotId,
  lotNumber,
  onClose,
}: StockLedgerModalProps) {
  const [page, setPage] = useState<number>(0)
  const [pageSize, setPageSize] = useState<number>(15)
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange)
  const [pagedData, setPagedData] = useState<PagedResponse<StockMovement> | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [selectedType, setSelectedType] = useState<string>("ALL")

  const loadMovements = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await getStockMovements(
        productId,
        lotId,
        page,
        pageSize,
        dateRange.startDate,
        dateRange.endDate
      )
      setPagedData(data)
    } catch (err) {
      console.error("Failed to fetch stock movements:", err)
    } finally {
      setIsLoading(false)
    }
  }, [productId, lotId, page, pageSize, dateRange.startDate, dateRange.endDate])

  useEffect(() => {
    if (isOpen) {
      loadMovements()
    }
  }, [isOpen, loadMovements])

  if (!isOpen) return null

  const rawMovements = pagedData?.content || []
  const filteredMovements =
    selectedType === "ALL"
      ? rawMovements
      : rawMovements.filter((m) => m.movementType === selectedType)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Stock Movement Ledger (Bin Card)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Immutable Audit
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {productName ? (
                  <>
                    <span className="font-semibold text-slate-800">{productName}</span>
                    {productCode && <span className="font-mono text-slate-400"> ({productCode})</span>}
                    {lotNumber && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-200/80 text-[10px] font-mono text-slate-700">
                        Lot: {lotNumber}
                      </span>
                    )}
                  </>
                ) : (
                  "Complete chronological store inventory transaction log"
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadMovements}
              disabled={isLoading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto shrink-0">
            <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Filter:</span>
            {["ALL", "SALE", "LOT_ENTRY", "BREAKAGE_LEAKAGE", "RETURN_RESTOCKED"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  selectedType === type
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {type === "ALL" ? "All Logs" : getMovementBadge(type).label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <DateRangeFilter
              value={dateRange}
              onChange={(newRange) => {
                setDateRange(newRange)
                setPage(0)
              }}
            />
            {pagedData && (
              <span className="text-[11px] text-slate-400 shrink-0">
                Total <span className="font-semibold text-slate-700">{pagedData.totalElements}</span> entries
              </span>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 animate-pulse">
                  <div className="w-28 h-4 bg-slate-200 rounded" />
                  <div className="w-24 h-5 bg-slate-200 rounded-full" />
                  <div className="w-32 h-4 bg-slate-200 rounded" />
                  <div className="flex-1" />
                  <div className="w-20 h-4 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <History className="w-10 h-10 stroke-1 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-600">No stock movements recorded</p>
              <p className="text-xs text-slate-400 mt-1">
                Stock changes from purchases, sales, returns, and write-offs will populate automatically
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 uppercase tracking-wider text-[11px] font-semibold">
                    <th className="pb-3 px-2">Date & Time</th>
                    <th className="pb-3 px-2">Type</th>
                    <th className="pb-3 px-2">Lot / Batch</th>
                    <th className="pb-3 px-2">Reference</th>
                    <th className="pb-3 px-2 text-right">Quantity Change</th>
                    <th className="pb-3 px-2">Remarks</th>
                    <th className="pb-3 px-2">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMovements.map((m) => {
                    const badge = getMovementBadge(m.movementType)
                    const isPositive = m.quantityChange > 0
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-2 font-mono text-slate-600">
                          {formatDate(m.movementTime)}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                            {formatLotNumber(m.lotNumber)}
                          </span>
                        </td>
                        <td className="py-3 px-2 font-mono text-slate-600 text-[11px]">
                          {m.referenceDocNo ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                              <FileText className="w-3 h-3 text-slate-400" />
                              <span>{m.referenceDocNo}</span>
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-bold tabular-nums">
                          <span className={isPositive ? "text-emerald-700" : "text-rose-600"}>
                            {isPositive ? `+${m.quantityChange}` : m.quantityChange} {m.unit}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-slate-600 max-w-[200px] truncate" title={m.remarks}>
                          {m.remarks || "-"}
                        </td>
                        <td className="py-3 px-2 text-slate-500 text-[11px]">
                          {m.performedBy || "System"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Pagination */}
        <Pagination
          page={page}
          pageSize={pageSize}
          totalElements={pagedData?.totalElements || 0}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize)
            setPage(0)
          }}
          pageSizeOptions={[10, 15, 25, 50]}
          itemLabel="movements"
        />
      </div>
    </div>
  )
}
