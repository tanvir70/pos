import { useEffect, useMemo, useRef, useState } from "react"
import {
  Barcode,
  CalendarClock,
  Check,
  Loader2,
  Maximize2,
  Minimize2,
  PackageCheck,
  Search,
} from "lucide-react"
import type { SaleMode, StockItem } from "../../types"
import { formatTk } from "../../utils/currency"
import { formatLotNumber } from "../../utils/lotNumber"
import { focusSidebarMenu } from "../../utils/keyboard"
import Input from "../ui/Input"
import Button from "../ui/Button"
import Badge from "../ui/Badge"
import RefreshButton from "../ui/RefreshButton"

export interface ProductSearchProps {
  stocks: StockItem[]
  isLoading?: boolean
  onAddToCart?: (stock: StockItem) => void
  onSelect?: (stock: StockItem) => void
  saleMode?: SaleMode
  onRefresh?: () => void
  onEmptyEnter?: () => void
  isFocusMode?: boolean
  onToggleFocusMode?: () => void
  allowZeroStock?: boolean
  placeholder?: string
  className?: string
}

const MAX_RESULTS = 8

type ProductSearchResult = {
  item: StockItem
  productTotalQuantity: number
  productLotCount: number
  isExact: boolean
}

function productName(item: StockItem) {
  return item.productNameEn || item.nameEn || "Unnamed product"
}

function availableQuantity(item: StockItem): number {
  const qty = item.quantity ?? item.totalQuantity ?? 0
  const parsed = typeof qty === "number" ? qty : parseFloat(String(qty))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatQuantity(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "") return "0"
  const n = typeof value === "number" ? value : parseFloat(String(value))
  if (!Number.isFinite(n)) return "0"
  return Number.isInteger(n)
    ? n.toLocaleString("en-IN")
    : n.toLocaleString("en-IN", { maximumFractionDigits: 3 })
}

function hasBusinessLot(item: StockItem) {
  return !!item.lotNumber
}

function lotSortValue(item: StockItem) {
  const expiryTime = item.expiryDate ? new Date(item.expiryDate).getTime() : Number.MAX_SAFE_INTEGER
  const entryTime = item.entryDate ? new Date(item.entryDate).getTime() : Number.MAX_SAFE_INTEGER
  return Number.isFinite(expiryTime) ? expiryTime : entryTime
}

