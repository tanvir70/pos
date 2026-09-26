import React, { useState, useEffect } from "react"
import type { TopSellingProduct, PagedResponse } from "../../types"
import { getTopSellingProducts } from "../../api/endpoints"
import { Package, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../ui/Card"
import Badge from "../ui/Badge"
import Button from "../ui/Button"
import { Separator } from "../ui/separator"

export interface TopSellingProductsProps {
  onProductClick?: (productId: number) => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const TopSellingProducts: React.FC<TopSellingProductsProps> = ({ onProductClick }) => {
  const [period, setPeriod] = useState<"month" | "week" | "all">("month")
  const [page, setPage] = useState<number>(0)
  const [pagedData, setPagedData] = useState<PagedResponse<TopSellingProduct> | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const pageSize = 10

  const handlePeriodChange = (newPeriod: "month" | "week" | "all") => {
    setPeriod(newPeriod)
    setPage(0)
  }

  useEffect(() => {
    let isMounted = true
    const loadData = async () => {
      try {
        setIsLoading(true)
        const data = await getTopSellingProducts(period === "all" ? "year" : period, page, pageSize)
        if (isMounted) {
          setPagedData(data)
        }
      } catch (err) {
        console.error("Failed to load top selling products:", err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }
    loadData()
    return () => {
      isMounted = false
    }
  }, [period, page])

  const products = pagedData?.content || []

  return (
    <Card className="rounded-2xl border-slate-200/90 shadow-xs flex flex-col justify-between h-full overflow-hidden">
      {/* Card Header */}
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-slate-900">
                Top Selling Products
              </CardTitle>
            </div>
          </div>

          {/* Period Selector Tabs */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold text-slate-600">
            {(["week", "month", "all"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handlePeriodChange(t)}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer capitalize text-xs ${
                  period === t
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {t === "week" ? "Week" : t === "month" ? "Month" : "All"}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <Separator />

      {/* Product List Content */}
      <CardContent className="p-5 flex-1 min-h-[320px]">
        {isLoading ? (
          <div className="space-y-3 py-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="w-3/4 h-3 bg-slate-100 rounded" />
                  <div className="w-1/2 h-2.5 bg-slate-50 rounded" />
                </div>
                <div className="w-14 h-4 bg-slate-100 rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <Package className="w-8 h-8 stroke-1 text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-600">No sale records in this timeframe</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Top selling items will populate as orders are completed</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {products.map((item, idx) => (
              <div
                key={item.productId || idx}
                onClick={() => onProductClick?.(item.productId)}
                className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 group cursor-pointer hover:bg-slate-50/70 -mx-2 px-2 rounded-xl transition-colors"
              >
                {/* Product thumbnail/rank */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-emerald-50 text-slate-600 group-hover:text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs transition-colors border border-slate-200/60">
                    <span className="tabular-nums">#{page * pageSize + idx + 1}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                      {item.nameEn || item.nameBn}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                      <span className="font-mono text-slate-500">{item.productCode}</span>
                      <span>•</span>
                      {item.percentageShare ? (
                        <Badge variant="emerald" className="text-[10px] px-1.5 py-0">
                          {item.percentageShare}% share
                        </Badge>
                      ) : (
                        <span className="text-slate-500">{item.unit}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sales & Revenue */}
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-slate-900 tabular-nums block">
                    {item.totalQuantity} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {tk(item.totalRevenue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Pagination Footer */}
      {pagedData && pagedData.totalElements > 0 && (
        <>
          <Separator />
          <CardFooter className="p-4 py-3 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px] text-slate-500">
              Showing <span className="font-semibold text-slate-900">{products.length}</span> of{" "}
              <span className="font-semibold text-slate-900">{pagedData.totalElements}</span> items
            </span>

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

              <span className="px-2 text-slate-600 font-medium text-xs tabular-nums">
                {page + 1} / {pagedData.totalPages || 1}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= (pagedData.totalPages || 1) - 1 || isLoading}
                onClick={() => setPage((p) => p + 1)}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                className="h-7 text-xs font-semibold cursor-pointer"
              >
                Next
              </Button>
            </div>
          </CardFooter>
        </>
      )}
    </Card>
  )
}

export default TopSellingProducts
