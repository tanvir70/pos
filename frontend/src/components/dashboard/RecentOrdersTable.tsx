import React, { useState, useEffect, useCallback } from "react"
import type { SaleResponse, PagedResponse } from "../../types"
import { getPaginatedSales } from "../../api/endpoints"
import {
  FileText,
  Printer,
  ChevronLeft,
  ChevronRight,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShoppingBag,
} from "lucide-react"

export interface RecentOrdersTableProps {
  onViewOrder: (sale: SaleResponse) => void
  onNavigateToPos?: () => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatDate = (isoString?: string) => {
  if (!isoString) return "-"
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return isoString
  }
}

export const RecentOrdersTable: React.FC<RecentOrdersTableProps> = ({
  onViewOrder,
  onNavigateToPos,
}) => {
  // Filter state
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("today")
  const [saleMode, setSaleMode] = useState<"ALL" | "WHOLESALE" | "RETAIL">("ALL")
  const [page, setPage] = useState<number>(0)
  const pageSize = 8

  // Data state
  const [pagedData, setPagedData] = useState<PagedResponse<SaleResponse> | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const fetchSales = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await getPaginatedSales({
        page,
        size: pageSize,
        period: period === "all" ? undefined : period,
        saleMode: saleMode === "ALL" ? undefined : saleMode,
      })
      setPagedData(res)
    } catch (err) {
      console.error("Failed to load recent orders:", err)
    } finally {
      setIsLoading(false)
    }
  }, [page, period, saleMode])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  const handleTabChange = (newPeriod: "today" | "week" | "month" | "all") => {
    setPeriod(newPeriod)
    setPage(0)
  }

  const handleModeToggle = (mode: "ALL" | "WHOLESALE" | "RETAIL") => {
    setSaleMode(mode)
    setPage(0)
  }

  const sales = pagedData?.content || []
  const totalPages = pagedData?.totalPages || 1
  const totalElements = pagedData?.totalElements || 0

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
      {/* Card Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-base sm:text-lg">Recent Orders</h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {totalElements} total
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time counter and wholesale transaction log
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => handleTabChange("today")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                period === "today"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("week")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                period === "week"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("month")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                period === "month"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("all")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                period === "all"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All
            </button>
          </div>

          {/* Wholesale filter pill */}
          <button
            type="button"
            onClick={() => handleModeToggle(saleMode === "WHOLESALE" ? "ALL" : "WHOLESALE")}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              saleMode === "WHOLESALE"
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {saleMode === "WHOLESALE" ? "✓ Wholesale Only" : "Wholesale"}
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto min-h-[340px] my-2">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100 uppercase tracking-wider text-[11px] font-semibold">
              <th className="py-3 px-2">Order ID</th>
              <th className="py-3 px-2">Date & Time</th>
              <th className="py-3 px-2">Customer</th>
              <th className="py-3 px-2">Items</th>
              <th className="py-3 px-2 text-right">Total Amount</th>
              <th className="py-3 px-2 text-center">Payment Status</th>
              <th className="py-3 px-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              // Skeleton rows
              [...Array(pageSize)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-3.5 px-2">
                    <div className="w-24 h-4 bg-slate-100 rounded" />
                  </td>
                  <td className="py-3.5 px-2">
                    <div className="w-20 h-4 bg-slate-100 rounded" />
                  </td>
                  <td className="py-3.5 px-2">
                    <div className="w-28 h-4 bg-slate-100 rounded" />
                  </td>
                  <td className="py-3.5 px-2">
                    <div className="w-12 h-4 bg-slate-100 rounded" />
                  </td>
                  <td className="py-3.5 px-2 text-right">
                    <div className="w-16 h-4 bg-slate-100 rounded ml-auto" />
                  </td>
                  <td className="py-3.5 px-2 text-center">
                    <div className="w-14 h-4 bg-slate-100 rounded mx-auto" />
                  </td>
                  <td className="py-3.5 px-2 text-center">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg mx-auto" />
                  </td>
                </tr>
              ))
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <ShoppingBag className="w-8 h-8 stroke-1 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-600">No orders found in this selection</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Try selecting a different timeframe or record a new sale in POS Counter
                  </p>
                  {onNavigateToPos && (
                    <button
                      type="button"
                      onClick={onNavigateToPos}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 cursor-pointer shadow-xs"
                    >
                      New Sale (POS)
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              sales.map((sale) => {
                const isDue = (sale.dueAmount ?? 0) > 0
                const isPartial = isDue && ((sale.cashPaid ?? 0) > 0 || (sale.digitalPaid ?? 0) > 0)
                const itemsCount = sale.items?.length || 0

                return (
                  <tr
                    key={sale.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => onViewOrder(sale)}
                  >
                    {/* Invoice No */}
                    <td className="py-3.5 px-2 font-mono font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                        <span>#{sale.invoiceNo}</span>
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-2 text-slate-500 tabular-nums">
                      {formatDate(sale.saleDate)}
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {sale.customerName ? sale.customerName[0].toUpperCase() : <User className="w-3 h-3 text-slate-400" />}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 block truncate max-w-[140px]">
                            {sale.customerName || "Walk-in Retail"}
                          </span>
                          {sale.customerPhone && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {sale.customerPhone}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Items & Mode */}
                    <td className="py-3.5 px-2">
                      <span className="text-slate-700 font-medium">
                        {itemsCount} {itemsCount === 1 ? "item" : "items"}
                      </span>
                      {sale.saleMode === "WHOLESALE" && (
                        <span className="ms-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Wholesale
                        </span>
                      )}
                    </td>

                    {/* Total Price */}
                    <td className="py-3.5 px-2 text-right font-bold text-slate-900 tabular-nums">
                      {tk(sale.totalAmount)}
                    </td>

                    {/* Payment Status Badge */}
                    <td className="py-3.5 px-2 text-center">
                      {isDue ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isPartial
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-rose-50 text-rose-800 border-rose-200"
                          }`}
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>{isPartial ? "Partial Due" : "Full Due"}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Paid ({sale.paymentMethod || "Cash"})</span>
                        </span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="py-3.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onViewOrder(sale)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer border border-transparent hover:border-emerald-200"
                        title="View & Print Receipt / Challan"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing <span className="font-semibold text-slate-900">{sales.length}</span> of{" "}
          <span className="font-semibold text-slate-900">{totalElements}</span> orders
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page === 0 || isLoading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer font-semibold"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          <span className="px-2 text-slate-600 font-medium">
            {page + 1} / {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages - 1 || isLoading}
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer font-semibold"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default RecentOrdersTable
