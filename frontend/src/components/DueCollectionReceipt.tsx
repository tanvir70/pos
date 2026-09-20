import { useCallback, useEffect } from "react"
import { Printer, X } from "lucide-react"

export interface DueReceiptData {
  receiptNo: string
  customer: {
    id: number
    name: string
    phone: string
    fatherName?: string | null
    businessName?: string | null
    villageAddress?: string | null
    address?: string | null
    customerType?: string
  }
  amountPaid: number
  previousDue: number
  remainingDue: number
  paymentMethod: string
  notes?: string
  date?: string
  cashierName?: string
}

export interface DueCollectionReceiptProps {
  data: DueReceiptData
  onClose: () => void
  onAfterPrint?: () => void
  autoPrint?: boolean
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function DueCollectionReceipt({
  data,
  onClose,
  onAfterPrint,
  autoPrint = false,
}: DueCollectionReceiptProps) {
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

  useEffect(() => {
    if (!autoPrint) return
    const timer = window.setTimeout(printAndClose, 150)
    return () => window.clearTimeout(timer)
  }, [autoPrint, printAndClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || (e.ctrlKey && e.key.toLowerCase() === "p")) {
        e.preventDefault()
        printAndClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [printAndClose])

  const formattedDate = data.date
    ? new Date(data.date).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })

  const receiptDisplayNo = data.receiptNo.startsWith("#")
    ? data.receiptNo
    : `#${data.receiptNo}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden flex flex-col my-auto">
        {/* Screen Header Actions (no-print) */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold text-slate-900">
              Due Receipt Preview (80mm)
            </span>
          </div>
          <button
            type="button"
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
                Rajib Enterprise
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
                DUE COLLECTION INVOICE
              </div>
            </div>

            {/* Receipt Metadata */}
            <div className="text-[11px] space-y-0.5 pb-2 mb-2 border-b border-dashed border-gray-400">
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Receipt No:</span>
                <span className="font-bold">{receiptDisplayNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Date & Time:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Collected by:</span>
                <span>{data.cashierName || "Rajib"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Payment Via:</span>
                <span className="font-bold uppercase">{data.paymentMethod || "CASH"}</span>
              </div>

              {/* Customer Info */}
              <div className="pt-1.5 mt-1 border-t border-dotted border-gray-300">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Customer:</span>
                  <span className="font-bold">{data.customer.name}</span>
                </div>
                {data.customer.businessName && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600">Business:</span>
                    <span>{data.customer.businessName}</span>
                  </div>
                )}
                {data.customer.phone && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600">Mobile:</span>
                    <span>{data.customer.phone}</span>
                  </div>
                )}
                {(data.customer.villageAddress || data.customer.address) && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600">Address:</span>
                    <span className="truncate max-w-[150px]">
                      {data.customer.villageAddress || data.customer.address}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Ledger Due Settlement Table */}
            <div className="py-2 mb-2 border-b border-dashed border-gray-400 text-xs">
              <div className="bg-gray-100 p-2 rounded border border-gray-300 space-y-1">
                <div className="flex justify-between text-gray-700">
                  <span>Previous Due Balance:</span>
                  <span className="font-bold">{tk(data.previousDue)}</span>
                </div>
                <div className="flex justify-between text-black font-bold pt-1 border-t border-dashed border-gray-300">
                  <span className="text-sm">Amount Collected:</span>
                  <span className="text-sm">{tk(data.amountPaid)}</span>
                </div>
                <div className="flex justify-between text-black font-bold pt-1 border-t border-gray-400">
                  <span>Remaining Due:</span>
                  <span className="font-bold text-sm">{tk(data.remainingDue)}</span>
                </div>
              </div>

              {data.notes && (
                <div className="mt-2 text-[10px] text-gray-700">
                  <span className="font-bold">Remarks:</span> {data.notes}
                </div>
              )}
            </div>

            {/* Dual Signature Section (Tasteful 80mm Layout) */}
            <div className="pt-8 pb-2 grid grid-cols-2 gap-4 text-center text-[10px] leading-tight">
              <div>
                <div className="border-t border-dashed border-gray-600 pt-1 font-semibold text-black">
                  Customer Signature
                </div>
                <div className="text-[9px] text-gray-500 mt-0.5 font-normal">
                  Acknowledged Due
                </div>
              </div>
              <div>
                <div className="border-t border-dashed border-gray-600 pt-1 font-semibold text-black">
                  Seller Signature
                </div>
                <div className="text-[9px] text-gray-500 mt-0.5 font-normal">
                  Rajib Enterprise
                </div>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center pt-2 border-t border-dashed border-gray-400 text-[10px] text-gray-600 space-y-0.5">
              <p className="font-medium text-gray-800">
                Thank you for clearing your ledger dues!
              </p>
              <p className="text-[9px] text-gray-500 font-mono">
                {receiptDisplayNo} · Powered by Rajib Enterprise POS
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
            <span>Print Due Memo</span>
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
