import { useState, useMemo, useRef, useEffect } from "react"
import type { StockItem, SaleMode } from "../../types"
import { formatTk } from "../../utils/currency"
import Input from "../ui/Input"
import Badge from "../ui/Badge"

export interface ProductCatalogGridProps {
  stocks: StockItem[]
  isLoading?: boolean
  onAddToCart: (stock: StockItem) => void
  saleMode: SaleMode
  isOwner?: boolean
}

export default function ProductCatalogGrid({
  stocks,
  isLoading = false,
  onAddToCart,
  saleMode,
  isOwner = false,
}: ProductCatalogGridProps) {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL")
  const [stockFilter, setStockFilter] = useState<"ALL" | "IN_STOCK" | "LOW_STOCK">("ALL")
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Hotkey F2 to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>()
    stocks.forEach((s) => {
      if (s.category) set.add(s.category.trim())
    })
    return Array.from(set).sort()
  }, [stocks])

  // Filtered stocks
  const filteredStocks = useMemo(() => {
    const q = search.trim().toLowerCase()

    return stocks.filter((item) => {
      // Category filter
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false
      }

      // Stock status filter
      const available = item.quantity ?? (item as any).totalQuantity ?? 0
      const minAlert = item.minStockAlert ?? 5
      if (stockFilter === "IN_STOCK" && available <= 0) return false
      if (stockFilter === "LOW_STOCK" && (available > minAlert || available <= 0)) return false

      // Text query match
      if (!q) return true

      const code = (item.productCode || "").toLowerCase()
      const nameEn = (item.productNameEn || item.nameEn || "").toLowerCase()
      const nameBn = (item.productNameBn || item.nameBn || "").toLowerCase()
      const lotNum = ((item as any).lotNumber || "").toLowerCase()
      const barcode = (
        (item as any).lotBarcode ||
        (item as any).barcode ||
        item.defaultBarcode ||
        ""
      ).toLowerCase()

      return (
        code.includes(q) ||
        nameEn.includes(q) ||
        nameBn.includes(q) ||
        lotNum.includes(q) ||
        barcode.includes(q)
      )
    })
  }, [stocks, search, selectedCategory, stockFilter])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const q = search.trim().toLowerCase()
      if (!q) return

      // Exact barcode / product code match takes immediate precedence
      const exactMatch = stocks.find(
        (s) =>
          ((s as any).lotBarcode && (s as any).lotBarcode.toLowerCase() === q) ||
          ((s as any).barcode && (s as any).barcode.toLowerCase() === q) ||
          (s.defaultBarcode && s.defaultBarcode.toLowerCase() === q) ||
          (s.productCode && s.productCode.toLowerCase() === q),
      )

      if (exactMatch) {
        onAddToCart(exactMatch)
        setSearch("")
        return
      }

      // If exactly 1 result in filtered list, add it
      if (filteredStocks.length === 1) {
        onAddToCart(filteredStocks[0])
        setSearch("")
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-frost-border shadow-xs overflow-hidden">
      {/* Search & Filter Header */}
      <div className="p-3.5 border-b border-frost-border/60 bg-frost-surface/30 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onClear={() => setSearch("")}
              placeholder="পণ্য বা বারকোড স্ক্যান করুন... (F2 দিয়ে খুঁজুন)"
              leftAdornment={<span className="text-frost-muted">🔍</span>}
              inputSize="md"
              className="bg-white shadow-xs"
            />
          </div>
          <div className="hidden sm:flex items-center gap-1.5 shrink-0 text-xs text-frost-muted font-medium bg-white px-2.5 py-2 border border-frost-border rounded-xl shadow-xs">
            <span className="font-mono text-emerald-800 font-bold bg-emerald-50 px-1 rounded border border-emerald-200">
              F2
            </span>
            <span className="bn-text">সার্চ</span>
          </div>
        </div>

        {/* Category & Status Pills */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pt-0.5">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer bn-text ${
                selectedCategory === "ALL"
                  ? "bg-frost-dark text-white shadow-xs"
                  : "bg-white text-frost-dark border border-frost-border hover:bg-frost-hover"
              }`}
            >
              সব ক্যাটাগরি ({stocks.length})
            </button>
            {categories.map((cat) => {
              const count = stocks.filter((s) => s.category === cat).length
              const isSelected = selectedCategory === cat
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap bn-text ${
                    isSelected
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "bg-white text-frost-dark border border-frost-border hover:bg-frost-hover"
                  }`}
                >
                  {cat} ({count})
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1 shrink-0 border-l border-frost-border/60 pl-2">
            <button
              type="button"
              onClick={() =>
                setStockFilter((prev) => (prev === "IN_STOCK" ? "ALL" : "IN_STOCK"))
              }
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer bn-text ${
                stockFilter === "IN_STOCK"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "text-frost-muted hover:bg-white"
              }`}
            >
              মজুদ আছে
            </button>
            <button
              type="button"
              onClick={() =>
                setStockFilter((prev) => (prev === "LOW_STOCK" ? "ALL" : "LOW_STOCK"))
              }
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer bn-text ${
                stockFilter === "LOW_STOCK"
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "text-frost-muted hover:bg-white"
              }`}
            >
              কম স্টক
            </button>
          </div>
        </div>
      </div>

      {/* Catalog Grid Body */}
      <div className="flex-1 p-3 overflow-y-auto">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-frost-muted gap-2">
            <span className="text-3xl animate-spin">⏳</span>
            <p className="text-xs font-semibold bn-text">পণ্য তালিকা লোড হচ্ছে...</p>
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-frost-muted gap-2 text-center p-6">
            <span className="text-4xl">🌾</span>
            <p className="text-sm font-bold text-frost-dark bn-text">
              কোনো পণ্য পাওয়া যায়নি
            </p>
            <p className="text-xs text-frost-muted bn-text">
              অনুসন্ধান ফিল্টার পরিবর্তন করুন অথবা নতুন পণ্য যুক্ত করুন।
            </p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-2 text-xs text-emerald-700 font-bold hover:underline cursor-pointer bn-text"
              >
                অনুসন্ধান মুছুন
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {filteredStocks.map((item) => {
              const available =
                item.quantity ?? (item as any).totalQuantity ?? 0
              const minAlert = item.minStockAlert ?? 5
              const activePrice =
                saleMode === "RETAIL"
                  ? (item as any).lotRetailPrice ?? item.standardRetailPrice ?? 0
                  : (item as any).lotWholesalePrice ?? item.standardWholesalePrice ?? 0
              const purchaseCost = (item as any).purchaseCost ?? 0

              const isLowStock = available > 0 && available <= minAlert
              const isOutOfStock = available <= 0

              return (
                <div
                  key={`${item.productId}-${(item as any).lotId ?? "def"}`}
                  onClick={() => onAddToCart(item)}
                  className="group flex flex-col justify-between p-3 rounded-xl border border-frost-border bg-white hover:border-emerald-500 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden"
                >
                  {/* Category Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-600 group-hover:h-1.5 transition-all" />

                  {/* Top Product Info */}
                  <div className="pt-1">
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <span className="font-mono text-[10px] font-bold text-frost-muted tracking-tight truncate">
                        {item.productCode}
                      </span>
                      {item.category && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 bn-text truncate max-w-[90px]">
                          {item.category}
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-frost-dark group-hover:text-emerald-800 bn-text leading-snug line-clamp-2 transition-colors">
                      {item.productNameBn || item.nameBn}
                    </h4>
                    <p className="text-[11px] text-frost-muted truncate mt-0.5">
                      {item.productNameEn || item.nameEn}
                    </p>

                    {/* Expiry Date (if available) */}
                    {(item as any).expiryDate && (
                      <p className="text-[10px] text-frost-muted bn-text mt-1">
                        মেয়াদ: <span className="font-mono">{(item as any).expiryDate}</span>
                      </p>
                    )}
                  </div>

                  {/* Bottom Stock & Price Footer */}
                  <div className="mt-3 pt-2.5 border-t border-frost-border/60 flex items-end justify-between gap-1">
                    <div>
                      {isOutOfStock ? (
                        <Badge variant="danger" size="sm" dot>
                          স্টক শূন্য ({available})
                        </Badge>
                      ) : isLowStock ? (
                        <Badge variant="warning" size="sm" dot>
                          কম স্টক: {available} {item.baseUnit || ""}
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm">
                          স্টক: {available} {item.baseUnit || ""}
                        </Badge>
                      )}

                      {/* Owner Mode: Purchase Cost Hint */}
                      {isOwner && purchaseCost > 0 && (
                        <div className="text-[10px] text-amber-700 font-semibold bn-text mt-1">
                          কেনা: {formatTk(purchaseCost)}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-emerald-800 font-mono tabular-nums leading-tight">
                        {formatTk(activePrice)}
                      </div>
                      <span className="text-[10px] text-frost-muted bn-text font-medium">
                        {saleMode === "RETAIL" ? "খুচরা দর" : "পাইকারি দর"}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
