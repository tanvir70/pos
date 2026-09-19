import { useCallback, useEffect } from "react"
import { Printer, X } from "lucide-react"
import type { SaleResponse } from "../types"

// BUSINESS DECISION: Thermal receipt (80mm/58mm) formatted specifically for fast retail counter
// transactions with compact item breakdown, digital payment trace, and dealership footer.

export interface ThermalReceiptProps {
  sale: SaleResponse
  onClose: () => void
  onAfterPrint?: () => void
  /** Open the browser print dialog as soon as the receipt renders (Enter-driven checkout). */
  autoPrint?: boolean
}

const tk = (n: number | undefined | null) => `৳${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ThermalReceipt({
  sale,
  onClose,
  onAfterPrint,
  autoPrint = false,
}: ThermalReceiptProps) {
  const printAndClose = useCallback(() => {
    window.print()
    window.setTimeout(() => {
      if (onAfterPrint) {
        onAfterPrint()
      } else {
        onClose()
      }
    }, 0)
  }, [onAfterPrint, onClose])

  // Let the receipt paint before handing over to the (blocking) print dialog.
  useEffect(() => {
    if (!autoPrint) return
    const timer = window.setTimeout(printAndClose, 150)
    return () => window.clearTimeout(timer)
  }, [autoPrint, printAndClose])

  const formattedDate = sale.saleDate
    ? new Date(sale.saleDate).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("en-US")

  const isWholesale = sale.saleMode === "WHOLESALE"
  const totalPaid = (sale.cashPaid || 0) + (sale.digitalPaid || 0)
  const changeAmount = totalPaid > sale.totalAmount ? totalPaid - sale.totalAmount : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden flex flex-col my-auto">
        {/* Screen Header Actions (no-print) */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold text-slate-900">
              Thermal Receipt Preview (80mm)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 cursor-pointer p-1 rounded hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Thermal Receipt Container */}
        <div className="p-5 bg-white overflow-y-auto max-h-[75vh]">
          <div
            className="thermal-receipt-print print-area text-black mx-auto"
            style={{
              width: "100%",
              maxWidth: "80mm",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              lineHeight: "1.35",
            }}
          >
            {/* Store Letterhead */}
            <div className="text-center pb-3 mb-2 border-b border-dashed border-gray-400">
              <h1 className="text-base font-bold leading-tight text-black">
                Al-Amin Traders
              </h1>
              <p className="text-[11px] font-semibold text-gray-800 mt-0.5">
                Authorized Agro Dealer
              </p>
              <p className="text-[10px] text-gray-700">
                Krishi Market, Uttar Bazar, Narsingdi
              </p>
              <p className="text-[10px] text-gray-700">
                Phone: 01711-234567, 01911-123456
              </p>
              <div className="mt-1.5 inline-block border border-black rounded px-2 py-0.5 text-[10px] font-bold">
                {isWholesale ? "Wholesale Sales Receipt" : "Retail Cash Memo"}
              </div>
            </div>

            {/* Invoice Metadata */}
            <div className="text-[11px] space-y-0.5 pb-2 mb-2 border-b border-dashed border-gray-400">
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Memo No:</span>
                <span className="font-bold">{sale.invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Date:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Served by:</span>
                <span>{sale.cashierName || "Al-Amin"}</span>
              </div>
              {sale.customerName && (
                <div className="pt-1 mt-1 border-t border-dotted border-gray-300">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Customer:</span>
                    <span className="font-bold">{sale.customerName}</span>
                  </div>
                  {sale.customerPhone && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-600">Mobile:</span>
                      <span>{sale.customerPhone}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Items Table */}
            <table className="w-full text-[11px] mb-2">
              <thead>
                <tr className="border-b border-black text-black">
                  <th className="text-left py-1 font-bold">Item</th>
                  <th className="text-center py-1 font-bold">Qty</th>
                  <th className="text-right py-1 font-bold">Rate</th>
                  <th className="text-right py-1 font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-gray-300">
                {sale.items?.map((item) => (
                  <tr key={item.id || `${item.lotId}-${item.productNameBn}`}>
                    <td className="py-1.5 pr-1">
                      <div className="font-bold text-[11px] leading-tight">
                        {item.productNameEn || item.productNameBn}
                      </div>
                      <div className="text-[9px] text-gray-600 font-mono">
                        #{item.lotNumber}
                      </div>
                    </td>
                    <td className="py-1.5 text-center font-bold tabular-nums">
                      {item.totalQuantity}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-gray-700">
                      {tk(item.unitPrice)}
                    </td>
                    <td className="py-1.5 text-right font-bold tabular-nums">
                      {tk(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Financial Totals */}
            <div className="border-t border-black pt-2 space-y-1 text-[11px]">
              <div className="flex justify-between text-gray-800">
                <span>Subtotal:</span>
                <span className="tabular-nums font-semibold">{tk(sale.subtotal)}</span>
              </div>

              {sale.discount > 0 && (
                <div className="flex justify-between text-gray-800">
                  <span>Discount:</span>
                  <span className="tabular-nums font-semibold">-{tk(sale.discount)}</span>
                </div>
              )}

              {sale.roundOff > 0 && (
                <div className="flex justify-between text-gray-800">
                  <span>Round-off:</span>
                  <span className="tabular-nums font-semibold">-{tk(sale.roundOff)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold border-t border-dashed border-gray-400 pt-1 text-black">
                <span>Total Payable:</span>
                <span className="tabular-nums">{tk(sale.totalAmount)}</span>
              </div>

              {/* Payment Details */}
              <div className="border-t border-dotted border-gray-300 pt-1 space-y-0.5">
                <div className="flex justify-between text-gray-800">
                  <span>Cash:</span>
                  <span className="tabular-nums font-semibold">{tk(sale.cashPaid)}</span>
                </div>

                {sale.digitalPaid > 0 && (
                  <div className="flex justify-between text-gray-800">
                    <span>
                      Digital ({sale.digitalMedium || "MFS"}):
                    </span>
                    <span className="tabular-nums font-semibold">{tk(sale.digitalPaid)}</span>
                  </div>
                )}

                {sale.digitalTrxId && (
                  <div className="text-[9px] text-gray-600 text-right">
                    TrxID: {sale.digitalTrxId}
                  </div>
                )}

                {changeAmount > 0 && (
                  <div className="flex justify-between text-gray-800 font-semibold">
                    <span>Change Returned:</span>
                    <span className="tabular-nums">{tk(changeAmount)}</span>
                  </div>
                )}

                {sale.dueAmount > 0 && (
                  <div className="flex justify-between text-red-700 font-bold text-xs pt-1 border-t border-gray-400">
                    <span>Due / Balance:</span>
                    <span className="tabular-nums">{tk(sale.dueAmount)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-dashed border-gray-400 mt-4 pt-3 text-center space-y-1">
              <p className="text-[11px] font-bold text-black">
                Thank you, please visit again!
              </p>
              <p className="text-[10px] text-gray-700">
                Quality pesticides & fertilizers.
              </p>
              <p className="text-[9px] text-gray-500 font-mono mt-1">
                {sale.invoiceNo} · Powered by Al-Amin POS
              </p>
            </div>
          </div>
        </div>

        {/* Modal Buttons (no-print) */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex gap-2.5 no-print">
          <button
            type="button"
            onClick={printAndClose}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print Cash Memo</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-sm transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
