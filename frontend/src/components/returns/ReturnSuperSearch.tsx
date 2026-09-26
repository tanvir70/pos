import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  Search,
  Receipt,
  CheckCircle2,
  X,
  Loader2,
  Package,
  Barcode,
  Sparkles,
  ArrowRight,
  Check,
  Tag,
  AlertTriangle,
  CheckSquare,
  Square,
  FileText,
} from "lucide-react"
import type { StockItem, SaleResponse, SaleItemResponse } from "../../types"
import { formatLotNumber } from "../../utils/lotNumber"
import { formatQuantityByUnit } from "../../utils/unit"
import { searchSales } from "../../api/endpoints"

export interface ReturnSuperSearchProps {
  stocks: StockItem[]
  selectedStockItem?: StockItem | null
  onSelectStock: (item: StockItem) => void
  onClearSelectedStock?: () => void
  foundSale: SaleResponse | null
  isSearchingInvoice: boolean
  invoiceSearchError: string | null
  onSearchInvoice: (invoiceNo: string) => Promise<void>
  onClearInvoice: () => void
  onSelectFoundSale?: (sale: SaleResponse) => void
  onSelectInvoiceItem?: (saleItem: SaleItemResponse, stockItem: StockItem) => void
  selectedInvoiceItemLotId?: number | null
  // Multi-item return props
  selectedLotIds?: number[]
  onToggleInvoiceItem?: (saleItem: SaleItemResponse, stockItem: StockItem) => void
  onSelectAllInvoiceItems?: () => void
  onDeselectAllInvoiceItems?: () => void
  renderOnlySearch?: boolean
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ReturnSuperSearch({
  stocks,
  selectedStockItem,
  onSelectStock,
  onClearSelectedStock,
  foundSale,
  isSearchingInvoice,
  invoiceSearchError,
  onSearchInvoice,
  onClearInvoice,
  onSelectFoundSale,
  onSelectInvoiceItem,
  selectedInvoiceItemLotId,
  selectedLotIds = [],
  onToggleInvoiceItem,
  onSelectAllInvoiceItems,
  onDeselectAllInvoiceItems,
  renderOnlySearch = false,
}: ReturnSuperSearchProps) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isChangingMemo, setIsChangingMemo] = useState(false)

  // Live matching sales/invoices state
  const [matchingSales, setMatchingSales] = useState<SaleResponse[]>([])
  const [isSearchingSales, setIsSearchingSales] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        if (foundSale) {
          setIsChangingMemo(false)
        }
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [foundSale])

  // Focus input when user wants to change memo
  useEffect(() => {
    if (isChangingMemo) {
      inputRef.current?.focus()
    }
  }, [isChangingMemo])

  // Auto-detect if current input is likely an invoice query
  const isInvoiceQuery = useMemo(() => {
    const q = query.trim().toUpperCase()
    return (
      q.startsWith("INV") ||
      q.startsWith("MEMO") ||
      q.startsWith("#") ||
      /^\d+$/.test(q) ||
      (q.length > 3 && q.includes("-"))
    )
  }, [query])

  // Live query for matching invoices (debounced)
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setMatchingSales([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingSales(true)
        const sales = await searchSales(trimmed, 6)
        setMatchingSales(sales)
      } catch {
        setMatchingSales([])
      } finally {
        setIsSearchingSales(false)
      }
    }, 160)

    return () => clearTimeout(timer)
  }, [query])

  // Filter matching stock items for live product suggestions
  const matchingStocks = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    return stocks
      .filter((s) => {
        const matchNameEn = (s.nameEn || s.productNameEn || "").toLowerCase().includes(q)
        const matchNameBn = (s.nameBn || s.productNameBn || "").toLowerCase().includes(q)
        const matchCode = (s.productCode || "").toLowerCase().includes(q)
        const matchLot = (s.lotNumber || "").toLowerCase().includes(q)
        const matchBarcode = (s.lotBarcode || s.barcode || "").toLowerCase().includes(q)
        return matchNameEn || matchNameBn || matchCode || matchLot || matchBarcode
      })
      .slice(0, 8)
  }, [stocks, query])

  // Handle Search Submission (Barcode Scan or Enter Key)
  const handleTriggerSearch = async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    // 1. Direct exact barcode match against inventory lots
    const exactBarcodeMatch = stocks.find(
      (s) =>
        (s.lotBarcode && s.lotBarcode.toLowerCase() === trimmed.toLowerCase()) ||
        (s.barcode && s.barcode.toLowerCase() === trimmed.toLowerCase()) ||
        (s.defaultBarcode && s.defaultBarcode.toLowerCase() === trimmed.toLowerCase()),
    )

    if (exactBarcodeMatch && !isInvoiceQuery) {
      onSelectStock(exactBarcodeMatch)
      setQuery("")
      setIsOpen(false)
      setIsChangingMemo(false)
      return
    }

    // 2. Invoice Lookup (Supports full invoice or suffix like 217)
    try {
      await onSearchInvoice(trimmed)
      setQuery("")
      setIsOpen(false)
      setIsChangingMemo(false)
    } catch {
      // Handled via invoiceSearchError prop
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalItems = matchingSales.length + matchingStocks.length

    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (totalItems > 0) {
        setActiveIndex((prev) => (prev + 1) % totalItems)
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (totalItems > 0) {
        setActiveIndex((prev) => (prev - 1 + totalItems) % totalItems)
      }
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (isOpen && totalItems > 0) {
        if (activeIndex < matchingSales.length) {
          const selectedSale = matchingSales[activeIndex]
          if (onSelectFoundSale) {
            onSelectFoundSale(selectedSale)
          } else {
            void onSearchInvoice(selectedSale.invoiceNo)
          }
          setQuery("")
          setIsOpen(false)
          setIsChangingMemo(false)
          return
        } else {
          const stockIdx = activeIndex - matchingSales.length
          const selectedStock = matchingStocks[stockIdx]
          if (selectedStock) {
            onSelectStock(selectedStock)
            setQuery("")
            setIsOpen(false)
            setIsChangingMemo(false)
            return
          }
        }
      }
      void handleTriggerSearch()
    } else if (e.key === "Escape") {
      setIsOpen(false)
      setIsChangingMemo(false)
    }
  }

  return (
    <div ref={containerRef} className="space-y-1.5">
      {/* Label and Hint */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5 text-emerald-700" />
          <span>Invoice / Item Lookup</span>
        </label>
        <span className="text-[11px] text-slate-500 font-normal">
          Search suffix (e.g. <strong>217</strong>) or barcode
        </span>
      </div>

      {/* Mode A: Invoice Loaded Compact Display (when renderOnlySearch is true) */}
      {foundSale && !isChangingMemo ? (
        <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-200 text-emerald-900 flex items-center justify-center shrink-0 font-bold text-xs">
              <Receipt className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-emerald-950 text-xs sm:text-sm">
                  #{foundSale.invoiceNo}
                </span>
                <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded-md">
                  Active
                </span>
              </div>
              <div className="text-[11px] text-emerald-800 flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span>Total: <strong>{tk(foundSale.totalAmount)}</strong></span>
                <span>·</span>
                <span>{foundSale.items?.length || 0} items</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsChangingMemo(true)}
              className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-md cursor-pointer transition-colors"
            >
              Change Memo
            </button>
            <button
              type="button"
              onClick={() => {
                onClearInvoice()
                setIsChangingMemo(false)
              }}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
              title="Clear invoice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Mode B: Search Input Omnibar */
        <div className="relative">
          <div className="relative flex items-center">
            <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center">
              <Search className="w-4 h-4 text-emerald-700" />
            </div>

            <input
              ref={inputRef}
              data-primary-search="true"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIsOpen(true)
                setActiveIndex(0)
              }}
              onFocus={() => {
                if (query.trim()) setIsOpen(true)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search memo (e.g. 217), barcode, product..."
              className="w-full pl-9 pr-24 py-2.5 bg-slate-50/60 focus:bg-white border border-slate-200 focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-medium transition-all shadow-2xs focus:outline-hidden"
            />

            <div className="absolute right-1.5 flex items-center gap-1">
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("")
                    setIsOpen(false)
                    setMatchingSales([])
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {isChangingMemo && (
                <button
                  type="button"
                  onClick={() => setIsChangingMemo(false)}
                  className="px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-md cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              )}

              <button
                type="button"
                onClick={handleTriggerSearch}
                disabled={isSearchingInvoice || !query.trim()}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1"
              >
                {isSearchingInvoice ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isInvoiceQuery ? (
                  <>
                    <Receipt className="w-3 h-3" />
                    <span>Find</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3 h-3" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Autocomplete Dropdown */}
          {isOpen && query.trim() && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 animate-in fade-in duration-100 max-h-80 overflow-y-auto">
              {/* Direct Memo Suffix Trigger */}
              <div
                onClick={() => {
                  void handleTriggerSearch()
                }}
                className="p-2.5 hover:bg-emerald-50/70 transition-colors cursor-pointer flex items-center justify-between text-xs font-semibold text-slate-900 group"
              >
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-700" />
                  <span>
                    Lookup Memo / Suffix <strong className="font-mono text-emerald-800">"{query.trim()}"</strong>
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md group-hover:bg-emerald-200">
                  Press Enter ↵
                </span>
              </div>

              {/* Matching Invoices List */}
              {matchingSales.length > 0 && (
                <div className="divide-y divide-emerald-100/50 bg-emerald-50/20">
                  <div className="px-3 py-1.5 bg-emerald-100/70 text-[10px] font-bold uppercase tracking-wider text-emerald-950 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Matching Invoices ({matchingSales.length})</span>
                    </span>
                    <span className="text-[10px] font-normal text-emerald-700">Click to select memo</span>
                  </div>
                  {matchingSales.map((sale, idx) => {
                    const isSelected = activeIndex === idx
                    return (
                      <div
                        key={sale.id}
                        onClick={() => {
                          if (onSelectFoundSale) {
                            onSelectFoundSale(sale)
                          } else {
                            void onSearchInvoice(sale.invoiceNo)
                          }
                          setQuery("")
                          setIsOpen(false)
                          setIsChangingMemo(false)
                        }}
                        className={`p-2.5 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected ? "bg-emerald-100/80" : "hover:bg-emerald-50"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-emerald-950 text-xs sm:text-sm">
                              #{sale.invoiceNo}
                            </span>
                            <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded-md">
                              {sale.saleMode || "RETAIL"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800">
                              {sale.customerName || "Walk-in Retail"}
                            </span>
                            <span>·</span>
                            <span>
                              {new Date(sale.saleDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            <span>·</span>
                            <span>{sale.items?.length || 0} items</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                            {tk(sale.totalAmount)}
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700">
                            Select Memo ↵
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Matching Product Lots List */}
              {matchingStocks.length > 0 && (
                <div className="divide-y divide-slate-50">
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Matching Products & Lots ({matchingStocks.length})
                  </div>
                  {matchingStocks.map((item, idx) => {
                    const globalIdx = matchingSales.length + idx
                    const isSelected = activeIndex === globalIdx
                    const stockQty = item.quantity ?? (item as any).totalQuantity ?? 0

                    return (
                      <div
                        key={item.lotId}
                        onClick={() => {
                          onSelectStock(item)
                          setQuery("")
                          setIsOpen(false)
                          setIsChangingMemo(false)
                        }}
                        className={`p-2.5 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected ? "bg-emerald-50/80" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="font-bold text-slate-900 truncate">
                            {item.nameBn || item.productNameBn} ({item.nameEn || item.productNameEn})
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="font-mono font-bold bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 text-slate-700">
                              Lot #{formatLotNumber(item.lotNumber)}
                            </span>
                            {(item.lotBarcode || item.barcode) && (
                              <span className="font-mono text-slate-400">
                                #{item.lotBarcode || item.barcode}
                              </span>
                            )}
                            <span>·</span>
                            <span>
                              Stock: <strong className="text-slate-800">{stockQty} {item.baseUnit}</strong>
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-slate-900">
                            {tk(item.lotRetailPrice)}
                          </span>
                          <span className="block text-[10px] text-slate-500 font-medium">
                            per {item.baseUnit}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Invoice Error Message */}
          {invoiceSearchError && (
            <p className="text-xs text-amber-700 font-medium mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{invoiceSearchError}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
