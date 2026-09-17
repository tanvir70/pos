import { useState, useEffect, useMemo, useCallback } from "react"
import type { StockItem, Product } from "../types"
import { getStock, getProducts } from "../api/endpoints"
import LotEntryModal from "../components/LotEntryModal"
import StockTransferModal from "../components/StockTransferModal"
import BarcodeStickerModal from "../components/BarcodeStickerModal"

// BUSINESS DECISION: Godown warehouse lots display carton breakdown equivalents (cartons + loose)
// alongside base unit counts to enable instant physical pallet counts during warehouse audits.
// Expiry warnings enforce FEFO discipline with tiered color badges (<30 days red, <90 days amber).
// Purchase costs are strictly masked when Cashier Mode is active.

export interface GodownProps {
  isOwner: boolean
}

export default function Godown({ isOwner }: GodownProps) {
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filters & Search
  const [search, setSearch] = useState<string>("")
  const [expiryFilter, setExpiryFilter] = useState<"ALL" | "EXPIRING_30" | "EXPIRING_90">("ALL")
  const [onlyPositiveStock, setOnlyPositiveStock] = useState<boolean>(false)

  // Modals state
  const [isLotEntryOpen, setIsLotEntryOpen] = useState<boolean>(false)
  const [isTransferOpen, setIsTransferOpen] = useState<boolean>(false)
  const [transferInitialLotId, setTransferInitialLotId] = useState<number | undefined>(undefined)
  const [stickerItem, setStickerItem] = useState<StockItem | null>(null)
  const [isStickerOpen, setIsStickerOpen] = useState<boolean>(false)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const [stockData, productData] = await Promise.all([
        getStock(),
        getProducts(),
      ])
      setStocks(stockData)
      setProducts(productData)
    } catch (err: any) {
      setErrorMessage(
        err?.message || "গুদাম তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।",
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Helper to calculate days until expiry
  const getDaysUntilExpiry = (expiryDateStr: string) => {
    if (!expiryDateStr) return 9999
    const expiry = new Date(expiryDateStr)
    const today = new Date()
    const diffTime = expiry.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Summary figures
  const totalGodownUnits = useMemo(() => {
    return stocks.reduce((sum, s) => sum + (Number(s.godownQuantity) || 0), 0)
  }, [stocks])

  const expiring30Count = useMemo(() => {
    return stocks.filter((s) => {
      const days = getDaysUntilExpiry(s.expiryDate)
      return days <= 30 && (Number(s.godownQuantity) || 0) > 0
    }).length
  }, [stocks])

  const expiring90Count = useMemo(() => {
    return stocks.filter((s) => {
      const days = getDaysUntilExpiry(s.expiryDate)
      return days <= 90 && (Number(s.godownQuantity) || 0) > 0
    }).length
  }, [stocks])

  const totalGodownValuation = useMemo(() => {
    return stocks.reduce(
      (sum, s) => sum + (Number(s.godownQuantity) || 0) * (s.purchaseCost || 0),
      0,
    )
  }, [stocks])

  // Filtered lots
  const filteredStocks = useMemo(() => {
    return stocks.filter((lot) => {
      // Search
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const nameBn = (lot.productNameBn || lot.nameBn || "").toLowerCase()
        const nameEn = (lot.productNameEn || lot.nameEn || "").toLowerCase()
        const lotNo = (lot.lotNumber || "").toLowerCase()
        const code = (lot.productCode || "").toLowerCase()
        const barcode = (lot.barcode || lot.lotBarcode || "").toLowerCase()

        if (
          !nameBn.includes(search.trim()) &&
          !nameEn.includes(q) &&
          !lotNo.includes(q) &&
          !code.includes(q) &&
          !barcode.includes(q)
        ) {
          return false
        }
      }

      // Expiry filter
      const days = getDaysUntilExpiry(lot.expiryDate)
      if (expiryFilter === "EXPIRING_30" && days > 30) {
        return false
      }
      if (expiryFilter === "EXPIRING_90" && days > 90) {
        return false
      }

      // Positive stock in Godown
      if (onlyPositiveStock && (Number(lot.godownQuantity) || 0) <= 0) {
        return false
      }

      return true
    })
  }, [stocks, search, expiryFilter, onlyPositiveStock])

  const openTransferModal = (lotId?: number) => {
    setTransferInitialLotId(lotId)
    setIsTransferOpen(true)
  }

  const openStickerModal = (item: StockItem) => {
    setStickerItem(item)
    setIsStickerOpen(true)
  }

  return (
    <div className="space-y-5">
      {/* Page Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-frost-dark bn-text flex items-center gap-2">
            <span>🏭</span>
            <span>গুদাম ও চালান ব্যবস্থাপনা (Godown &amp; Lot Logistics)</span>
          </h1>
          <p className="text-xs text-frost-muted mt-0.5 bn-text">
            সিনজেনটা চালানের আগমন এন্ট্রি, ব্যাচ ট্র্যাকিং, মেয়াদ পর্যবেক্ষণ এবং
            দোকানে স্টক স্থানান্তর
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsLotEntryOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer bn-text"
          >
            <span>➕</span>
            <span>নতুন চালান / লট এন্ট্রি</span>
          </button>

          <button
            onClick={() => openTransferModal()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-700 text-white hover:bg-blue-800 transition-colors shadow-xs cursor-pointer bn-text"
          >
            <span>🔄</span>
            <span>দোকানে স্টক স্থানান্তর</span>
          </button>

          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="p-2 rounded-xl text-xs font-semibold bg-white border border-frost-border text-frost-dark hover:bg-frost-hover cursor-pointer transition-colors shadow-xs"
            title="রিফ্রেশ করুন"
          >
            <span className={isLoading ? "animate-spin" : ""}>🔄</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-frost-border rounded-xl p-4 shadow-xs">
          <p className="text-xs font-medium text-frost-muted bn-text">
            মোট গুদাম লট সংখ্যা
          </p>
          <p className="text-2xl font-black text-frost-dark tabular-nums mt-1">
            {stocks.length}{" "}
            <span className="text-xs font-normal text-frost-muted">টি লট</span>
          </p>
        </div>

        <div className="bg-white border border-frost-border rounded-xl p-4 shadow-xs">
          <p className="text-xs font-medium text-frost-muted bn-text">
            গুদামে মোট ইউনিট ব্যালেন্স
          </p>
          <p className="text-2xl font-black text-blue-700 tabular-nums mt-1">
            {totalGodownUnits.toLocaleString("en-IN")}{" "}
            <span className="text-xs font-normal text-frost-muted">ইউনিট</span>
          </p>
        </div>

        <div
          onClick={() =>
            setExpiryFilter((prev) => (prev === "EXPIRING_30" ? "ALL" : "EXPIRING_30"))
          }
          className={`border rounded-xl p-4 shadow-xs cursor-pointer transition-all ${
            expiring30Count > 0
              ? "bg-red-50/70 border-red-300 hover:bg-red-100/70"
              : "bg-white border-frost-border"
          }`}
          title="ক্লিক করলে ৩০ দিনের মধ্যে মেয়াদোত্তীর্ণ লট ফিল্টার হবে"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-frost-muted bn-text">
              শীঘ্রই মেয়াদ উত্তীর্ণ (&lt;৩০ দিন)
            </p>
            {expiryFilter === "EXPIRING_30" && (
              <span className="text-[10px] bg-red-200 text-red-900 px-1.5 py-0.5 rounded font-bold bn-text">
                সক্রিয়
              </span>
            )}
          </div>
          <p
            className={`text-2xl font-black tabular-nums mt-1 ${
              expiring30Count > 0 ? "text-red-600" : "text-frost-dark"
            }`}
          >
            {expiring30Count}{" "}
            <span className="text-xs font-normal text-frost-muted">লট</span>
          </p>
        </div>

        <div className="bg-white border border-frost-border rounded-xl p-4 shadow-xs">
          <p className="text-xs font-medium text-frost-muted bn-text">
            গুদাম মজুদ পণ্যের ক্রয়মূল্য
          </p>
          <p className="text-2xl font-black text-frost-dark tabular-nums mt-1">
            {isOwner ? (
              `৳${totalGodownValuation.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
            ) : (
              <span className="text-sm font-bold text-frost-muted">
                🔒 মালিকের পিন দরকার
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white border border-frost-border rounded-xl p-3 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-2.5 text-frost-muted text-base">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="পণ্যের নাম, লট নম্বর, চালানের রেফারেন্স বা বারকোড দিয়ে খুঁজুন..."
              className="w-full bg-frost-surface border border-frost-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-frost-dark placeholder-frost-muted focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all bn-text"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5 text-frost-muted hover:text-frost-dark text-xs p-0.5"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() =>
                setOnlyPositiveStock((prev) => !prev)
              }
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer bn-text ${
                onlyPositiveStock
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "bg-frost-surface text-frost-muted hover:bg-frost-hover"
              }`}
            >
              {onlyPositiveStock ? "✓ শুধু গুদাম স্টক আছে" : "সব লট (শূন্য স্টকসহ)"}
            </button>
          </div>
        </div>

        {/* Expiry Quick Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-bold text-frost-muted bn-text whitespace-nowrap">
            মেয়াদ ফিল্টার:
          </span>
          <button
            onClick={() => setExpiryFilter("ALL")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer bn-text transition-all ${
              expiryFilter === "ALL"
                ? "bg-frost-dark text-white"
                : "bg-frost-surface text-frost-muted hover:bg-frost-hover"
            }`}
          >
            সকল লট
          </button>
          <button
            onClick={() => setExpiryFilter("EXPIRING_30")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer bn-text transition-all ${
              expiryFilter === "EXPIRING_30"
                ? "bg-red-600 text-white"
                : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
            }`}
          >
            🚨 শীঘ্রই মেয়াদোত্তীর্ণ (&lt;৩০ দিন) ({expiring30Count})
          </button>
          <button
            onClick={() => setExpiryFilter("EXPIRING_90")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer bn-text transition-all ${
              expiryFilter === "EXPIRING_90"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
            }`}
          >
            ⚠️ ৩ মাসের মধ্যে মেয়াদোত্তীর্ণ (&lt;৯০ দিন) ({expiring90Count})
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold bn-text flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => loadData()}
            className="underline font-bold hover:text-red-900"
          >
            পুনরায় চেষ্টা করুন
          </button>
        </div>
      )}

      {/* Warehouse Lots Table */}
      <div className="bg-white border border-frost-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-frost-surface border-b border-frost-border text-frost-muted">
                <th className="px-4 py-3 font-bold bn-text">
                  পণ্য (Product &amp; Category)
                </th>
                <th className="px-3 py-3 font-bold bn-text">লট নম্বর (Lot No)</th>
                <th className="px-3 py-3 font-bold bn-text hidden md:table-cell">
                  চালান আসার তারিখ
                </th>
                <th className="px-3 py-3 font-bold bn-text">মেয়াদ (Expiry Date)</th>
                {isOwner && (
                  <th className="px-3 py-3 font-bold bn-text text-right text-emerald-800">
                    কেনা দাম
                  </th>
                )}
                <th className="px-3 py-3 font-bold bn-text text-right">
                  🏭 গুদাম স্টক (Cartons)
                </th>
                <th className="px-3 py-3 font-bold bn-text text-right">
                  🏪 দোকান ব্যালেন্স
                </th>
                <th className="px-3 py-3 font-bold bn-text text-center hidden lg:table-cell">
                  বারকোড
                </th>
                <th className="px-4 py-3 font-bold bn-text text-center">
                  অ্যাকশন
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-frost-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={isOwner ? 9 : 8} className="py-12 text-center text-frost-muted">
                    <span className="text-xl animate-spin inline-block">⏳</span>
                    <p className="mt-2 text-xs bn-text">গুদাম লট লোড হচ্ছে...</p>
                  </td>
                </tr>
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 9 : 8} className="py-12 text-center text-frost-muted">
                    <span className="text-3xl">📦</span>
                    <p className="mt-2 text-sm font-semibold bn-text">
                      কোনো গুদাম লট পাওয়া যায়নি
                    </p>
                    <p className="text-xs text-frost-muted/70 mt-0.5">
                      উপরে &quot;নতুন চালান / লট এন্ট্রি&quot; বাটনে ক্লিক করে নতুন চালান যোগ করুন
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStocks.map((lot) => {
                  const days = getDaysUntilExpiry(lot.expiryDate)
                  const isCritical = days <= 30
                  const isWarning = days > 30 && days <= 90

                  const mult = Number(lot.cartonMultiplier) || 1
                  const godownQty = Number(lot.godownQuantity) || 0
                  const dokanQty = Number(lot.dokanQuantity) || 0

                  const godownCartons = Math.floor(godownQty / mult)
                  const godownLoose = godownQty % mult

                  const barcode = lot.barcode || lot.lotBarcode || lot.defaultBarcode || ""

                  return (
                    <tr
                      key={lot.lotId}
                      className={`hover:bg-frost-surface/60 transition-colors ${
                        isCritical && godownQty > 0
                          ? "bg-red-50/40"
                          : isWarning && godownQty > 0
                            ? "bg-amber-50/30"
                            : ""
                      }`}
                    >
                      {/* Product Name */}
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold text-sm text-frost-dark bn-text leading-tight">
                          {lot.productNameBn || lot.nameBn}
                        </div>
                        <div className="text-[11px] text-frost-muted leading-tight mt-0.5">
                          {lot.productNameEn || lot.nameEn}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="px-1.5 py-0.2 rounded bg-frost-surface border border-frost-border text-[10px] font-mono text-frost-muted">
                            {lot.productCode}
                          </span>
                          <span className="text-[10px] text-frost-muted bn-text">
                            {lot.category}
                          </span>
                        </div>
                      </td>

                      {/* Lot Number */}
                      <td className="px-3 py-3 align-top">
                        <span className="font-mono font-bold text-frost-dark text-xs px-2 py-0.5 bg-frost-surface rounded border border-frost-border">
                          {lot.lotNumber}
                        </span>
                      </td>

                      {/* Entry Date */}
                      <td className="px-3 py-3 align-top hidden md:table-cell text-frost-muted font-mono">
                        {lot.entryDate || "—"}
                      </td>

                      {/* Expiry Date */}
                      <td className="px-3 py-3 align-top">
                        <div className="font-mono font-semibold text-frost-dark text-xs">
                          {lot.expiryDate}
                        </div>
                        {isCritical ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-700 bg-red-100 border border-red-300 px-1.5 py-0.2 rounded mt-0.5 bn-text">
                            🚨 {days} দিন বাকি (FEFO)
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded mt-0.5 bn-text">
                            ⚠️ {days} দিন বাকি
                          </span>
                        ) : (
                          <span className="text-[10px] text-frost-muted font-mono">
                            ({days} দিন)
                          </span>
                        )}
                      </td>

                      {/* Purchase Cost (Owner Only) */}
                      {isOwner && (
                        <td className="px-3 py-3 align-top text-right font-bold tabular-nums text-emerald-800">
                          ৳{lot.purchaseCost}
                        </td>
                      )}

                      {/* Godown Stock with Carton Breakdown */}
                      <td className="px-3 py-3 align-top text-right">
                        <div className="font-black tabular-nums text-sm text-blue-900">
                          {godownQty}{" "}
                          <span className="text-[11px] font-normal text-frost-muted">
                            {lot.baseUnit}
                          </span>
                        </div>
                        {mult > 1 && (
                          <div className="text-[10px] text-blue-700 font-semibold bn-text mt-0.5">
                            ({godownCartons} কার্টন + {godownLoose} loose)
                          </div>
                        )}
                      </td>

                      {/* Dokan Stock */}
                      <td className="px-3 py-3 align-top text-right">
                        <span className="font-bold tabular-nums text-sm text-frost-dark">
                          {dokanQty}
                        </span>
                        <span className="text-[10px] text-frost-muted ml-1">
                          {lot.baseUnit}
                        </span>
                      </td>

                      {/* Barcode */}
                      <td className="px-3 py-3 align-top text-center hidden lg:table-cell">
                        <span className="font-mono text-[10px] text-frost-muted bg-frost-surface px-1.5 py-0.5 rounded border border-frost-border">
                          {barcode}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 align-top text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => openTransferModal(lot.lotId)}
                            disabled={godownQty <= 0}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bn-text"
                            title="দোকানে স্থানান্তর করুন"
                          >
                            <span>🔄</span>
                            <span className="ml-1">দোকানে পাঠান</span>
                          </button>

                          <button
                            onClick={() => openStickerModal(lot)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer bn-text"
                            title="বারকোড স্টিকার প্রিন্ট করুন"
                          >
                            <span>🏷️</span>
                            <span className="ml-1">স্টিকার</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lot Entry Modal */}
      <LotEntryModal
        products={products}
        isOpen={isLotEntryOpen}
        onClose={() => setIsLotEntryOpen(false)}
        onSuccess={() => {
          loadData()
        }}
      />

      {/* Stock Transfer Modal */}
      <StockTransferModal
        stockItems={stocks}
        initialLotId={transferInitialLotId}
        isOpen={isTransferOpen}
        onClose={() => {
          setIsTransferOpen(false)
          setTransferInitialLotId(undefined)
        }}
        onSuccess={() => {
          loadData()
        }}
      />

      {/* Barcode Sticker Modal */}
      <BarcodeStickerModal
        item={stickerItem}
        isOpen={isStickerOpen}
        onClose={() => {
          setIsStickerOpen(false)
          setStickerItem(null)
        }}
      />
    </div>
  )
}
