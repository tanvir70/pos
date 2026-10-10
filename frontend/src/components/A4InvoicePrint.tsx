import { useCallback, useEffect } from "react"
import { createPortal } from "react-dom"
import { FileText, Printer, X } from "lucide-react"
import type { SaleResponse, Customer } from "../types"
import { STORE_INFO } from "../constants/store"
import BrandLogo from "./ui/BrandLogo"
import { formatQuantity } from "../utils/unit"

// BUSINESS DECISION: A4 Invoice & Challan prints wholesale agricultural dispatches with
// full customer profile, carton conversions, previous balance integration, and dual legal signatures.

export interface A4InvoicePrintProps {
  sale: SaleResponse
  customer?: Customer | null
  onClose: () => void
  onAfterPrint?: () => void
  autoPrint?: boolean
}

// Plain numeric formatter without redundant currency symbol (headers denote ৳)
const fmt = (n: number | undefined | null) =>
  (n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export default function A4InvoicePrint({
  sale,
  customer,
  onClose,
  onAfterPrint,
  autoPrint = false,
}: A4InvoicePrintProps) {
  useEffect(() => {
    document.body.classList.add("printing-a4-active")
    return () => {
      document.body.classList.remove("printing-a4-active")
    }
  }, [])

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

  const formattedDate = sale.saleDate
    ? new Date(sale.saleDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("en-US")

  const formattedTime = sale.saleDate
    ? new Date(sale.saleDate).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleTimeString("en-US")

  // Cumulative ledger calculations
  const currentInvoiceDue = sale.dueAmount || 0
  const customerTotalDue = customer?.currentDue ?? currentInvoiceDue
  const estimatedPrevDue = Math.max(0, customerTotalDue - currentInvoiceDue)
  const cumulativeDue = estimatedPrevDue + currentInvoiceDue
  const totalPaid = (sale.cashPaid || 0) + (sale.digitalPaid || 0)

  // Items and empty row balancing to elegantly utilize full A4 page
  const items = sale.items ?? []
  const minRows = 5
  const emptyRowsCount = Math.max(0, minRows - items.length)

  return createPortal(
    <div className="a4-print-portal fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto print:static print:block print:p-0 print:m-0 print:bg-white print:overflow-visible print:h-auto a4-print-modal-root">
      {/* Scoped Print Pagination & A4 Engine Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 12mm 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            height: 100% !important;
            min-height: 100% !important;
            overflow: visible !important;
          }
          .a4-print-portal,
          .a4-print-modal-root,
          .a4-print-modal-card,
          .a4-print-scroll-container {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }
          .a4-invoice-print {
            position: static !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            width: 100% !important;
            max-width: none !important;
            min-height: 264mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .a4-signature-block {
            margin-top: auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .a4-print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          .a4-print-table thead {
            display: table-header-group !important;
          }
          .a4-print-table tr,
          .a4-item-row {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .a4-no-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col my-auto print:static print:block print:shadow-none print:border-none print:rounded-none print:max-w-none print:w-full print:m-0 print:p-0 print:overflow-visible a4-print-modal-card">
        {/* Screen Top Bar (no-print) — Clean Header with Single Dismiss Action */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-800" />
            <span className="text-xs font-bold text-slate-900">
              Wholesale Invoice & Challan Preview (A4 Format)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 cursor-pointer p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
            title="Close Preview"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable A4 Document Viewport */}
        <div className="p-6 sm:p-10 bg-slate-100/60 overflow-y-auto max-h-[82vh] print:static print:block print:p-0 print:m-0 print:max-h-none print:overflow-visible print:h-auto a4-print-scroll-container">
          <div
            className="a4-invoice-print mx-auto text-black bg-white shadow-md sm:shadow-lg rounded-sm p-6 sm:p-8 flex flex-col justify-between print:static print:flex print:flex-col print:justify-between print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none print:rounded-none print:overflow-visible"
            style={{
              width: "100%",
              maxWidth: "210mm",
              minHeight: "264mm",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              color: "#111827",
            }}
          >
            {/* Top Content Zone (Expands downward while pushing signatures to bottom) */}
            <div className="flex-1 flex flex-col">
              {/* Agrochemical Dealership Letterhead */}
              <div className="mb-4">
                <div className="flex items-start justify-between">
                  {/* Left Brand & Store Info */}
                  <div className="flex items-start gap-3.5">
                    <BrandLogo size="lg" variant="image" className="shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-2xl font-black text-emerald-900 tracking-tight leading-none">
                          {STORE_INFO.name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          {STORE_INFO.tagline}
                        </span>
                      </div>

                      {/* Left Metadata Lines */}
                      <p className="text-[11px] font-bold text-gray-900 mt-1.5">
                        Stockist : <span className="font-medium text-gray-700">{STORE_INFO.stockist}</span>
                      </p>
                      <p className="text-[11px] text-gray-700">
                        <span className="font-bold text-gray-900">Proprietor :</span> {STORE_INFO.proprietor}
                      </p>
                      <p className="text-[11px] text-gray-600 font-medium">
                        {STORE_INFO.address} • Mobile: {STORE_INFO.phone}
                      </p>
                    </div>
                  </div>

                  {/* Right Invoice & Challan Details */}
                  <div className="text-right shrink-0">
                    <div className="inline-block bg-emerald-800 text-white font-bold px-3 py-1 text-sm rounded shadow-xs">
                      Wholesale Invoice & Challan
                    </div>

                    {/* Right Metadata Lines — Exact Match to Original Reference Layout */}
                    <p className="text-[11px] font-mono mt-1.5 font-bold">
                      Invoice No: <span className="text-emerald-900">{sale.invoiceNo}</span>
                    </p>
                    <p className="text-[11px] text-gray-600">
                      Date: {formattedDate} ({formattedTime})
                    </p>
                    <p className="text-[11px] text-gray-600 font-medium">
                      Served by: {STORE_INFO.name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer & Delivery Profile Section */}
              <div className="grid grid-cols-2 gap-4 p-3.5 bg-gray-50 border border-gray-200 rounded-lg mb-5 text-[11px] a4-no-break print:break-inside-avoid print:bg-gray-50/70">
                <div>
                  <span className="text-xs font-bold text-emerald-900 block border-b border-gray-200 pb-1 mb-1.5 uppercase tracking-wide">
                    Billed To:
                  </span>
                  <div className="space-y-0.5">
                    {customer?.businessName ? (
                      <>
                        <div className="flex">
                          <span className="w-24 text-gray-600">Business Name:</span>
                          <span className="font-bold text-gray-900">
                            {customer.businessName}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 text-gray-600">Proprietor:</span>
                          <span className="font-semibold text-gray-800">
                            {customer?.name || sale.customerName || "-"}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex">
                        <span className="w-24 text-gray-600">Customer Name:</span>
                        <span className="font-bold text-gray-900">
                          {customer?.name || sale.customerName || "Walk-in Customer"}
                        </span>
                      </div>
                    )}
                    <div className="flex">
                      <span className="w-24 text-gray-600">Address / Village:</span>
                      <span className="text-gray-700">
                        {customer?.villageAddress || customer?.address || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-emerald-900 block border-b border-gray-200 pb-1 mb-1.5 uppercase tracking-wide">
                    Contact & Payment Details:
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex">
                      <span className="w-24 text-gray-600">Mobile No:</span>
                      <span className="font-mono font-semibold text-gray-900">
                        {customer?.phone || sale.customerPhone || "-"}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="w-24 text-gray-600">Payment Method:</span>
                      <span className="font-bold text-emerald-800">
                        {sale.paymentMethod || "CASH"}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="w-24 text-gray-600">Invoice Status:</span>
                      <span className="font-bold text-emerald-700">
                        {cumulativeDue > 0 ? "Due Balance Pending" : "Full Paid (No Due)"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Items Table (Numeric Rate & Amount without redundant ৳ sign) */}
              <div className="mb-5 print:mb-6 overflow-visible">
                <table className="w-full border-collapse text-[11px] a4-print-table border border-gray-300">
                  <thead>
                    <tr className="bg-emerald-900 text-white print:bg-emerald-900 print:text-white">
                      <th className="border-b border-r border-emerald-950 py-2 px-2 text-center w-10">
                        SL
                      </th>
                      <th className="border-b border-r border-emerald-950 py-2 px-3 text-left">
                        Product Description & Packaging Details
                      </th>
                      <th className="border-b border-r border-emerald-950 py-2 px-2 text-center w-28">
                        Lot No.
                      </th>
                      <th className="border-b border-r border-emerald-950 py-2 px-2 text-center w-24">
                        Qty
                      </th>
                      <th className="border-b border-r border-emerald-950 py-2 px-3 text-right w-28">
                        Rate (৳)
                      </th>
                      <th className="border-b border-emerald-950 py-2 px-3 text-right w-32">
                        Amount (৳)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const totalUnits = item.totalQuantity || 0
                      const multiplier = item.cartonMultiplier || 1
                      const hasCartons = multiplier > 1 && totalUnits >= multiplier
                      const ctns = hasCartons ? Math.floor(totalUnits / multiplier) : 0
                      const loose = hasCartons ? Math.round((totalUnits % multiplier) * 1000) / 1000 : 0

                      return (
                        <tr
                          key={item.id || idx}
                          className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"} a4-item-row`}
                        >
                          <td className="border-b border-r border-gray-300 py-2 px-2 text-center tabular-nums text-gray-700">
                            {idx + 1}
                          </td>
                          <td className="border-b border-r border-gray-300 py-2 px-3">
                            <div className="font-bold text-gray-900">
                              {item.productNameEn || item.productNameBn}
                            </div>
                            <div className="text-[10px] text-gray-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                              {item.packSize && (
                                <span className="font-semibold text-emerald-900">
                                  {item.packSize}
                                </span>
                              )}
                              {item.productNameBn && item.productNameBn !== item.productNameEn && (
                                <span>• {item.productNameBn}</span>
                              )}
                              {multiplier > 1 && (
                                <span className="text-gray-400 font-mono text-[9px]">
                                  (1 Ctn = {multiplier} {item.baseUnit || "Pcs"})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="border-b border-r border-gray-300 py-2 px-2 text-center font-mono text-[10px]">
                            #{item.lotNumber}
                          </td>
                          <td className="border-b border-r border-gray-300 py-2 px-2 text-center tabular-nums">
                            <div className="font-bold text-gray-900">
                              {formatQuantity(totalUnits, item.baseUnit)} {item.baseUnit || "Pcs"}
                            </div>
                            {hasCartons && (
                              <div className="text-[10px] font-semibold text-emerald-800">
                                {loose > 0
                                   ? `(${ctns} Ctn + ${formatQuantity(loose, item.baseUnit)} Pk)`
                                   : `(${ctns} ${ctns > 1 ? "Ctns" : "Ctn"})`}
                              </div>
                            )}
                          </td>
                          <td className="border-b border-r border-gray-300 py-2 px-3 text-right tabular-nums">
                            <div>{fmt(item.unitPrice)}</div>
                            {multiplier > 1 && (
                              <div className="text-[9px] text-gray-400 font-mono">
                                {fmt(item.unitPrice * multiplier)}/ctn
                              </div>
                            )}
                          </td>
                          <td className="border-b border-gray-300 py-2 px-3 text-right font-bold tabular-nums text-gray-900">
                            {fmt(item.subtotal)}
                          </td>
                        </tr>
                      )
                    })}

                    {/* Clean structured blank rows to utilize page proportion when few items exist */}
                    {Array.from({ length: emptyRowsCount }).map((_, emptyIdx) => (
                      <tr
                        key={`empty-${emptyIdx}`}
                        className="h-8 bg-white"
                        aria-hidden="true"
                      >
                        <td className="border-b border-r border-gray-300 py-1.5 px-2 text-center text-gray-300 tabular-nums">
                          {items.length + emptyIdx + 1}
                        </td>
                        <td className="border-b border-r border-gray-300 py-1.5 px-3" />
                        <td className="border-b border-r border-gray-300 py-1.5 px-2" />
                        <td className="border-b border-r border-gray-300 py-1.5 px-2" />
                        <td className="border-b border-r border-gray-300 py-1.5 px-3" />
                        <td className="border-b border-gray-300 py-1.5 px-3" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary & Breakdown Section (Clean numbers without ৳ sign) */}
              <div className="grid grid-cols-2 gap-6 items-start mb-6 a4-no-break print:break-inside-avoid">
                {/* Left Column: Delivery challan declaration and notes */}
                <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50/70 text-[11px] flex flex-col justify-between min-h-[140px]">
                  <div>
                    <span className="font-bold text-emerald-950 block text-[11px] mb-1">
                      Official Agrochemical Delivery Challan
                    </span>
                    <p className="text-[10.5px] text-gray-600 leading-relaxed">
                      • Computer-generated sales invoice issued by {STORE_INFO.name}.
                    </p>
                    <p className="text-[10.5px] text-gray-600 leading-relaxed">
                      • Authorized stockist of {STORE_INFO.stockist}.
                    </p>
                    <p className="text-[10.5px] text-gray-600 leading-relaxed">
                      • Please inspect packaging upon physical receipt. Claims must be submitted within 24 hours.
                    </p>
                  </div>
                  {sale.digitalTrxId ? (
                    <div className="mt-2 pt-2 border-t border-gray-200 font-mono text-[10.5px] text-emerald-800">
                      Digital Payment Ref: TrxID {sale.digitalTrxId} ({sale.digitalMedium || "MFS"})
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-200">
                      Thank you for your business.
                    </div>
                  )}
                </div>

                {/* Right Column: Financial Calculation Table (Plain values, headers define ৳) */}
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <table className="w-full text-[11px]">
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="py-1.5 px-3 text-gray-700">Current Invoice Subtotal:</td>
                        <td className="py-1.5 px-3 text-right tabular-nums font-semibold">
                          {fmt(sale.subtotal)}
                        </td>
                      </tr>
                      {sale.discount > 0 && (
                        <tr className="border-b border-gray-200 text-gray-600">
                          <td className="py-1.5 px-3">Discount:</td>
                          <td className="py-1.5 px-3 text-right tabular-nums">
                            -{fmt(sale.discount)}
                          </td>
                        </tr>
                      )}
                      {sale.roundOff > 0 && (
                        <tr className="border-b border-gray-200 text-gray-600">
                          <td className="py-1.5 px-3">Round-off Adjustment:</td>
                          <td className="py-1.5 px-3 text-right tabular-nums">
                            -{fmt(sale.roundOff)}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-gray-200 bg-gray-50 font-bold">
                        <td className="py-1.5 px-3 text-gray-900">Current Invoice Total:</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-emerald-900">
                          {fmt(sale.totalAmount)}
                        </td>
                      </tr>
                      {estimatedPrevDue > 0 && (
                        <tr className="border-b border-gray-200">
                          <td className="py-1.5 px-3 text-gray-600">Previous Due:</td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-gray-800 font-semibold">
                            {fmt(estimatedPrevDue)}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-gray-200 bg-gray-50 font-bold">
                        <td className="py-1.5 px-3 text-gray-900">Total Payable:</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-black">
                          {fmt(estimatedPrevDue + sale.totalAmount)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 text-emerald-800">
                        <td className="py-1.5 px-3 font-semibold">Amount Paid Now:</td>
                        <td className="py-1.5 px-3 text-right tabular-nums font-bold">
                          {fmt(totalPaid)}
                        </td>
                      </tr>
                      {cumulativeDue > 0 ? (
                        <tr className="bg-emerald-50 text-emerald-950 font-black text-xs">
                          <td className="py-2 px-3">Total Balance Due:</td>
                          <td className="py-2 px-3 text-right tabular-nums text-red-700">
                            {fmt(cumulativeDue)}
                          </td>
                        </tr>
                      ) : (
                        <tr className="bg-emerald-50 text-emerald-950 font-bold text-xs">
                          <td className="py-2 px-3">Invoice Status:</td>
                          <td className="py-2 px-3 text-right tabular-nums text-emerald-700">
                            Full Paid (No Due)
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom Anchored Signature Section (Pushed to bottom via mt-auto) */}
            <div className="a4-signature-block mt-auto pt-6 border-t border-gray-200 a4-no-break print:break-inside-avoid">
              <div className="grid grid-cols-2 gap-10">
                <div className="text-center">
                  <div className="border-t-2 border-black w-48 mx-auto pt-1.5">
                    <p className="font-bold text-xs text-black tracking-tight">
                      Customer / Received By
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium">
                      Customer Signature & Seal
                    </p>
                  </div>
                </div>

                <div className="text-center">
                  <div className="border-t-2 border-black w-48 mx-auto pt-1.5">
                    <p className="font-bold text-xs text-black tracking-tight">
                      Authorized Signatory
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium">
                      {STORE_INFO.name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Discreet Bottom Audit Line */}
              <div className="text-center text-[9.5px] text-gray-400 mt-4 pt-2 border-t border-dashed border-gray-200">
                Commercial Agrochemical Invoice & Delivery Challan • Sreebardi Bazar, Sherpur • {STORE_INFO.poweredBy}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Bar (no-print) — Primary Print & Dismiss Actions */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 no-print">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={printAndClose}
            className="py-2 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Invoice (A4)</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
