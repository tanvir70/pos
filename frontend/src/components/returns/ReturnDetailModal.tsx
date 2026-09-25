import React from "react"
import {
  RotateCcw,
  X,
  User,
  Phone,
  Receipt,
  Printer,
} from "lucide-react"
import type { SaleReturnResponse } from "../../types"
import { formatLotNumber } from "../../utils/lotNumber"

export interface ReturnDetailModalProps {
  returnDetail: SaleReturnResponse | null
  onClose: () => void
  onPrintThermal: (ret: SaleReturnResponse) => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ReturnDetailModal({
  returnDetail,
  onClose,
  onPrintThermal,
}: ReturnDetailModalProps) {
  if (!returnDetail) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Sales Return Voucher #{returnDetail.returnNo}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    returnDetail.refundType === "DUE_ADJUSTMENT"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {returnDetail.refundType === "DUE_ADJUSTMENT"
                    ? "Due Adjustment (বাকি সমন্বয়)"
                    : "Cash Refund (ক্যাশ ফেরত)"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Processed on {new Date(returnDetail.returnDate).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Meta Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Customer
            </span>
            <p className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{returnDetail.customerName || "Walk-in Cash Customer"}</span>
            </p>
            {returnDetail.customerPhone && (
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{returnDetail.customerPhone}</span>
              </p>
            )}
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Original Invoice
            </span>
            <p className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                {returnDetail.originalSaleId
                  ? `Sale #${returnDetail.originalSaleId}`
                  : "Direct Return (No memo)"}
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {returnDetail.originalSaleId ? "Receipt matched" : "Counter receipt-less return"}
            </p>
          </div>

          <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
              Total Refund
            </span>
            <p className="text-lg font-black font-mono text-emerald-900 mt-0.5">
              {tk(returnDetail.totalRefundAmount)}
            </p>
            <span className="text-[10px] font-semibold text-emerald-700">
              {returnDetail.refundType === "DUE_ADJUSTMENT"
                ? "Deducted from customer due"
                : "Cash paid out at counter"}
            </span>
          </div>
        </div>

        {/* Return Reason if present */}
        {returnDetail.reason && (
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900">
            <span className="font-bold">Return Reason / Notes: </span>
            <span>{returnDetail.reason}</span>
          </div>
        )}

        {/* Itemized Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Returned Products ({returnDetail.items?.length || 0})
          </h4>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Product & Lot</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Refund Rate</th>
                  <th className="py-2.5 px-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returnDetail.items && returnDetail.items.length > 0 ? (
                  returnDetail.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-900">
                          {it.productNameBn || it.productNameEn || `Lot #${it.lotId}`}
                        </p>
                        {it.productNameEn && it.productNameBn && (
                          <p className="text-[11px] text-slate-500">{it.productNameEn}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 text-slate-700">
                            {formatLotNumber(it.lotNumber)}
                          </span>
                          {it.barcode && (
                            <span className="text-[10px] font-mono text-slate-400">
                              {it.barcode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold font-mono tabular-nums text-slate-800">
                        {it.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {tk(it.refundPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono tabular-nums text-slate-900">
                        {tk(it.subtotal || it.quantity * it.refundPrice)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                      No items listed for this return
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-right text-slate-700">
                    Total Refund Amount:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm text-emerald-800 tabular-nums">
                    {tk(returnDetail.totalRefundAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onPrintThermal(returnDetail)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-black transition-all cursor-pointer shadow-xs flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print 80mm Thermal Slip</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer text-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
