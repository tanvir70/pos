import { useCallback, useEffect } from "react"
import { createPortal } from "react-dom"
import { FileText, Printer, X } from "lucide-react"
import type { SaleResponse, Customer } from "../types"
import { STORE_INFO } from "../constants/store"
import BrandLogo from "./ui/BrandLogo"

// BUSINESS DECISION: A4 Invoice & Challan prints wholesale agricultural dispatches with
// full customer profile, carton conversions, previous balance integration, and dual legal signatures.

export interface A4InvoicePrintProps {
  sale: SaleResponse
  customer?: Customer | null
  onClose: () => void
  onAfterPrint?: () => void
  autoPrint?: boolean
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
  // If customer is known, previous due is their currentDue minus this sale's due (if backend already added it)
  // or customer.currentDue if viewing transaction
  const currentInvoiceDue = sale.dueAmount || 0
  const customerTotalDue = customer?.currentDue ?? currentInvoiceDue
  // Previous due before this invoice was issued
  const estimatedPrevDue = Math.max(0, customerTotalDue - currentInvoiceDue)
  const cumulativeDue = estimatedPrevDue + currentInvoiceDue

  const totalPaid = (sale.cashPaid || 0) + (sale.digitalPaid || 0)

  return createPortal(
    <div className="a4-print-portal fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto print:static print:block print:p-0 print:m-0 print:bg-white print:overflow-visible print:h-auto a4-print-modal-root">
      {/* Scoped Print Pagination & A4 Engine Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 15mm 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
          }
          .a4-print-portal,
          .a4-print-modal-root,
          .a4-print-modal-card,
          .a4-print-scroll-container,
          .a4-invoice-print {
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
        {/* Screen Top Bar (no-print) */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold text-slate-900">
              Wholesale Invoice & Challan Preview (A4 Format)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={printAndClose}
              className="py-1.5 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900 cursor-pointer p-1 rounded hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable A4 Document */}
        <div className="p-6 sm:p-10 bg-white overflow-y-auto max-h-[82vh] print:static print:block print:p-0 print:m-0 print:max-h-none print:overflow-visible print:h-auto a4-print-scroll-container">
          <div
            className="a4-invoice-print mx-auto text-black bg-white print:static print:block print:p-0 print:m-0 print:w-full print:max-w-none print:overflow-visible"
            style={{
              width: "100%",
              maxWidth: "210mm",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              color: "#111827",
            }}
          >
            {/* Agrochemical Dealership Letterhead */}
            <div className="border-b-2 border-emerald-800 pb-4 mb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3.5">
                  <BrandLogo size="lg" variant="image" className="shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-emerald-800 tracking-tight">
                        {STORE_INFO.name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                        {STORE_INFO.tagline}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-gray-700 mt-0.5">
                      {STORE_INFO.dealershipDescription}
                    </p>
                    <p className="text-[11px] text-gray-600">
                      {STORE_INFO.address}.
                    </p>
                    <p className="text-[11px] text-gray-600">
                      Mobile: {STORE_INFO.phone}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-block bg-emerald-800 text-white font-bold px-3 py-1 text-sm rounded shadow-xs">
                    Wholesale Invoice & Challan
                  </div>
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
            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-5 text-[11px] a4-no-break print:break-inside-avoid print:bg-gray-50/70">
              <div>
                <span className="text-xs font-bold text-emerald-900 block border-b border-gray-200 pb-1 mb-1.5">
                  Billed To:
                </span>
                <div className="space-y-0.5">
                  <div className="flex">
                    <span className="w-24 text-gray-600">Business Name:</span>
                    <span className="font-bold text-gray-900">
                      {customer?.businessName || "Walk-in Wholesale Customer"}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-gray-600">Proprietor:</span>
                    <span className="font-semibold text-gray-800">
                      {customer?.name || sale.customerName || "-"}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-gray-600">Address / Village:</span>
                    <span className="text-gray-700">
                      {customer?.villageAddress || "-"}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-emerald-900 block border-b border-gray-200 pb-1 mb-1.5">
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
                    <span className="font-semibold text-emerald-800">
                      {sale.paymentMethod || "CASH"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Items Table */}
            <div className="mb-4 print:mb-6 overflow-visible">
              <table className="w-full border-collapse text-[11px] a4-print-table">
                <thead>
                  <tr className="bg-emerald-900 text-white print:bg-emerald-900 print:text-white">
                    <th className="border border-emerald-950 py-2 px-2 text-center w-10">
                      SL
                    </th>
                    <th className="border border-emerald-950 py-2 px-3 text-left">
                      Product Description & Manufacturer
                    </th>
                    <th className="border border-emerald-950 py-2 px-2 text-center w-28">
                      Lot No.
                    </th>
                    <th className="border border-emerald-950 py-2 px-2 text-center w-24">
                      Qty
                    </th>
                    <th className="border border-emerald-950 py-2 px-3 text-right w-28">
                      Rate (৳)
                    </th>
                    <th className="border border-emerald-950 py-2 px-3 text-right w-32">
                      Amount (৳)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(sale.items ?? []).map((item, idx) => {
                    const totalUnits = item.totalQuantity || 0
                    const multiplier = item.cartonMultiplier || 1
                    const hasCartons = multiplier > 1 && totalUnits >= multiplier
                    const ctns = hasCartons ? Math.floor(totalUnits / multiplier) : 0
                    const loose = hasCartons ? Math.round((totalUnits % multiplier) * 1000) / 1000 : 0

                    return (
                      <tr
                        key={item.id || idx}
                        className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} a4-item-row`}
                      >
                        <td className="border border-gray-300 py-1.5 px-2 text-center tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="border border-gray-300 py-1.5 px-3">
                          <div className="font-bold text-gray-900">
                            {item.productNameEn || item.productNameBn}
                          </div>
                          <div className="text-[10px] text-gray-500 flex flex-wrap items-center gap-1.5">
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
                        <td className="border border-gray-300 py-1.5 px-2 text-center font-mono text-[10px]">
                          #{item.lotNumber}
                        </td>
                        <td className="border border-gray-300 py-1.5 px-2 text-center tabular-nums">
                          <div className="font-bold text-gray-900">
                            {totalUnits} {item.baseUnit || "Pcs"}
                          </div>
                          {hasCartons && (
                            <div className="text-[10px] font-semibold text-emerald-800">
                              {loose > 0
                                ? `(${ctns} Ctn + ${loose} Pk)`
                                : `(${ctns} ${ctns > 1 ? "Ctns" : "Ctn"})`}
                            </div>
                          )}
                        </td>
                        <td className="border border-gray-300 py-1.5 px-3 text-right tabular-nums">
                          <div>{tk(item.unitPrice)}</div>
                          {multiplier > 1 && (
                            <div className="text-[9px] text-gray-400 font-mono">
                              {tk(item.unitPrice * multiplier)}/ctn
                            </div>
                          )}
                        </td>
                        <td className="border border-gray-300 py-1.5 px-3 text-right font-bold tabular-nums text-gray-900">
                          {tk(item.subtotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Breakdown */}
            <div className="grid grid-cols-2 gap-6 items-start mb-6 a4-no-break print:break-inside-avoid">
              {/* Left Column: Transaction reference */}
              <div className="text-[11px] space-y-2">
                {sale.digitalTrxId ? (
                  <div className="border border-gray-200 rounded-lg p-2.5 bg-gray-50/70">
                    <span className="font-bold text-gray-700 block text-[10px] uppercase tracking-wide">
                      Digital Payment Reference
                    </span>
                    <p className="font-mono text-xs text-emerald-800 font-semibold mt-0.5">
                      TrxID: {sale.digitalTrxId} ({sale.digitalMedium || "MFS"})
                    </p>
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-200 rounded-lg p-2.5 text-gray-500 text-[10px]">
                    Official computer-generated invoice from {STORE_INFO.name}.
                  </div>
                )}
              </div>

              {/* Financial Calculation Table */}
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full text-[11px]">
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="py-1.5 px-3 text-gray-700">Current Invoice Subtotal:</td>
                      <td className="py-1.5 px-3 text-right tabular-nums font-semibold">
                        {tk(sale.subtotal)}
                      </td>
                    </tr>
                    {sale.discount > 0 && (
                      <tr className="border-b border-gray-200 text-gray-600">
                        <td className="py-1.5 px-3">Discount:</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">
                          -{tk(sale.discount)}
                        </td>
                      </tr>
                    )}
                    {sale.roundOff > 0 && (
                      <tr className="border-b border-gray-200 text-gray-600">
                        <td className="py-1.5 px-3">Round-off Adjustment:</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">
                          -{tk(sale.roundOff)}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-gray-200 bg-gray-50 font-bold">
                      <td className="py-1.5 px-3 text-gray-900">Current Invoice Total:</td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-emerald-900">
                        {tk(sale.totalAmount)}
                      </td>
                    </tr>
                    {estimatedPrevDue > 0 && (
                      <tr className="border-b border-gray-200">
                        <td className="py-1.5 px-3 text-gray-600">Previous Due:</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-800 font-semibold">
                          {tk(estimatedPrevDue)}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-gray-200 bg-gray-50 font-bold">
                      <td className="py-1.5 px-3 text-gray-900">Total Payable:</td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-black">
                        {tk(estimatedPrevDue + sale.totalAmount)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 text-emerald-800">
                      <td className="py-1.5 px-3 font-semibold">Amount Paid Now:</td>
                      <td className="py-1.5 px-3 text-right tabular-nums font-bold">
                        {tk(totalPaid)}
                      </td>
                    </tr>
                    {cumulativeDue > 0 ? (
                      <tr className="bg-emerald-50 text-emerald-950 font-black text-xs">
                        <td className="py-2 px-3">Total Balance Due:</td>
                        <td className="py-2 px-3 text-right tabular-nums text-red-700">
                          {tk(cumulativeDue)}
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

            {/* Dual Legal Signatures */}
            <div className="pt-10 mt-6 border-t border-gray-300 a4-no-break print:break-inside-avoid">
              <div className="grid grid-cols-2 gap-10">
                <div className="text-center">
                  <div className="border-t border-black w-48 mx-auto pt-1">
                    <p className="font-bold text-xs text-black">
                      Customer / Received By
                    </p>
                    <p className="text-[10px] text-gray-500">
                      Customer Signature
                    </p>
                  </div>
                </div>

                <div className="text-center">
                  <div className="border-t border-black w-48 mx-auto pt-1">
                    <p className="font-bold text-xs text-black">
                      Authorized Signatory
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {STORE_INFO.name}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer (no-print) */}
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

