import type { SaleResponse, Customer } from "../types"

// BUSINESS DECISION: A4 Invoice & Challan prints wholesale agricultural dispatches with
// full customer profile, carton conversions, previous balance integration, and dual legal signatures.

export interface A4InvoicePrintProps {
  sale: SaleResponse
  customer?: Customer | null
  onClose: () => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function A4InvoicePrint({
  sale,
  customer,
  onClose,
}: A4InvoicePrintProps) {
  const formattedDate = sale.saleDate
    ? new Date(sale.saleDate).toLocaleDateString("bn-BD", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("bn-BD")

  const formattedTime = sale.saleDate
    ? new Date(sale.saleDate).toLocaleTimeString("bn-BD", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleTimeString("bn-BD")

  // Cumulative ledger calculations
  // If customer is known, previous due is their currentDue minus this sale's due (if backend already added it)
  // or customer.currentDue if viewing transaction
  const currentInvoiceDue = sale.dueAmount || 0
  const customerTotalDue = customer?.currentDue ?? currentInvoiceDue
  // Previous due before this invoice was issued
  const estimatedPrevDue = Math.max(0, customerTotalDue - currentInvoiceDue)
  const cumulativeDue = estimatedPrevDue + currentInvoiceDue

  const totalPaid = (sale.cashPaid || 0) + (sale.digitalPaid || 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-frost-border max-w-4xl w-full overflow-hidden flex flex-col my-auto">
        {/* Screen Top Bar (no-print) */}
        <div className="p-3 bg-frost-surface border-b border-frost-border flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <span className="text-base">📄</span>
            <span className="text-xs font-bold text-frost-dark bn-text">
              পাইকারি চালান ও ইনভয়েস প্রিভিউ (A4 ফরম্যাট)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="py-1.5 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs bn-text transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>🖨️</span>
              <span>প্রিন্ট করুন (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-frost-muted hover:text-frost-dark text-base cursor-pointer p-1 rounded hover:bg-frost-hover transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable A4 Document */}
        <div className="p-6 sm:p-10 bg-white overflow-y-auto max-h-[82vh]">
          <div
            className="a4-invoice-print mx-auto text-black bg-white"
            style={{
              width: "100%",
              maxWidth: "210mm",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              color: "#111827",
            }}
          >
            {/* Syngenta Dealership Letterhead */}
            <div className="border-b-2 border-emerald-800 pb-4 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-emerald-800 tracking-tight bn-text">
                      মেসার্স আল-আমিন ট্রেডার্স
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 bn-text">
                      সিনজেনটা অনুমোদিত ডিলার
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-700 bn-text mt-0.5">
                    সিনজেনটা বাংলাদেশ লিমিটেড-এর অনুমোদিত পরিবেশক
                  </p>
                  <p className="text-[11px] text-gray-600 bn-text">
                    কৃষি মার্কেট, উত্তর বাজার, নরসিংদী সদর, নরসিংদী।
                  </p>
                  <p className="text-[11px] text-gray-600">
                    মোবাইল: ০১৭১১-২৩৪৫৬৭, ০১৯১১-১২৩৪৫৬ | ইমেইল: alamin.traders.narsingdi@gmail.com
                  </p>
                </div>

                <div className="text-right">
                  <div className="inline-block bg-emerald-800 text-white font-bold px-3 py-1 text-sm rounded shadow-xs bn-text">
                    পাইকারি চালান ও ইনভয়েস
                  </div>
                  <p className="text-[11px] font-mono mt-1.5 font-bold">
                    ইনভয়েস নং: <span className="text-emerald-900">{sale.invoiceNo}</span>
                  </p>
                  <p className="text-[11px] text-gray-600 bn-text">
                    তারিখ: {formattedDate} ({formattedTime})
                  </p>
                  <p className="text-[11px] text-gray-600 bn-text">
                    ক্যাশিয়ার: {sale.cashierName || "আল-আমিন"}
                  </p>
                </div>
              </div>
            </div>

            {/* Customer & Delivery Profile Section */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-5 text-[11px]">
              <div>
                <span className="text-xs font-bold text-emerald-900 bn-text block border-b border-gray-200 pb-1 mb-1.5">
                  ক্রেতার বিবরণী (Billed To):
                </span>
                <div className="space-y-0.5">
                  <div className="flex">
                    <span className="w-24 text-gray-600 bn-text">প্রতিষ্ঠানের নাম:</span>
                    <span className="font-bold text-gray-900 bn-text">
                      {customer?.businessName || "সাধারণ পাইকারি ক্রেতা"}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-gray-600 bn-text">স্বত্বাধিকারী:</span>
                    <span className="font-semibold text-gray-800 bn-text">
                      {customer?.name || sale.customerName || "-"}
                    </span>
                  </div>
                  {customer?.fatherName && (
                    <div className="flex">
                      <span className="w-24 text-gray-600 bn-text">পিতার নাম:</span>
                      <span className="text-gray-700 bn-text">{customer.fatherName}</span>
                    </div>
                  )}
                  <div className="flex">
                    <span className="w-24 text-gray-600 bn-text">ঠিকানা / গ্রাম:</span>
                    <span className="text-gray-700 bn-text">
                      {customer?.villageAddress || "-"}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-emerald-900 bn-text block border-b border-gray-200 pb-1 mb-1.5">
                  যোগাযোগ ও পেমেন্ট বিবরণ:
                </span>
                <div className="space-y-0.5">
                  <div className="flex">
                    <span className="w-24 text-gray-600 bn-text">মোবাইল নং:</span>
                    <span className="font-mono font-semibold text-gray-900">
                      {customer?.phone || sale.customerPhone || "-"}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-gray-600 bn-text">হোয়াটসঅ্যাপ:</span>
                    <span className="font-mono text-gray-800">
                      {customer?.whatsappNumber || customer?.phone || "-"}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-gray-600 bn-text">সরবরাহ উৎস:</span>
                    <span className="font-semibold text-gray-800 bn-text">
                      দোকান ও কেন্দ্রীয় গুদাম (ডিউয়াল স্টক)
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-gray-600 bn-text">পেমেন্ট মেথড:</span>
                    <span className="font-semibold text-emerald-800">
                      {sale.paymentMethod || "CASH"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Items Table */}
            <div className="mb-4">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-emerald-900 text-white">
                    <th className="border border-emerald-950 py-2 px-2 text-center w-10 bn-text">
                      ক্রমিক
                    </th>
                    <th className="border border-emerald-950 py-2 px-3 text-left bn-text">
                      পণ্যের বিবরণ ও প্রস্তুতকারক
                    </th>
                    <th className="border border-emerald-950 py-2 px-2 text-center w-24 bn-text">
                      লট নং
                    </th>
                    <th className="border border-emerald-950 py-2 px-2 text-center w-20 bn-text">
                      মেয়াদ
                    </th>
                    <th className="border border-emerald-950 py-2 px-2 text-center w-20 bn-text">
                      বেস ইউনিট
                    </th>
                    <th className="border border-emerald-950 py-2 px-2 text-center w-16 bn-text">
                      কার্টন
                    </th>
                    <th className="border border-emerald-950 py-2 px-3 text-right w-24 bn-text">
                      দর (৳)
                    </th>
                    <th className="border border-emerald-950 py-2 px-3 text-right w-28 bn-text">
                      মোট মূল্য (৳)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items?.map((item, idx) => {
                    // Carton calculation if cartonMultiplier is attached or estimate
                    const totalUnits = item.totalQuantity || 0
                    const cartonsCount = (item as any).cartonMultiplier && (item as any).cartonMultiplier > 0
                      ? (totalUnits / (item as any).cartonMultiplier).toFixed(1)
                      : "-"

                    return (
                      <tr
                        key={item.id || idx}
                        className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="border border-gray-300 py-2 px-2 text-center tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="border border-gray-300 py-2 px-3">
                          <div className="font-bold text-gray-900 bn-text">
                            {item.productNameBn}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {item.productNameEn} (Syngenta)
                          </div>
                        </td>
                        <td className="border border-gray-300 py-2 px-2 text-center font-mono text-[10px]">
                          #{item.lotNumber}
                        </td>
                        <td className="border border-gray-300 py-2 px-2 text-center text-gray-600 text-[10px]">
                          {(item as any).expiryDate || "-"}
                        </td>
                        <td className="border border-gray-300 py-2 px-2 text-center font-bold tabular-nums">
                          {totalUnits}
                        </td>
                        <td className="border border-gray-300 py-2 px-2 text-center font-mono text-gray-600">
                          {cartonsCount}
                        </td>
                        <td className="border border-gray-300 py-2 px-3 text-right tabular-nums">
                          {tk(item.unitPrice)}
                        </td>
                        <td className="border border-gray-300 py-2 px-3 text-right font-bold tabular-nums text-gray-900">
                          {tk(item.subtotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Breakdown */}
            <div className="grid grid-cols-2 gap-6 items-start mb-6">
              {/* Notes & Terms */}
              <div className="border border-gray-300 rounded-lg p-3 text-[11px] bg-gray-50/50 space-y-1.5">
                <span className="font-bold text-gray-800 bn-text block">
                  চালান সংক্রান্ত শর্তাবলী:
                </span>
                <p className="text-[10px] text-gray-600 bn-text leading-relaxed">
                  ১. অক্ষত সিলযুক্ত পণ্য ক্রয়ের ১৫ দিনের মধ্যে ফেরতযোগ্য।
                </p>
                <p className="text-[10px] text-gray-600 bn-text leading-relaxed">
                  ২. বালাইনাশক ও কীটনাশক ব্যবহারের পূর্বে মোড়কের গায়ে নির্দেশিকা সতর্কতার সাথে পাঠ করুন।
                </p>
                <p className="text-[10px] text-gray-600 bn-text leading-relaxed">
                  ৩. বকেয়া চালান পরবর্তী বিল বা নির্ধারিত ঋণসীমার মধ্যে পরিশোধযোগ্য।
                </p>
                {sale.digitalTrxId && (
                  <p className="text-[10px] font-mono text-emerald-800 pt-1">
                    ডিজিটাল পেমেন্ট TrxID: {sale.digitalTrxId} ({sale.digitalMedium || "MFS"})
                  </p>
                )}
              </div>

              {/* Financial Calculation Table */}
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full text-[11px]">
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="py-1.5 px-3 text-gray-700 bn-text">বর্তমান ইনভয়েস উপ-মোট:</td>
                      <td className="py-1.5 px-3 text-right tabular-nums font-semibold">
                        {tk(sale.subtotal)}
                      </td>
                    </tr>
                    {sale.discount > 0 && (
                      <tr className="border-b border-gray-200 text-gray-600">
                        <td className="py-1.5 px-3 bn-text">বিশেষ ছাড় (Discount):</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">
                          -{tk(sale.discount)}
                        </td>
                      </tr>
                    )}
                    {sale.roundOff > 0 && (
                      <tr className="border-b border-gray-200 text-gray-600">
                        <td className="py-1.5 px-3 bn-text">রাউন্ড-অফ সমন্বয়:</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">
                          -{tk(sale.roundOff)}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-gray-200 bg-gray-50 font-bold">
                      <td className="py-1.5 px-3 text-gray-900 bn-text">বর্তমান চালান মোট:</td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-emerald-900">
                        {tk(sale.totalAmount)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-1.5 px-3 text-gray-600 bn-text">পূর্ববর্তী বকেয়া (Prev. Due):</td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-gray-800 font-semibold">
                        {tk(estimatedPrevDue)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 bg-gray-50 font-bold">
                      <td className="py-1.5 px-3 text-gray-900 bn-text">সর্বমোট প্রদেয় (Total Payable):</td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-black">
                        {tk(estimatedPrevDue + sale.totalAmount)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 text-emerald-800">
                      <td className="py-1.5 px-3 bn-text font-semibold">বর্তমান পরিশোধ (জমা):</td>
                      <td className="py-1.5 px-3 text-right tabular-nums font-bold">
                        {tk(totalPaid)}
                      </td>
                    </tr>
                    <tr className="bg-emerald-50 text-emerald-950 font-black text-xs">
                      <td className="py-2 px-3 bn-text">সর্বমোট অবশিষ্ট বকেয়া (Balance Due):</td>
                      <td className="py-2 px-3 text-right tabular-nums text-red-700">
                        {tk(cumulativeDue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dual Legal Signatures */}
            <div className="pt-12 mt-8 border-t border-gray-300">
              <div className="grid grid-cols-2 gap-10">
                <div className="text-center">
                  <div className="border-t border-black w-48 mx-auto pt-1">
                    <p className="font-bold text-xs bn-text text-black">
                      ক্রেতার স্বাক্ষর / গ্রহণকারীর সই
                    </p>
                    <p className="text-[10px] text-gray-500">
                      Customer / Received By
                    </p>
                  </div>
                </div>

                <div className="text-center">
                  <div className="border-t border-black w-48 mx-auto pt-1">
                    <p className="font-bold text-xs bn-text text-black">
                      বিক্রেতার স্বাক্ষর
                    </p>
                    <p className="text-[10px] text-gray-500">
                      Authorized Signatory (Al-Amin Traders)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer (no-print) */}
        <div className="p-3 bg-frost-surface border-t border-frost-border flex items-center justify-end gap-2.5 no-print">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl border border-frost-border bg-white hover:bg-frost-surface text-frost-dark font-semibold text-xs bn-text transition-colors cursor-pointer"
          >
            বন্ধ করুন
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="py-2 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs bn-text transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>🖨️</span>
            <span>প্রিন্ট চালান (A4)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
