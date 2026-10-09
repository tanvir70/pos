import React from "react"
import {
  Receipt,
  Check,
  CheckSquare,
  Square,
  X,
  Lock,
} from "lucide-react"
import type { SaleResponse, SaleItemResponse, StockItem } from "../../types"
import { formatLotNumber } from "../../utils/lotNumber"
import { formatQuantityByUnit, pluralizeUnit } from "../../utils/unit"

export interface InvoiceItemsCardProps {
  foundSale: SaleResponse
  stocks: StockItem[]
  selectedLotIds: number[]
  onClearInvoice: () => void
  onToggleInvoiceItem: (saleItem: SaleItemResponse, stockItem: StockItem) => void
  onSelectAllInvoiceItems?: () => void
  onDeselectAllInvoiceItems?: () => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function InvoiceItemsCard({
  foundSale,
  stocks,
  selectedLotIds,
  onClearInvoice,
  onToggleInvoiceItem,
  onSelectAllInvoiceItems,
  onDeselectAllInvoiceItems,
}: InvoiceItemsCardProps) {
  const handleInvoiceItemClick = (it: SaleItemResponse) => {
    const returnedQty = it.returnedQuantity ?? 0
    const remainingQty = it.remainingQuantity != null ? it.remainingQuantity : Math.max(0, it.totalQuantity - returnedQty)
    if (remainingQty <= 0) return // Fully returned item cannot be selected

    const stockToUse: StockItem = stocks.find((s) => s.lotId === it.lotId) || ({
      id: it.lotId,
      lotId: it.lotId,
      productId: 0,
      nameEn: it.productNameEn || "",
      nameBn: it.productNameBn,
      productNameEn: it.productNameEn || "",
      productNameBn: it.productNameBn,
      packSize: it.packSize,
      unitSize: it.unitSize,
      productCode: "",
      lotNumber: it.lotNumber,
      category: "",
      baseUnit: it.baseUnit || "unit",
      cartonMultiplier: it.cartonMultiplier || 1,
      defaultBarcode: it.barcode,
      entryDate: "",
      expiryDate: it.expiryDate || "",
      purchaseCost: it.unitCost || 0,
      lotRetailPrice: it.unitPrice,
      lotWholesalePrice: it.unitPrice,
      lotBarcode: it.barcode,
      quantity: 0,
      location: "DOKAN",
      status: "ACTIVE",
    } as unknown as StockItem)

    onToggleInvoiceItem(it, stockToUse)
  }

  const allItems = foundSale.items || []
  const availableItems = allItems.filter((it) => {
    const returnedQty = it.returnedQuantity ?? 0
    const remainingQty = it.remainingQuantity != null ? it.remainingQuantity : it.totalQuantity - returnedQty
    return remainingQty > 0
  })
  const selectedCount = selectedLotIds.length

  return (
    <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 space-y-3 animate-in fade-in zoom-in-98 duration-150">
      {/* Invoice Banner Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-emerald-200/80 dark:border-emerald-800/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 rounded-xl text-emerald-800 dark:text-emerald-200 shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-2 flex-wrap">
              <span className="font-mono">Memo #{foundSale.invoiceNo}</span>
              <span className="text-[10px] font-semibold bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded-full">
                Invoice Matched & Verified
              </span>
            </div>
            <div className="text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2 mt-0.5 flex-wrap">
              <span>Customer: <strong>{foundSale.customerName || "Walk-in Retail"}</strong></span>
              {foundSale.customerPhone && <span>({foundSale.customerPhone})</span>}
              <span>·</span>
              <span>
                Date: {new Date(foundSale.saleDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span>·</span>
              <span>{allItems.length} {allItems.length === 1 ? "item" : "items"} purchased</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">Total Bill</span>
            <span className="font-mono font-black text-emerald-950 dark:text-emerald-100 text-xs sm:text-sm">
              {tk(foundSale.totalAmount)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClearInvoice}
            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
            title="Clear invoice match"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Multi-Select Purchased Items from Invoice */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-emerald-950 dark:text-emerald-100">
            Select product(s) to return ({selectedCount} of {availableItems.length} available selected):
          </span>
          <div className="flex items-center gap-2">
            {onSelectAllInvoiceItems && availableItems.length > 0 && (
              <button
                type="button"
                onClick={onSelectAllInvoiceItems}
                className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200 hover:text-emerald-950 dark:hover:text-emerald-100 bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 dark:hover:bg-emerald-800 px-2.5 py-1 rounded-md cursor-pointer transition-colors"
              >
                Select All Available
              </button>
            )}
            {onDeselectAllInvoiceItems && (
              <button
                type="button"
                onClick={onDeselectAllInvoiceItems}
                className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md cursor-pointer transition-colors"
              >
                Deselect All
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {allItems.length > 0 ? (
            allItems.map((it) => {
              const isSelected = selectedLotIds.includes(it.lotId)
              const returnedQty = it.returnedQuantity ?? 0
              const remainingQty = it.remainingQuantity != null ? it.remainingQuantity : Math.max(0, it.totalQuantity - returnedQty)
              const isFullyReturned = remainingQty <= 0

              return (
                <div
                  key={it.id || it.lotId}
                  onClick={() => !isFullyReturned && handleInvoiceItemClick(it)}
                  className={`p-3 rounded-xl border text-xs transition-all flex items-center justify-between ${
                    isFullyReturned
                      ? "bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed"
                      : isSelected
                      ? "bg-white dark:bg-slate-900 border-emerald-600 dark:border-emerald-500 shadow-xs ring-2 ring-emerald-500/20 cursor-pointer"
                      : "bg-white/80 dark:bg-slate-900/80 border-emerald-200/90 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-white dark:hover:bg-slate-900 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="shrink-0 text-emerald-700 dark:text-emerald-400">
                      {isFullyReturned ? (
                        <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      ) : isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {it.productNameBn || it.productNameEn}
                        </span>
                        <span className="font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                          Lot #{formatLotNumber(it.lotNumber)}
                        </span>
                        {it.packSize && (
                          <span className="shrink-0 text-[10px] font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-800">
                            {it.packSize}
                          </span>
                        )}
                        {isFullyReturned ? (
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.2 rounded-full">
                            Fully Returned
                          </span>
                        ) : isSelected ? (
                          <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.2 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Queued for return</span>
                          </span>
                        ) : null}
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>
                          Purchased: <strong className="text-slate-900 dark:text-slate-100 font-mono">{formatQuantityByUnit(it.totalQuantity, it.baseUnit)} {pluralizeUnit(it.baseUnit || "Unit", it.totalQuantity)}</strong>
                        </span>
                        {returnedQty > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-amber-700 dark:text-amber-400">
                              Already Returned: <strong className="font-mono">{formatQuantityByUnit(returnedQty, it.baseUnit)}</strong>
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span className="text-emerald-800 dark:text-emerald-300">
                          Remaining Returnable: <strong className="font-mono font-bold">{formatQuantityByUnit(remainingQty, it.baseUnit)}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Billed Rate: <strong className="text-emerald-800 dark:text-emerald-300 font-mono">{tk(it.unitPrice)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ml-3 shrink-0">
                    <button
                      type="button"
                      disabled={isFullyReturned}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        isFullyReturned
                          ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                          : isSelected
                          ? "bg-emerald-700 dark:bg-emerald-600 text-white"
                          : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                      }`}
                    >
                      {isFullyReturned ? "Returned" : isSelected ? "Selected" : "Select"}
                    </button>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic p-3 text-center">No line items recorded for this invoice.</p>
          )}
        </div>
      </div>
    </div>
  )
}
