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
import { formatQuantityByUnit } from "../../utils/unit"

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
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Sales Return Voucher #{returnDetail.returnNo}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    returnDetail.refundType === "DUE_ADJUSTMENT"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                      : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  }`}
                >
                  {returnDetail.refundType === "DUE_ADJUSTMENT"
                    ? "Due Adjustment (বাকি সমন্বয়)"
                    : "Cash Refund (ক্যাশ ফেরত)"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Processed on {new Date(returnDetail.returnDate).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Meta Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Customer
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{returnDetail.customerName || "Walk-in Cash Customer"}</span>
            </p>
            {returnDetail.customerPhone && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{returnDetail.customerPhone}</span>
              </p>
            )}
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Original Invoice
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                {returnDetail.originalSaleId
                  ? `Sale #${returnDetail.originalSaleId}`
                  : "Direct Return (No memo)"}
              </span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {returnDetail.originalSaleId ? "Receipt matched" : "Counter receipt-less return"}
            </p>
          </div>

          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
              Total Refund
            </span>
            <p className="text-lg font-black font-mono text-emerald-900 dark:text-emerald-200 mt-0.5">
              {tk(returnDetail.totalRefundAmount)}
            </p>
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
              {returnDetail.refundType === "DUE_ADJUSTMENT"
                ? "Deducted from customer due"
                : "Cash paid out at counter"}
            </span>
          </div>
        </div>

        {/* Return Reason if present */}
        {returnDetail.reason && (
          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 rounded-xl text-xs text-amber-900 dark:text-amber-200">
            <span className="font-bold">Return Reason / Notes: </span>
            <span>{returnDetail.reason}</span>
          </div>
        )}

        {/* Itemized Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Returned Products ({returnDetail.items?.length || 0})
          </h4>
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Product & Lot</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Refund Rate</th>
                  <th className="py-2.5 px-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {returnDetail.items && returnDetail.items.length > 0 ? (
                  returnDetail.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {it.productNameBn || it.productNameEn || `Lot #${it.lotId}`}
                        </p>
                        {it.productNameEn && it.productNameBn && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{it.productNameEn}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            {formatLotNumber(it.lotNumber)}
                          </span>
                          {it.barcode && (
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                              {it.barcode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {formatQuantityByUnit(it.quantity, (it as any).baseUnit)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {tk(it.refundPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {tk(it.subtotal || it.quantity * it.refundPrice)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400 dark:text-slate-500 italic">
                      No items listed for this return
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 font-bold">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                    Total Refund Amount:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm text-emerald-800 dark:text-emerald-300 tabular-nums">
                    {tk(returnDetail.totalRefundAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onPrintThermal(returnDetail)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-emerald-600 text-white hover:bg-black dark:hover:bg-emerald-700 transition-all cursor-pointer shadow-xs flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print 80mm Thermal Slip</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer text-slate-700 dark:text-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
