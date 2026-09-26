import React from "react"
import {
  ClipboardEdit,
  AlertTriangle,
  CheckCircle2,
  Banknote,
  User,
  Loader2,
  Package,
  Trash2,
  X,
  ShieldAlert,
} from "lucide-react"
import CustomerSearchSelect from "./CustomerSearchSelect"
import type {
  StockItem,
  Customer,
  SaleResponse,
  SaleItemResponse,
  RefundType,
  ReturnDraftItem,
} from "../../types"
import { formatLotNumber } from "../../utils/lotNumber"
import { isDiscreteUnit, formatQuantityByUnit } from "../../utils/unit"
import ReturnSuperSearch from "./ReturnSuperSearch"

export interface ReturnProcessingFormProps {
  onSearchInvoice: (invoiceNo: string) => Promise<void>
  onClearInvoice: () => void
  isSearchingInvoice: boolean
  invoiceSearchError: string | null
  foundSale: SaleResponse | null
  onSelectFoundSale?: (sale: SaleResponse) => void
  customers: Customer[]
  selectedCustomerId: number | null
  onSelectCustomerId: (id: number | null) => void
  stocks: StockItem[]
  selectedStockItem?: StockItem | null
  onSelectStock: (item: StockItem) => void
  onClearSelectedStock?: () => void
  // Multi-item return props
  returnItems: ReturnDraftItem[]
  onUpdateReturnItem: (lotId: number, field: keyof ReturnDraftItem, val: any) => void
  onRemoveReturnItem: (lotId: number) => void
  onClearAllReturnItems: () => void
  onToggleInvoiceItem: (saleItem: SaleItemResponse, stockItem: StockItem) => void
  onSelectAllInvoiceItems: () => void
  onDeselectAllInvoiceItems: () => void
  // Refund options & submission
  refundType: RefundType
  onRefundTypeChange: (type: RefundType) => void
  reason: string
  onReasonChange: (val: string) => void
  calculatedTotalRefund: number
  isSubmitting: boolean
  formError: string | null
  onSubmit: (e: React.FormEvent) => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ReturnProcessingForm({
  onSearchInvoice,
  onClearInvoice,
  isSearchingInvoice,
  invoiceSearchError,
  foundSale,
  onSelectFoundSale,
  customers,
  selectedCustomerId,
  onSelectCustomerId,
  stocks,
  selectedStockItem,
  onSelectStock,
  onClearSelectedStock,
  returnItems,
  onUpdateReturnItem,
  onRemoveReturnItem,
  onClearAllReturnItems,
  onToggleInvoiceItem,
  onSelectAllInvoiceItems,
  onDeselectAllInvoiceItems,
  refundType,
  onRefundTypeChange,
  reason,
  onReasonChange,
  calculatedTotalRefund,
  isSubmitting,
  formError,
  onSubmit,
}: ReturnProcessingFormProps) {
  const selectedLotIds = returnItems.map((it) => it.lotId)

  return (
    <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ClipboardEdit className="w-5 h-5 text-emerald-700" />
          <h2 className="font-bold text-slate-900 text-base sm:text-lg">
            Return Form
          </h2>
        </div>
        {returnItems.length > 0 && (
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            {returnItems.length} {returnItems.length === 1 ? "item" : "items"} queued
          </span>
        )}
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {/* 1. Super Search (Invoice, Suffix #217, Barcode, Product, Lot) */}
        <ReturnSuperSearch
          stocks={stocks}
          selectedStockItem={selectedStockItem}
          onSelectStock={onSelectStock}
          onClearSelectedStock={onClearSelectedStock}
          foundSale={foundSale}
          isSearchingInvoice={isSearchingInvoice}
          invoiceSearchError={invoiceSearchError}
          onSearchInvoice={onSearchInvoice}
          onClearInvoice={onClearInvoice}
          onSelectFoundSale={onSelectFoundSale}
          selectedLotIds={selectedLotIds}
          onToggleInvoiceItem={onToggleInvoiceItem}
          onSelectAllInvoiceItems={onSelectAllInvoiceItems}
          onDeselectAllInvoiceItems={onDeselectAllInvoiceItems}
        />

        {/* 2. Searchable Customer Ledger Profile */}
        <CustomerSearchSelect
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onSelectCustomerId={onSelectCustomerId}
          refundType={refundType}
        />

        {/* 3. Multi-Item Return Table / Cart */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <Package className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Selected Return Items ({returnItems.length})
              </span>
            </div>
            {returnItems.length > 0 && (
              <button
                type="button"
                onClick={onClearAllReturnItems}
                className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          {returnItems.length === 0 ? (
            <div className="p-5 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
              <Package className="w-6 h-6 text-slate-400 mx-auto mb-1.5 opacity-60" />
              <p className="font-bold text-slate-700">No items queued for return</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Search memo / invoice above and select items, or search product barcode to return.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {returnItems.map((item) => {
                const qtyVal = parseFloat(item.quantity) || 0
                const priceVal = parseFloat(item.refundPrice) || 0
                const lineTotal = qtyVal * priceVal

                return (
                  <div
                    key={item.lotId}
                    className="p-3 bg-white border border-slate-200/90 rounded-xl shadow-2xs space-y-2 hover:border-slate-300 transition-colors"
                  >
                    {/* Item Heading */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">
                          {item.productNameBn || item.productName}
                          {item.productNameEn && item.productNameBn ? ` (${item.productNameEn})` : ""}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                          <span className="font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                            Lot #{formatLotNumber(item.lotNumber)}
                          </span>
                          {item.barcode && (
                            <span className="font-mono text-slate-400">#{item.barcode}</span>
                          )}
                          {item.purchasedQuantity != null && (
                            <span className="text-emerald-700 font-medium">
                              Purchased: <strong>{formatQuantityByUnit(item.purchasedQuantity, item.baseUnit)} {item.baseUnit}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Subtotal</span>
                          <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 tabular-nums">
                            {tk(lineTotal)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveReturnItem(item.lotId)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inputs Row: Quantity, Refund Rate, Quarantine Damaged Toggle */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-700">
                            Return Qty ({item.baseUnit}) *
                          </label>
                          {isDiscreteUnit(item.baseUnit) && (
                            <span className="text-[10px] text-slate-400 font-medium">Whole unit</span>
                          )}
                        </div>
                        <input
                          type="number"
                          step={isDiscreteUnit(item.baseUnit) ? "1" : "0.001"}
                          min={isDiscreteUnit(item.baseUnit) ? "1" : "0.001"}
                          max={item.purchasedQuantity != null ? item.purchasedQuantity : undefined}
                          required
                          value={item.quantity}
                          onChange={(e) => {
                            let val = e.target.value
                            if (isDiscreteUnit(item.baseUnit) && val.includes(".")) {
                              val = val.split(".")[0]
                            }
                            onUpdateReturnItem(item.lotId, "quantity", val)
                          }}
                          placeholder={isDiscreteUnit(item.baseUnit) ? "1" : "1.000"}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold font-mono text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Refund Rate (৳) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={item.refundPrice}
                          onChange={(e) => onUpdateReturnItem(item.lotId, "refundPrice", e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold font-mono text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-hidden"
                        />
                      </div>

                      <div className="flex flex-col justify-end">
                        <label
                          className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                            item.isDamaged
                              ? "bg-amber-50 border-amber-300 text-amber-900"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={item.isDamaged}
                            onChange={(e) => onUpdateReturnItem(item.lotId, "isDamaged", e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                          />
                          <span className="text-[11px]">Damaged / Leaked</span>
                          {item.isDamaged && (
                            <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded ml-auto">
                              Quarantine
                            </span>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 4. Refund Method */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Refund Method *
          </label>
          <div className="grid grid-cols-2 gap-2 bg-slate-100/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => onRefundTypeChange("CASH_REFUND")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                refundType === "CASH_REFUND"
                  ? "bg-white text-slate-950 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Banknote className="w-4 h-4 text-emerald-600" />
              <span>Cash Refund (Till)</span>
            </button>
            <button
              type="button"
              onClick={() => onRefundTypeChange("DUE_ADJUSTMENT")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                refundType === "DUE_ADJUSTMENT"
                  ? "bg-white text-indigo-950 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <User className="w-4 h-4 text-indigo-600" />
              <span>Due Adjustment (Ledger)</span>
            </button>
          </div>
        </div>

        {/* 5. Return Reason */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reason for Return
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="e.g. Unopened leftover after spraying season"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:border-emerald-600 focus:outline-hidden"
          />
        </div>

        {/* 6. Total Summary & Submit Action */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Total Refund Payable</span>
            <div className="text-2xl font-black font-mono text-slate-900 tabular-nums">
              {tk(calculatedTotalRefund)}
            </div>
            <span className="text-[11px] font-semibold text-emerald-700">
              {refundType === "CASH_REFUND"
                ? "Cash paid directly from till"
                : "Credited to customer ledger (store credit if exceeds due)"}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || returnItems.length === 0}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-white bg-slate-950 hover:bg-slate-800 transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Process Return & Print Voucher {returnItems.length > 0 ? `(${returnItems.length} items)` : ""}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
