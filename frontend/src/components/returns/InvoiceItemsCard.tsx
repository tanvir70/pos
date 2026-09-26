import React from "react"
import {
  Receipt,
  Check,
  CheckSquare,
  Square,
  X,
} from "lucide-react"
import type { SaleResponse, SaleItemResponse, StockItem } from "../../types"
import { formatLotNumber } from "../../utils/lotNumber"
import { formatQuantityByUnit } from "../../utils/unit"

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
    const stockToUse: StockItem = stocks.find((s) => s.lotId === it.lotId) || ({
      id: it.lotId,
      lotId: it.lotId,
      productId: 0,
      nameEn: it.productNameEn || "",
      nameBn: it.productNameBn,
      productNameEn: it.productNameEn || "",
      productNameBn: it.productNameBn,
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
  const selectedCount = selectedLotIds.length

  return (
    <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3 animate-in fade-in zoom-in-98 duration-150">
      {/* Invoice Banner Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-emerald-200/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-emerald-100 rounded-xl text-emerald-800 shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-emerald-950 flex items-center gap-2 flex-wrap">
              <span className="font-mono">Memo #{foundSale.invoiceNo}</span>
              <span className="text-[10px] font-semibold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                Invoice Matched
              </span>
            </div>
            <div className="text-[11px] text-emerald-800 flex items-center gap-2 mt-0.5 flex-wrap">
              <span>Customer: <strong>{foundSale.customerName || "Walk-in Retail"}</strong></span>
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
            <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Bill</span>
            <span className="font-mono font-black text-emerald-950 text-xs sm:text-sm">
              {tk(foundSale.totalAmount)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClearInvoice}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            title="Clear invoice match"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Multi-Select Purchased Items from Invoice */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-emerald-950">
            Select items to return ({selectedCount} of {allItems.length} selected):
          </span>
          <div className="flex items-center gap-2">
            {onSelectAllInvoiceItems && (
              <button
                type="button"
                onClick={onSelectAllInvoiceItems}
                className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-md cursor-pointer transition-colors"
              >
                Select All Items
              </button>
            )}
            {onDeselectAllInvoiceItems && (
              <button
                type="button"
                onClick={onDeselectAllInvoiceItems}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md cursor-pointer transition-colors"
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

              return (
                <div
                  key={it.id || it.lotId}
                  onClick={() => handleInvoiceItemClick(it)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? "bg-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20"
                      : "bg-white/80 border-emerald-200/90 hover:border-emerald-400 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="shrink-0 text-emerald-700">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-700" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">
                          {it.productNameBn || it.productNameEn}
                        </span>
                        <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                          Lot #{formatLotNumber(it.lotNumber)}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.2 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Queued for return</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>
                          Purchased: <strong className="text-slate-900 font-mono">{formatQuantityByUnit(it.totalQuantity, it.baseUnit)} {it.baseUnit || "unit"}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Billed Rate: <strong className="text-emerald-800 font-mono">{tk(it.unitPrice)}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Line Total: <strong className="text-slate-900 font-mono">{tk(it.subtotal)}</strong>
                        </span>
                      </div>
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
            <p className="text-xs text-slate-500 italic p-3 text-center">No line items recorded for this invoice.</p>
          )}
        </div>
      </div>
    </div>
  )
}
