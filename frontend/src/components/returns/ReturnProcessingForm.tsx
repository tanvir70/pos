import React from "react"
import {
  ClipboardEdit,
  AlertTriangle,
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
  SaleItemResponse,
  RefundType,
} from "../../types"
import ReturnSuperSearch from "./ReturnSuperSearch"

export interface ReturnProcessingFormProps {
  onSearchInvoice: (invoiceNo: string) => Promise<void>
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
  onClearSelectedStock: () => void
  onSelectInvoiceItem?: (saleItem: SaleItemResponse, stockItem: StockItem) => void
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
  onClearSelectedStock,
  onSelectInvoiceItem,
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
        {/* 1. Super Search (Invoice, Barcode, Product, Lot) */}
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
          onSelectInvoiceItem={onSelectInvoiceItem}
          selectedInvoiceItemLotId={selectedStockItem?.lotId}
        />

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

        {/* 3. Return Quantity & Refund Rate */}
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
