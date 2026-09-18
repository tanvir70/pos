import { useState, useMemo, useRef, useEffect } from "react"
import {
  Search,
  Loader2,
  Wheat,
  RefreshCw,
  Maximize2,
  Minimize2,
} from "lucide-react"
import type { StockItem, SaleMode } from "../../types"
import { formatTk } from "../../utils/currency"
import Input from "../ui/Input"

export interface ProductCatalogGridProps {
  stocks: StockItem[]
  isLoading?: boolean
  onAddToCart: (stock: StockItem) => void
  saleMode: SaleMode
  onToggleSaleMode: (mode: SaleMode) => void
  onRefresh?: () => void
  /** Enter on an empty search box advances the checkout instead of doing nothing. */
  onEmptyEnter?: () => void
  isFocusMode?: boolean
  onToggleFocusMode?: () => void
  isOwner?: boolean
}

export default function ProductCatalogGrid({
  stocks,
  isLoading = false,
  onAddToCart,
  saleMode,
  onToggleSaleMode,
  onRefresh,
  onEmptyEnter,
  isFocusMode = false,
  onToggleFocusMode,
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
      // Nothing typed: the cashier is driving checkout from the keyboard while
      // focus sits in the (barcode-facing) search box, so advance the sale.
      if (!q) {
        onEmptyEnter?.()
        return
      }

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
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Search & Filter Header */}
      <div className="p-3.5 border-b border-slate-200/60 bg-slate-50/30 space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Sale Mode Toggle (Retail vs Wholesale) */}
          <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-xs shrink-0">
            <button
              type="button"
              onClick={() => onToggleSaleMode("RETAIL")}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                saleMode === "RETAIL"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Retail
            </button>
            <button
              type="button"
              onClick={() => onToggleSaleMode("WHOLESALE")}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                saleMode === "WHOLESALE"
                  ? "bg-purple-700 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Wholesale
            </button>
          </div>

          <div className="flex-1 relative">
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onClear={() => setSearch("")}
              placeholder="Search or scan barcode... (F2)"
              leftAdornment={<Search className="w-4 h-4 text-slate-400" />}
              inputSize="md"
              className="bg-white shadow-xs"
            />
          </div>
          <div className="hidden sm:flex items-center gap-1.5 shrink-0 text-xs text-slate-500 font-medium bg-white px-2.5 py-2 border border-slate-200 rounded-xl shadow-xs">
            <span className="font-mono text-emerald-800 font-bold bg-emerald-50 px-1 rounded border border-emerald-200">
              F2
            </span>
            <span>Search</span>
          </div>
          {onToggleFocusMode && (
            <button
              type="button"
              onClick={onToggleFocusMode}
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-xl border cursor-pointer shadow-xs transition-colors ${
                isFocusMode
                  ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
              title={
                isFocusMode
                  ? "Exit focus mode (F8) — show the menu and header again"
                  : "Focus mode (F8) — hide the menu and header for a full-screen counter"
              }
            >
              {isFocusMode ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
              <span
                className={`hidden lg:inline text-xs font-mono font-bold px-1 rounded border ${
                  isFocusMode
                    ? "bg-white/15 border-white/25"
                    : "text-emerald-800 bg-emerald-50 border-emerald-200"
                }`}
              >
                F8
              </span>
            </button>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="shrink-0 p-2 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer shadow-xs disabled:opacity-50"
              title="Refresh stock and data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category & Status Pills */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pt-0.5">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-900 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              All Categories ({stocks.length})
            </button>
            {categories.map((cat) => {
              const count = stocks.filter((s) => s.category === cat).length
              const isSelected = selectedCategory === cat
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "bg-white text-slate-900 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {cat} ({count})
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1 shrink-0 border-l border-slate-200/60 pl-2">
            <button
              type="button"
              onClick={() =>
                setStockFilter((prev) => (prev === "IN_STOCK" ? "ALL" : "IN_STOCK"))
              }
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                stockFilter === "IN_STOCK"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "text-slate-500 hover:bg-white"
              }`}
            >
              In Stock
            </button>
            <button
              type="button"
              onClick={() =>
                setStockFilter((prev) => (prev === "LOW_STOCK" ? "ALL" : "LOW_STOCK"))
              }
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                stockFilter === "LOW_STOCK"
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "text-slate-500 hover:bg-white"
              }`}
            >
              Low Stock
            </button>
          </div>
        </div>
      </div>

      {/* Catalog Grid Body */}
      <div className="flex-1 p-3 overflow-y-auto">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-2">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-semibold">Loading product list...</p>
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-2 text-center p-6">
            <Wheat className="w-10 h-10 text-slate-300" />
            <p className="text-sm font-bold text-slate-900">
              No products found
            </p>
            <p className="text-xs text-slate-500">
              Change your search filters or add a new product.
            </p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-2 text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {filteredStocks.map((item) => {
              const activePrice =
                saleMode === "RETAIL"
                  ? (item as any).lotRetailPrice ?? item.standardRetailPrice ?? 0
                  : (item as any).lotWholesalePrice ?? item.standardWholesalePrice ?? 0
              const purchaseCost = (item as any).purchaseCost ?? 0

              return (
                <div
                  key={`${item.productId}-${(item as any).lotId ?? "def"}`}
                  onClick={() => onAddToCart(item)}
                  className="group flex flex-col justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden"
                >
                  {/* Accent Line */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-600 group-hover:h-1.5 transition-all" />

                  {/* Product Name */}
                  <div className="pt-1">
                    <h4 className="font-bold text-sm text-slate-900 group-hover:text-emerald-800 leading-snug line-clamp-2 transition-colors">
                      {item.productNameEn || item.nameEn}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {item.productNameBn || item.nameBn}
                    </p>
                  </div>

                  {/* Unit & Price Footer */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-end justify-between gap-1">
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold">
                        {item.baseUnit || ""}
                      </span>

                      {/* Owner Mode: Purchase Cost Hint */}
                      {isOwner && purchaseCost > 0 && (
                        <div className="text-[10px] text-amber-700 font-semibold mt-1">
                          Cost: {formatTk(purchaseCost)}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-emerald-800 font-mono tabular-nums leading-tight">
                        {formatTk(activePrice)}
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {saleMode === "RETAIL" ? "Retail price" : "Wholesale price"}
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
