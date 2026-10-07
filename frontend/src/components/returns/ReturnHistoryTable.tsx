import React from "react"
import {
  ScrollText,
  Search,
  Loader2,
  FileText,
  User,
  Eye,
  Printer,
} from "lucide-react"
import type { SaleReturnResponse } from "../../types"
import Pagination from "../ui/Pagination"
import DateRangeFilter, { type DateRange } from "../ui/DateRangeFilter"

export interface ReturnHistoryTableProps {
  recentReturns: SaleReturnResponse[]
  paginatedReturns: SaleReturnResponse[]
  returnsSearch: string
  onSearchChange: (val: string) => void
  returnsDateRange: DateRange
  onDateRangeChange: (r: DateRange) => void
  returnsPage: number
  returnsPageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
  isLoading: boolean
  onSelectDetail: (ret: SaleReturnResponse) => void
  onPrintVoucher: (ret: SaleReturnResponse) => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ReturnHistoryTable({
  recentReturns,
  paginatedReturns,
  returnsSearch,
  onSearchChange,
  returnsDateRange,
  onDateRangeChange,
  returnsPage,
  returnsPageSize,
  onPageChange,
  onPageSizeChange,
  isLoading,
  onSelectDetail,
  onPrintVoucher,
}: ReturnHistoryTableProps) {
  return (
    <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Recent Returns
            </h2>
          </div>
          <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full tabular-nums">
            {recentReturns.length} records
          </span>
        </div>

        {/* Search Box & Date Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={returnsSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search voucher #, customer, or reason..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50/40 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-hidden"
            />
          </div>
          <DateRangeFilter
            value={returnsDateRange}
            onChange={onDateRangeChange}
            compact={true}
          />
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin inline-block mb-1 text-emerald-700 dark:text-emerald-400" />
            <p className="text-xs">Loading returns...</p>
          </div>
        ) : recentReturns.length === 0 ? (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No returns found.</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Try adjusting date range or search query.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {paginatedReturns.map((ret) => (
              <div
                key={ret.id}
                onClick={() => onSelectDetail(ret)}
                className="p-3 bg-white dark:bg-slate-800/60 hover:bg-slate-50/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-300 dark:hover:border-emerald-600/60 rounded-xl transition-all cursor-pointer shadow-2xs group relative"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        {ret.returnNo}
                      </span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          ret.refundType === "DUE_ADJUSTMENT"
                            ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                            : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        }`}
                      >
                        {ret.refundType === "DUE_ADJUSTMENT" ? "Due Adjusted" : "Cash Refund"}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 flex items-center gap-1 truncate">
                      {ret.customerName ? (
                        <>
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{ret.customerName}</span>
                        </>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 italic">Walk-in Cash Return</span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {new Date(ret.returnDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-300 transition-colors">
                      {tk(ret.totalRefundAmount)}
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-1.5">
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center gap-0.5">
                        <Eye className="w-3 h-3" />
                        <span>Details</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onPrintVoucher(ret)
                        }}
                        title="Print 80mm Voucher"
                        className="p-1 rounded text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {ret.reason && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-2 bg-slate-50 dark:bg-slate-900/60 group-hover:bg-white dark:group-hover:bg-slate-900 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700/60 truncate">
                    Note: {ret.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
        <Pagination
          page={returnsPage}
          pageSize={returnsPageSize}
          totalElements={recentReturns.length}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={[4, 6, 10, 20]}
          itemLabel="returns"
        />
      </div>
    </div>
  )
}
