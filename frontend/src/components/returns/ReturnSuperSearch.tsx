import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  Search,
  Receipt,
  X,
  Loader2,
  CheckCircle2,
  Phone,
  User,
  Calendar,
  AlertTriangle,
} from "lucide-react"
import type { StockItem, SaleResponse, SaleItemResponse } from "../../types"
import { searchSales } from "../../api/endpoints"

export interface ReturnSuperSearchProps {
  stocks?: StockItem[]
  selectedStockItem?: StockItem | null
  onSelectStock?: (item: StockItem) => void
  onClearSelectedStock?: () => void
  foundSale: SaleResponse | null
  isSearchingInvoice: boolean
  invoiceSearchError: string | null
  onSearchInvoice: (invoiceNo: string) => Promise<void>
  onClearInvoice: () => void
  onSelectFoundSale?: (sale: SaleResponse) => void
  onSelectInvoiceItem?: (saleItem: SaleItemResponse, stockItem: StockItem) => void
  selectedInvoiceItemLotId?: number | null
  selectedLotIds?: number[]
  onToggleInvoiceItem?: (saleItem: SaleItemResponse, stockItem: StockItem) => void
  onSelectAllInvoiceItems?: () => void
  onDeselectAllInvoiceItems?: () => void
  renderOnlySearch?: boolean
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ReturnSuperSearch({
  foundSale,
  isSearchingInvoice,
  invoiceSearchError,
  onSearchInvoice,
  onClearInvoice,
  onSelectFoundSale,
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
        const sales = await searchSales(trimmed, 8)
        setMatchingSales(sales)
      } catch {
        setMatchingSales([])
      } finally {
        setIsSearchingSales(false)
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [query])

  // Handle Search Submission (Barcode Scan or Enter Key)
  const handleTriggerSearch = async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    // If an invoice is highlighted in dropdown, select it
    if (matchingSales.length > 0 && activeIndex >= 0 && activeIndex < matchingSales.length) {
      const selected = matchingSales[activeIndex]
      if (onSelectFoundSale) {
        onSelectFoundSale(selected)
      } else {
        await onSearchInvoice(selected.invoiceNo)
      }
      setQuery("")
      setIsOpen(false)
      setIsChangingMemo(false)
      return
    }

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
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (matchingSales.length > 0) {
        setActiveIndex((prev) => (prev + 1) % matchingSales.length)
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (matchingSales.length > 0) {
        setActiveIndex((prev) => (prev - 1 + matchingSales.length) % matchingSales.length)
      }
    } else if (e.key === "Enter") {
      e.preventDefault()
      void handleTriggerSearch()
    } else if (e.key === "Escape") {
      setIsOpen(false)
      setIsChangingMemo(false)
    }
  }

  const handleSelectSale = (sale: SaleResponse) => {
    if (onSelectFoundSale) {
      onSelectFoundSale(sale)
    } else {
      void onSearchInvoice(sale.invoiceNo)
    }
    setQuery("")
    setIsOpen(false)
    setIsChangingMemo(false)
  }