export default function ProductSearch({
  stocks,
  isLoading = false,
  onAddToCart,
  onSelect,
  saleMode = "RETAIL",
  onRefresh,
  onEmptyEnter,
  isFocusMode = false,
  onToggleFocusMode,
  allowZeroStock = false,
  placeholder = "Search product, code, or scan barcode",
  className,
}: ProductSearchProps) {
  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchRootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F2") return
      event.preventDefault()
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
      setIsOpen(true)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        searchRootRef.current &&
        !searchRootRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  useEffect(() => {
    const clearHardwareScan = () => {
      setSearch("")
      setIsOpen(false)
    }
    window.addEventListener("pos-barcode-scanned", clearHardwareScan)
    return () => window.removeEventListener("pos-barcode-scanned", clearHardwareScan)
  }, [])

  const results = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []

    const lotsByProduct = new Map<number, StockItem[]>()
    for (const item of stocks) {
      if (!allowZeroStock && availableQuantity(item) <= 0) continue
      const lots = lotsByProduct.get(item.productId) ?? []
      lots.push(item)
      lotsByProduct.set(item.productId, lots)
    }

    const matchedLots: ProductSearchResult[] = []

    for (const item of stocks) {
      // Do not show if product/lot stock is empty or zero unless allowZeroStock is enabled
      if (!allowZeroStock && availableQuantity(item) <= 0) continue

      const itemValues = [
        item.productCode,
        productName(item),
        item.productNameBn || item.nameBn,
        item.lotNumber,
        item.lotBarcode || item.barcode || item.defaultBarcode,
        item.category,
      ]
      const isMatch = itemValues.some((value) => value?.toLowerCase().includes(query))
      if (!isMatch) continue

      const exactLotMatch =
        item.productCode?.toLowerCase() === query ||
        item.lotBarcode?.toLowerCase() === query ||
        item.barcode?.toLowerCase() === query ||
        item.defaultBarcode?.toLowerCase() === query ||
        item.lotNumber?.toLowerCase() === query

      const productLots = (lotsByProduct.get(item.productId) ?? [item]).filter(
        (lot) => allowZeroStock || availableQuantity(lot) > 0
      )
      const totalQuantity = productLots.reduce((sum, lot) => sum + availableQuantity(lot), 0)
      if (!allowZeroStock && totalQuantity <= 0) continue

      matchedLots.push({
        item,
        productTotalQuantity: totalQuantity,
        productLotCount: productLots.length,
        isExact: exactLotMatch,
      })
    }

    return matchedLots
      .sort((a, b) => {
        const aName = productName(a.item).toLowerCase()
        const bName = productName(b.item).toLowerCase()
        if (a.isExact !== b.isExact) return a.isExact ? -1 : 1
        const nameOrder = aName.localeCompare(bName)
        if (nameOrder !== 0) return nameOrder
        const aStock = availableQuantity(a.item)
        const bStock = availableQuantity(b.item)
        if ((aStock > 0) !== (bStock > 0)) return aStock > 0 ? -1 : 1
        return lotSortValue(a.item) - lotSortValue(b.item)
      })
      .slice(0, MAX_RESULTS)
  }, [search, stocks, allowZeroStock])

  useEffect(() => {
    setActiveIndex(0)
  }, [search])

  const selectProduct = (item: StockItem) => {
    if (onSelect) {
      onSelect(item)
    } else if (onAddToCart) {
      onAddToCart(item)
    }
    setSearch("")
    setIsOpen(false)
    searchInputRef.current?.focus()
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key === "ArrowLeft" &&
      event.currentTarget.selectionStart === 0 &&
      event.currentTarget.selectionEnd === 0
    ) {
      event.preventDefault()
      focusSidebarMenu()
      return
    }

    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((current) => Math.min(current + 1, results.length - 1))
      return
    }

    if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === "Escape") {
      setIsOpen(false)
      return
    }

    if (event.key !== "Enter") return
    event.preventDefault()

    if (!search.trim()) {
      onEmptyEnter?.()
      return
    }

    if (results[activeIndex]) selectProduct(results[activeIndex].item)
  }

  const showResults = isOpen && search.trim().length > 0

  return (
    <div
      ref={searchRootRef}
      className={`relative z-30 border-b border-slate-200 bg-white px-4 py-3 ${className || ""}`}
    >
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            ref={searchInputRef}
            data-primary-search="true"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleSearchKeyDown}
            onClear={() => {
              setSearch("")
              setIsOpen(false)
            }}
            placeholder={placeholder}
            leftAdornment={<Search className="h-4 w-4" />}
            inputSize="lg"
            autoComplete="off"
            className="border-slate-300 bg-slate-50/40 shadow-xs focus:bg-white"
          />

          {showResults && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[430px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/15">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading stock
                </div>
              ) : results.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm font-bold text-slate-900">
                    {allowZeroStock ? "No matching product found" : "No matching in-stock product"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {allowZeroStock
                      ? "Check the name, code, lot, or scan a barcode."
                      : "Check the name, code, or barcode. Products with 0 stock are hidden."}
                  </p>
                </div>
              ) : (
                <div className="p-1.5">
                  {results.map((result, index) => {
                    const item = result.item
                    const selectedLotQuantity = availableQuantity(item)
                    const retailPrice =
                      item.lotRetailPrice ?? item.standardRetailPrice ?? 0
                    const isActive = index === activeIndex
                    const isOutOfStock = !allowZeroStock && selectedLotQuantity <= 0

                    return (
                      <button
                        type="button"
                        key={`${item.productId}-${item.lotId}`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => {
                          if (!isOutOfStock) selectProduct(item)
                        }}
                        disabled={isOutOfStock}
                        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-md px-3 py-3 text-left cursor-pointer ${
                          isOutOfStock
                            ? "cursor-not-allowed opacity-55"
                            : isActive
                              ? "bg-emerald-50"
                              : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-bold text-slate-950">
                              {productName(item)}
                            </span>
                            {isActive && (
                              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                            )}
                          </div>
                          {(item.productNameBn || item.nameBn) &&
                            (item.productNameBn || item.nameBn) !== productName(item) && (
                            <p className="truncate text-xs text-slate-500">
                              {item.productNameBn || item.nameBn}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Barcode className="h-3.5 w-3.5" />
                              {item.productCode}
                            </span>
                            {hasBusinessLot(item) && (
                              <span className="font-semibold text-slate-700">
                                Selling lot #{formatLotNumber(item.lotNumber)}
                              </span>
                            )}
                            {result.productLotCount > 1 && (
                              <span>{result.productLotCount} versions</span>
                            )}
                            {hasBusinessLot(item) && (
                              <span className="inline-flex items-center gap-1">
                                <CalendarClock className="h-3.5 w-3.5" />
                                Exp {item.expiryDate || "Not set"}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 min-w-[140px] max-w-[220px] flex-col items-end justify-center text-right overflow-hidden">
                          <span className="font-mono text-base font-black text-emerald-800 tabular-nums">
                            {formatTk(retailPrice)}
                          </span>
                          {saleMode === "WHOLESALE" && (
                            <span className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                              Wholesale adjusted at checkout
                            </span>
                          )}
                          <span
                            className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold ${
                              selectedLotQuantity > 0 ? "text-emerald-700" : "text-red-600"
                            }`}
                          >
                            <PackageCheck className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{formatQuantity(selectedLotQuantity)} {item.baseUnit} in this lot</span>
                          </span>
                          {result.productLotCount > 1 && (
                            <span className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                              {formatQuantity(result.productTotalQuantity)} total across lots
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hidden h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500 sm:flex">
          <Barcode className="h-4 w-4 text-emerald-700" />
          <span>Scanner ready</span>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
            F2
          </kbd>
        </div>

        {onRefresh && (
          <RefreshButton
            onClick={onRefresh}
            isLoading={isLoading}
            title="Refresh stock catalog"
            className="h-11 w-11 rounded-lg"
          />
        )}

        {onToggleFocusMode && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onToggleFocusMode}
            className="h-11 w-11 shrink-0 rounded-lg text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
            title={isFocusMode ? "Exit full page mode (F8)" : "Full page mode (F8)"}
          >
            {isFocusMode ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
