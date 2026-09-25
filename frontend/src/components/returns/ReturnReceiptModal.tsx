import React from "react"
import { CheckCircle2, X, Printer } from "lucide-react"
import type { SaleReturnResponse } from "../../types"

export interface ReturnReceiptModalProps {
  voucher: SaleReturnResponse | null
  onClose: () => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ReturnReceiptModal({ voucher, onClose }: ReturnReceiptModalProps) {
  if (!voucher) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 print:m-0 print:p-0 print:border-none print:shadow-none print-area">
        {/* Actions Header (hidden on print) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 no-print">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-base">
              Return Voucher
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 leading-none cursor-pointer p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Slip Content */}
        <div className="py-3 text-center border-b border-dashed border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            Rajib Enterprise
          </h2>
          <p className="text-xs text-slate-500">
            Authorized Agro Dealer · Uttar Bazar, Belabo, Narsingdi
          </p>
          <div className="inline-block mt-1 px-2.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900">
            Sales Return Voucher (Credit Note)
          </div>
        </div>

        {/* Voucher Meta */}
        <div className="py-2.5 text-xs space-y-1 border-b border-slate-200/60">
          <div className="flex justify-between">
            <span className="text-slate-500">Voucher No:</span>
            <span className="font-mono font-bold">{voucher.returnNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Date & Time:</span>
            <span className="tabular-nums">
              {new Date(voucher.returnDate).toLocaleString("en-US")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Customer:</span>
            <span className="font-semibold">
              {voucher.customerName || "Walk-in general customer"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Refund Method:</span>
            <span className="font-bold text-emerald-800">
              {voucher.refundType === "DUE_ADJUSTMENT" ? "Due Adjustment" : "Cash Refund"}
            </span>
          </div>
        </div>

        {/* Items Summary */}
        <div className="py-3 text-xs">
          <p className="font-semibold text-slate-900 mb-1.5">Returned Items:</p>
          {voucher.items && voucher.items.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-1">Product</th>
                  <th className="pb-1 text-center">Qty</th>
                  <th className="pb-1 text-right">Rate</th>
                  <th className="pb-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40">
                {voucher.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-1">
                      {it.productNameBn || it.productNameEn || `Lot #${it.lotId}`}
                    </td>
                    <td className="py-1 text-center tabular-nums">{it.quantity}</td>
                    <td className="py-1 text-right tabular-nums">{tk(it.refundPrice)}</td>
                    <td className="py-1 text-right tabular-nums font-bold">
                      {tk(it.subtotal || it.quantity * it.refundPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-slate-500 italic">Item details preserved</p>
          )}
        </div>

        {/* Total */}
        <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
          <span>Total Refund Amount:</span>
          <span className="text-base text-emerald-800 tabular-nums">
            {tk(voucher.totalRefundAmount)}
          </span>
        </div>

        {voucher.reason && (
          <p className="text-[11px] text-slate-500 mt-2">
            Note: {voucher.reason}
          </p>
        )}

        {/* Print Buttons (no-print) */}
        <div className="mt-5 pt-3 border-t border-slate-200 flex gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-black transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Voucher</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer text-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