  return (
    <div ref={containerRef} className="space-y-1.5 w-full">
      {/* Label and Hint */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          <span>Original Invoice Verification *</span>
        </label>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
          Search by <strong>Phone</strong>, <strong>Name</strong>, or <strong>Memo #</strong>
        </span>
      </div>

      {/* Mode A: Invoice Loaded Compact Display */}
      {foundSale && !isChangingMemo ? (
        <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 flex items-center justify-center shrink-0 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-emerald-950 dark:text-emerald-100 text-xs sm:text-sm">
                  #{foundSale.invoiceNo}
                </span>
                <span className="text-[10px] font-bold bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-1.5 py-0.2 rounded-md">
                  Verified Sale
                </span>
              </div>
              <div className="text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {foundSale.customerName || "Walk-in Retail"}
                  {foundSale.customerPhone ? ` (${foundSale.customerPhone})` : ""}
                </span>
                <span>·</span>
                <span>
                  Bill: <strong>{tk(foundSale.totalAmount)}</strong>
                </span>
                <span>·</span>
                <span>{foundSale.items?.length || 0} items purchased</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsChangingMemo(true)}
              className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200 hover:text-emerald-950 dark:hover:text-emerald-100 bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 dark:hover:bg-emerald-800 px-2.5 py-1 rounded-md cursor-pointer transition-colors"
            >
              Change Invoice
            </button>
            <button
              type="button"
              onClick={() => {
                onClearInvoice()
                setIsChangingMemo(false)
              }}
              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
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
              <Search className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
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
              placeholder="Scan memo barcode, or search by Phone (017...), Name, or Memo #..."
              className="w-full pl-9 pr-24 py-2.5 bg-slate-50/60 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-xs sm:text-sm font-medium transition-all shadow-2xs focus:outline-hidden"
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
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {isChangingMemo && (
                <button
                  type="button"
                  onClick={() => setIsChangingMemo(false)}
                  className="px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-700 rounded-md cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              )}

              <button
                type="button"
                onClick={handleTriggerSearch}
                disabled={isSearchingInvoice || !query.trim()}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1"
              >
                {isSearchingInvoice || isSearchingSales ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Receipt className="w-3 h-3" />
                    <span>Find</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Autocomplete Dropdown */}
          {isOpen && query.trim() && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in duration-100 max-h-84 overflow-y-auto">
              {/* Direct Memo Suffix / Code Search */}
              <div
                onClick={() => {
                  void handleTriggerSearch()
                }}
                className="p-2.5 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-100 group"
              >
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>
                    Lookup Memo / Suffix <strong className="font-mono text-emerald-800 dark:text-emerald-300">"{query.trim()}"</strong>
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900">
                  Press Enter ↵
                </span>
              </div>

              {/* Matching Invoices List */}
              {matchingSales.length > 0 ? (
                <div className="divide-y divide-emerald-100/50 dark:divide-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10">
                  <div className="px-3 py-1.5 bg-emerald-100/70 dark:bg-emerald-950/80 text-[10px] font-bold uppercase tracking-wider text-emerald-950 dark:text-emerald-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                      <span>Found Matching Invoices ({matchingSales.length})</span>
                    </span>
                    <span className="text-[10px] font-normal text-emerald-700 dark:text-emerald-400">Click or press Enter to load</span>
                  </div>
                  {matchingSales.map((sale, idx) => {
                    const isSelected = activeIndex === idx
                    return (
                      <div
                        key={sale.id}
                        onClick={() => handleSelectSale(sale)}
                        className={`p-3 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected ? "bg-emerald-100/80 dark:bg-emerald-900/50" : "hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-emerald-950 dark:text-emerald-200 text-xs sm:text-sm">
                              #{sale.invoiceNo}
                            </span>
                            <span className="text-[10px] font-bold bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 px-1.5 py-0.2 rounded-md">
                              {sale.saleMode || "RETAIL"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{sale.customerName || "Walk-in Retail"}</span>
                            </span>
                            {sale.customerPhone && (
                              <span className="text-slate-500 font-mono flex items-center gap-0.5">
                                <Phone className="w-2.5 h-2.5 text-slate-400" />
                                <span>{sale.customerPhone}</span>
                              </span>
                            )}
                            <span>·</span>
                            <span className="flex items-center gap-0.5">
                              <Calendar className="w-2.5 h-2.5 text-slate-400" />
                              <span>
                                {new Date(sale.saleDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            </span>
                            <span>·</span>
                            <span className="text-emerald-800 dark:text-emerald-300 font-medium">
                              {sale.items?.length || 0} {sale.items?.length === 1 ? "item" : "items"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                            {tk(sale.totalAmount)}
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            Select Invoice ↵
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                !isSearchingSales && (
                  <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      No invoices found matching "{query.trim()}"
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      Check customer mobile number (e.g. 017...), customer name, or scan the invoice barcode.
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Invoice Search Error Banner */}
      {invoiceSearchError && (
        <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{invoiceSearchError}</span>
        </div>
      )}
    </div>
  )
}
