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
} from "lucide-react"
import type { StockItem, SaleResponse, SaleItemResponse } from "../../types"
import { formatLotNumber } from "../../utils/lotNumber"
import { focusSidebarMenu } from "../../utils/keyboard"

export interface ReturnSuperSearchProps {
  stocks: StockItem[]
  selectedStockItem: StockItem | null
  onSelectStock: (item: StockItem) => void
  onClearSelectedStock: () => void
  foundSale: SaleResponse | null
  isSearchingInvoice: boolean
  invoiceSearchError: string | null
  onSearchInvoice: (invoiceNo: string) => Promise<void>
  onClearInvoice: () => void
  onSelectInvoiceItem?: (saleItem: SaleItemResponse, stockItem: StockItem) => void
  selectedInvoiceItemLotId?: number | null
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
  onSelectInvoiceItem,
  selectedInvoiceItemLotId,
}: ReturnSuperSearchProps) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

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
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [])

  // Auto-detect if current input is likely an invoice query
  const isInvoiceQuery = useMemo(() => {
    const q = query.trim().toUpperCase()
    return q.startsWith("INV") || q.startsWith("MEMO") || (q.length > 5 && q.includes("-"))
  }, [query])

  // Filter matching stock items for live product suggestions
  const matchingStocks = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || isInvoiceQuery) return []

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
  }, [stocks, query, isInvoiceQuery])

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
      return
    }

    // 2. Otherwise trigger invoice search
    setIsOpen(false)
    await onSearchInvoice(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === "ArrowLeft" &&
      e.currentTarget.selectionStart === 0 &&
      e.currentTarget.selectionEnd === 0
    ) {
      e.preventDefault()
      focusSidebarMenu()
      return
    }

    if (e.key === "Enter") {
      e.preventDefault()
      if (isOpen && matchingStocks.length > 0 && activeIndex < matchingStocks.length) {
        onSelectStock(matchingStocks[activeIndex])
        setQuery("")
        setIsOpen(false)
      } else {
        void handleTriggerSearch()
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, matchingStocks.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  // Handle item selection from found invoice
  const handleInvoiceItemClick = (it: SaleItemResponse) => {
    const matchedStock = stocks.find((s) => s.lotId === it.lotId)
    const stockToUse: StockItem = matchedStock || {
      productId: (it as any).productId || 0,
      productCode: (it as any).productCode || "",
      nameEn: it.productNameEn,
      nameBn: it.productNameBn,
      category: "",
      baseUnit: it.baseUnit || "unit",
      cartonMultiplier: it.cartonMultiplier || 1,
      defaultBarcode: it.barcode,
      lotId: it.lotId,
      lotNumber: it.lotNumber,
      entryDate: "",
      expiryDate: it.expiryDate || "",
      purchaseCost: it.unitCost || 0,
      lotRetailPrice: it.unitPrice,
      lotWholesalePrice: it.unitPrice,
      lotBarcode: it.barcode,
      quantity: 0,
    }

    if (onSelectInvoiceItem) {
      onSelectInvoiceItem(it, stockToUse)
    } else {
      onSelectStock(stockToUse)
    }
  }

  return (
    <div ref={containerRef} className="space-y-3">
      {/* ─── Unified Super Search Omnibar ───────────────────────────── */}
      <div className="relative">
        <label className="block text-xs font-semibold text-slate-900 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Super Search (Invoice #, Barcode, Product, or Lot)</span>
          </span>
          <span className="text-[11px] text-slate-500 font-normal">
            Auto-detects invoice or product barcode
          </span>
        </label>

        <div className="relative flex items-center">
          <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center gap-1">
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
            placeholder="Scan barcode / memo, or search product name, lot, invoice #..."
            className="w-full pl-10 pr-24 py-2.5 bg-slate-50/60 focus:bg-white border border-slate-200 focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-medium transition-all shadow-2xs focus:outline-hidden"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setIsOpen(false)
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleTriggerSearch}
              disabled={isSearchingInvoice || !query.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1"
            >
              {isSearchingInvoice ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isInvoiceQuery ? (
                <>
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Find Memo</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Autocomplete Dropdown */}
        {isOpen && query.trim() && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 animate-in fade-in duration-100">
            {/* Action 1: Search Invoice Option */}
            <div
              onClick={() => {
                void handleTriggerSearch()
              }}
              className="p-2.5 hover:bg-emerald-50/60 transition-colors cursor-pointer flex items-center justify-between text-xs font-semibold text-slate-900 group"
            >
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-700" />
                <span>
                  Search Memo / Invoice <strong className="font-mono text-emerald-800">"{query.trim()}"</strong>
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md group-hover:bg-emerald-200">
                Press Enter ↵
              </span>
            </div>

            {/* Action 2: Matching Product Lots List */}
            {matchingStocks.length > 0 && (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Matching Products & Lots ({matchingStocks.length})
                </div>
                {matchingStocks.map((item, idx) => {
                  const isSelected = activeIndex === idx
                  const stockQty = item.quantity ?? (item as any).totalQuantity ?? 0

                  return (
                    <div
                      key={item.lotId}
                      onClick={() => {
                        onSelectStock(item)
                        setQuery("")
                        setIsOpen(false)
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
                          <span>Stock: <strong className="text-slate-800">{stockQty} {item.baseUnit}</strong></span>
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

      {/* ─── Invoice Found Card with Purchased Items ─────────────────── */}
      {foundSale && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3 animate-in fade-in zoom-in-98 duration-150">
          <div className="flex items-center justify-between pb-2.5 border-b border-emerald-200/80">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-800">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                  <span>Memo #{foundSale.invoiceNo}</span>
                  <span className="text-[10px] font-semibold bg-emerald-200 text-emerald-900 px-2 py-0.2 rounded-full">
                    Invoice Matched
                  </span>
                </div>
                <div className="text-[11px] text-emerald-800">
                  Customer: <strong>{foundSale.customerName || "Walk-in Retail"}</strong> · Date: {new Date(foundSale.saleDate).toLocaleDateString("en-US")}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Bill</span>
                <span className="font-mono font-black text-emerald-950">{tk(foundSale.totalAmount)}</span>
              </div>
              <button
                type="button"
                onClick={onClearInvoice}
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Clear invoice match"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Purchased Item Selector */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-emerald-950 block">
              Click an item from this invoice to return:
            </span>
            <div className="grid grid-cols-1 gap-2">
              {foundSale.items && foundSale.items.length > 0 ? (
                foundSale.items.map((it) => {
                  const isSelected = selectedInvoiceItemLotId === it.lotId || (selectedStockItem && selectedStockItem.lotId === it.lotId)

                  return (
                    <div
                      key={it.id || it.lotId}
                      onClick={() => handleInvoiceItemClick(it)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20"
                          : "bg-white/80 border-emerald-200/90 hover:border-emerald-400 hover:bg-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {it.productNameBn || it.productNameEn}
                          </span>
                          <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                            Lot #{formatLotNumber(it.lotNumber)}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.2 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>Selected</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-3">
                          <span>Purchased: <strong className="text-slate-900 font-mono">{it.totalQuantity} {it.baseUnit || "unit"}</strong></span>
                          <span>·</span>
                          <span>Billed Rate: <strong className="text-emerald-800 font-mono">{tk(it.unitPrice)}</strong></span>
                          <span>·</span>
                          <span>Line Total: <strong className="text-slate-900 font-mono">{tk(it.subtotal)}</strong></span>
                        </div>
                      </div>

                      <div className="ml-3 shrink-0">
                        <button
                          type="button"
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            isSelected
                              ? "bg-emerald-700 text-white"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                          }`}
                        >
                          {isSelected ? "Selected" : "Select"}
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-xs text-slate-500 italic">No line items recorded for this invoice.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Selected Product Card (Direct Return or Selected Item) ─── */}
      {!foundSale && selectedStockItem && (
        <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-center justify-between animate-in fade-in duration-100">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold text-slate-900 text-sm">
                {selectedStockItem.nameBn || selectedStockItem.productNameBn} ({selectedStockItem.nameEn || selectedStockItem.productNameEn})
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                  Lot #{formatLotNumber(selectedStockItem.lotNumber)}
                </span>
                <span>·</span>
                <span>Barcode: {selectedStockItem.lotBarcode || selectedStockItem.barcode || "N/A"}</span>
                <span>·</span>
                <span>Exp: {selectedStockItem.expiryDate || "N/A"}</span>
                <span>·</span>
                <span>Unit: {selectedStockItem.baseUnit}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-900 font-mono tabular-nums">
                Rate: {tk(selectedStockItem.lotRetailPrice)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Current Stock: {selectedStockItem.quantity ?? (selectedStockItem as any).totalQuantity ?? 0} {selectedStockItem.baseUnit}
              </div>
            </div>
            <button
              type="button"
              onClick={onClearSelectedStock}
              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
              title="Remove selected product"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
