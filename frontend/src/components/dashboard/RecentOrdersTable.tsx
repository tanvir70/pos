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
  AlertCircle,
  ShoppingBag,
} from "lucide-react"
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableEmptyState,
} from "../ui/Table"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "../ui/Card"
import Badge from "../ui/Badge"
import Button from "../ui/Button"
import { Separator } from "../ui/separator"

export interface RecentOrdersTableProps {
  onViewOrder?: (sale: SaleResponse) => void
  onViewDetails?: (sale: SaleResponse) => void
  onPrintReceipt?: (sale: SaleResponse) => void
  onNavigateToPos?: () => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatQuantity = (n: number) =>
  Number.isInteger(n)
    ? n.toLocaleString("en-IN")
    : n.toLocaleString("en-IN", { maximumFractionDigits: 3 })

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
  onViewDetails,
  onPrintReceipt,
  onNavigateToPos,
}) => {
  const handleViewDetails = onViewDetails || onViewOrder || (() => {})
  const handlePrintReceipt = onPrintReceipt || onViewOrder || (() => {})
  
  // Filter state
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("today")
  const [saleMode, setSaleMode] = useState<"ALL" | "WHOLESALE" | "RETAIL">("ALL")
  const [page, setPage] = useState<number>(0)
  const pageSize = 10

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
    <Card className="rounded-2xl border-slate-200/90 shadow-xs flex flex-col justify-between overflow-hidden">
      {/* Card Header & Controls */}
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
              Recent Orders
            </CardTitle>
            <Badge variant="outline" className="font-mono text-[11px] font-bold text-slate-700 bg-slate-50">
              {totalElements} total
            </Badge>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Timeframe selector */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold text-slate-600">
              {(["today", "week", "month", "all"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTabChange(t)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer capitalize text-xs ${
                    period === t
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {t === "today" ? "Today" : t === "week" ? "This Week" : t === "month" ? "This Month" : "All"}
                </button>
              ))}
            </div>

            {/* Wholesale filter pill */}
            <Button
              type="button"
              variant={saleMode === "WHOLESALE" ? "primary" : "outline"}
              size="sm"
              onClick={() => handleModeToggle(saleMode === "WHOLESALE" ? "ALL" : "WHOLESALE")}
              className={`h-7 px-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                saleMode === "WHOLESALE"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white border-transparent"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {saleMode === "WHOLESALE" ? "✓ Wholesale Only" : "Wholesale"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <Separator />

      {/* Table Content */}
      <CardContent className="p-0 overflow-x-auto min-h-[420px]">
        <Table className="whitespace-nowrap border-0 shadow-none rounded-none">
          <TableHeader>
            <TableRow className="border-b border-slate-100 hover:bg-transparent">
              <TableHead className="py-3 px-3">Order ID</TableHead>
              <TableHead className="py-3 px-3">Date & Time</TableHead>
              <TableHead className="py-3 px-3">Customer</TableHead>
              <TableHead align="center" className="py-3 px-3">Items</TableHead>
              <TableHead align="center" className="py-3 px-3">Qty</TableHead>
              <TableHead align="right" className="py-3 px-3">Total Amount</TableHead>
              <TableHead align="center" className="py-3 px-3">Payment Status</TableHead>
              <TableHead align="center" className="py-3 px-3">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton rows
              [...Array(pageSize)].map((_, i) => (
                <TableRow key={i} className="animate-pulse">
                  <TableCell className="py-3.5 px-3">
                    <div className="w-24 h-4 bg-slate-100 rounded" />
                  </TableCell>
                  <TableCell className="py-3.5 px-3">
                    <div className="w-20 h-4 bg-slate-100 rounded" />
                  </TableCell>
                  <TableCell className="py-3.5 px-3">
                    <div className="w-28 h-4 bg-slate-100 rounded" />
                  </TableCell>
                  <TableCell align="center" className="py-3.5 px-3">
                    <div className="w-8 h-4 bg-slate-100 rounded mx-auto" />
                  </TableCell>
                  <TableCell align="center" className="py-3.5 px-3">
                    <div className="w-10 h-4 bg-slate-100 rounded mx-auto" />
                  </TableCell>
                  <TableCell align="right" className="py-3.5 px-3">
                    <div className="w-16 h-4 bg-slate-100 rounded ml-auto" />
                  </TableCell>
                  <TableCell align="center" className="py-3.5 px-3">
                    <div className="w-14 h-4 bg-slate-100 rounded mx-auto" />
                  </TableCell>
                  <TableCell align="center" className="py-3.5 px-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg mx-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : sales.length === 0 ? (
              <TableEmptyState
                colSpan={8}
                icon={<ShoppingBag className="w-8 h-8 stroke-1 text-slate-300 mx-auto" />}
                message="No orders found in this selection"
                submessage="Try selecting a different timeframe or record a new sale in POS Counter"
                action={
                  onNavigateToPos ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={onNavigateToPos}
                      className="cursor-pointer"
                    >
                      New Sale (POS)
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              sales.map((sale) => {
                const isDue = (sale.dueAmount ?? 0) > 0
                const isPartial = isDue && ((sale.cashPaid ?? 0) > 0 || (sale.digitalPaid ?? 0) > 0)
                const itemsCount = sale.items?.length || 0
                const unitsCount =
                  sale.items?.reduce((sum, item) => sum + (Number(item.totalQuantity) || 0), 0) || 0

                return (
                  <TableRow
                    key={sale.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => handleViewDetails(sale)}
                  >
                    {/* Invoice No & Mode */}
                    <TableCell className="py-3.5 px-3 font-mono font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewDetails(sale)
                          }}
                          className="flex items-center gap-1 hover:underline cursor-pointer"
                          title="View order details"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                          <span>#{sale.invoiceNo}</span>
                        </button>
                        {sale.saleMode === "WHOLESALE" && (
                          <Badge variant="purple" className="text-[10px] px-1.5 py-0">
                            Wholesale
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Date */}
                    <TableCell className="py-3.5 px-3 text-slate-500 tabular-nums">
                      {formatDate(sale.saleDate)}
                    </TableCell>

                    {/* Customer */}
                    <TableCell className="py-3.5 px-3">
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
                    </TableCell>

                    {/* Items count */}
                    <TableCell align="center" isMonospace className="py-3.5 px-3 text-slate-800">
                      {itemsCount}
                    </TableCell>

                    {/* Total Quantity */}
                    <TableCell align="center" isMonospace className="py-3.5 px-3 text-slate-900">
                      {formatQuantity(unitsCount)}
                    </TableCell>

                    {/* Total Price */}
                    <TableCell align="right" className="py-3.5 px-3 font-bold text-slate-900 tabular-nums">
                      {tk(sale.totalAmount)}
                    </TableCell>

                    {/* Payment Status Badge */}
                    <TableCell align="center" className="py-3.5 px-3">
                      {isDue ? (
                        <Badge
                          variant={isPartial ? "warning" : "danger"}
                          className="inline-flex items-center gap-1 text-[10px]"
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>{isPartial ? "Partial Due" : "Full Due"}</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="success"
                          className="inline-flex items-center gap-1 text-[10px]"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Paid ({sale.paymentMethod || "Cash"})</span>
                        </Badge>
                      )}
                    </TableCell>

                    {/* Action Button */}
                    <TableCell align="center" className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePrintReceipt(sale)}
                        className="h-8 w-8 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                        title="Print Receipt / Challan"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Separator />

      {/* Pagination Footer */}
      <CardFooter className="p-4 py-3 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing <span className="font-semibold text-slate-900">{sales.length}</span> of{" "}
          <span className="font-semibold text-slate-900">{totalElements}</span> orders
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === 0 || isLoading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            className="h-7 text-xs font-semibold cursor-pointer"
          >
            Prev
          </Button>

          <span className="px-2 text-slate-600 font-medium tabular-nums">
            {page + 1} / {totalPages}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1 || isLoading}
            onClick={() => setPage((p) => p + 1)}
            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            className="h-7 text-xs font-semibold cursor-pointer"
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

export default RecentOrdersTable
