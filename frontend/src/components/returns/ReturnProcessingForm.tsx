import React from "react"
import {
  ClipboardEdit,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  Banknote,
  User,
  Loader2,
} from "lucide-react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select"
import type {
  StockItem,
  Customer,
  SaleResponse,
  RefundType,
} from "../../types"
import ProductSearch from "../pos/ProductSearch"
import { formatLotNumber } from "../../utils/lotNumber"

export interface ReturnProcessingFormProps {
  invoiceInput: string
  onInvoiceInputChange: (val: string) => void
  onSearchInvoice: () => void
  onClearInvoice: () => void
  isSearchingInvoice: boolean
  invoiceSearchError: string | null
  foundSale: SaleResponse | null
  customers: Customer[]
  selectedCustomerId: number | null
  onSelectCustomerId: (id: number | null) => void
  stocks: StockItem[]
  selectedStockItem: StockItem | null
  onSelectStock: (item: StockItem) => void
  quantity: string
  onQuantityChange: (val: string) => void
  refundPrice: string
  onRefundPriceChange: (val: string) => void
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
  invoiceInput,
  onInvoiceInputChange,
  onSearchInvoice,
  onClearInvoice,
  isSearchingInvoice,
  invoiceSearchError,
  foundSale,
  customers,
  selectedCustomerId,
  onSelectCustomerId,
  stocks,
  selectedStockItem,
  onSelectStock,
  quantity,
  onQuantityChange,
  refundPrice,
  onRefundPriceChange,
  refundType,
  onRefundTypeChange,
  reason,
  onReasonChange,
  calculatedTotalRefund,
  isSubmitting,
  formError,
  onSubmit,
}: ReturnProcessingFormProps) {
  return (
    <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ClipboardEdit className="w-5 h-5 text-emerald-700" />
          <h2 className="font-bold text-slate-900 text-base sm:text-lg">
            Return Form
          </h2>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {/* 1. Memo / Invoice Lookup (Optional) */}
        <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-slate-500" />
              <span>Original Memo / Invoice No. (Optional)</span>
            </label>
            {foundSale && (
              <button
                type="button"
                onClick={onClearInvoice}
                className="text-[11px] text-rose-600 font-semibold hover:underline cursor-pointer"
              >
                Clear memo
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={invoiceInput}
              onChange={(e) => onInvoiceInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  onSearchInvoice()
                }
              }}
              placeholder="e.g. INV-20260917-1042"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white font-mono placeholder:font-sans focus:border-emerald-600 focus:outline-hidden"
            />
            <button
              type="button"
              onClick={onSearchInvoice}
              disabled={isSearchingInvoice || !invoiceInput.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {isSearchingInvoice ? "Searching..." : "Find Memo"}
            </button>
          </div>

          {invoiceSearchError && (
            <p className="text-xs text-amber-700 font-medium mt-1.5">
              {invoiceSearchError}
            </p>
          )}

          {foundSale && (
            <div className="mt-2.5 pt-2 border-t border-slate-200/80 text-xs bg-emerald-50/70 p-2.5 rounded-xl text-emerald-900 flex items-center justify-between">
              <div>
                <div className="font-bold">Memo #{foundSale.invoiceNo}</div>
                <div className="text-[11px] text-emerald-800">
                  Customer: {foundSale.customerName || "Walk-in Retail"} · Date: {new Date(foundSale.saleDate).toLocaleDateString("en-US")}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Bill</span>
                <span className="font-mono font-black">{tk(foundSale.totalAmount)}</span>
              </div>
            </div>
          )}
        </div>

        {/* 2. Customer Ledger Profile */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-900">
              Customer Ledger Account {refundType === "DUE_ADJUSTMENT" ? "*" : "(Optional for Cash Refund)"}
            </label>
            {selectedCustomerId && (
              <button
                type="button"
                onClick={() => onSelectCustomerId(null)}
                className="text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer"
              >
                Clear Customer
              </button>
            )}
          </div>
          <Select
            value={selectedCustomerId ? String(selectedCustomerId) : "WALK_IN"}
            onValueChange={(val) =>
              onSelectCustomerId(val === "WALK_IN" ? null : Number(val))
            }
          >
            <SelectTrigger
              className={`w-full bg-white text-xs sm:text-sm py-2.5 ${
                refundType === "DUE_ADJUSTMENT" && !selectedCustomerId
                  ? "border-rose-300 bg-rose-50/30"
                  : "border-slate-200"
              }`}
            >
              <SelectValue placeholder="Walk-in / Cash Buyer (No Ledger Profile)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WALK_IN">Walk-in / Cash Buyer (No Ledger Profile)</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name} {c.businessName ? `(${c.businessName})` : ""}
                  {Number(c.currentDue || 0) > 0 ? ` — Due: ${tk(c.currentDue)}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {refundType === "DUE_ADJUSTMENT" && !selectedCustomerId && (
            <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Due adjustment requires a customer ledger profile to deduct from.</span>
            </p>
          )}
        </div>

        {/* 3. Product & Lot Selection using POS-grade ProductSearch */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-900">
            Select Product & Lot to Return *
          </label>

          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
            <ProductSearch
              stocks={stocks}
              onSelect={onSelectStock}
              allowZeroStock={true}
              placeholder="Scan barcode or search product name / code / lot..."
              className="border-none px-3 py-2 bg-slate-50/40"
            />
          </div>

          {selectedStockItem && (
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-center justify-between">
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
              <div className="text-right shrink-0">
                <div className="text-xs font-bold text-slate-900 font-mono tabular-nums">
                  Rate: {tk(selectedStockItem.lotRetailPrice)}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Current Stock: {selectedStockItem.quantity ?? (selectedStockItem as any).totalQuantity ?? 0} {selectedStockItem.baseUnit}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Return Quantity & Refund Rate */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Return Quantity ({selectedStockItem?.baseUnit || "unit"}) *
            </label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              required
              value={quantity}
              onChange={(e) => onQuantityChange(e.target.value)}
              placeholder="1"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Refund Rate per Unit (৳) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={refundPrice}
              onChange={(e) => onRefundPriceChange(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* 5. Refund Method */}
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

        {/* 6. Return Reason */}
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

        {/* 7. Total Summary & Submit Action */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Total Refund Payable</span>
            <div className="text-2xl font-black font-mono text-slate-900 tabular-nums">
              {tk(calculatedTotalRefund)}
            </div>
            <span className="text-[11px] font-semibold text-emerald-700">
              {refundType === "CASH_REFUND"
                ? "Cash paid directly from till"
                : "Credited to customer ledger due"}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !selectedStockItem}
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
                <span>Process Return & Print Voucher</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
