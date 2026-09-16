import type { SaleResponse } from "../types"

// BUSINESS DECISION: Thermal receipt (80mm/58mm) formatted specifically for fast retail counter
// transactions with compact item breakdown, digital payment trace, and Bengali dealership footer.

export interface ThermalReceiptProps {
  sale: SaleResponse
  onClose: () => void
}

const tk = (n: number | undefined | null) => `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ThermalReceipt({ sale, onClose }: ThermalReceiptProps) {
  const formattedDate = sale.saleDate
    ? new Date(sale.saleDate).toLocaleString("bn-BD", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("bn-BD")

  const isWholesale = sale.saleMode === "WHOLESALE"
  const totalPaid = (sale.cashPaid || 0) + (sale.digitalPaid || 0)
  const changeAmount = totalPaid > sale.totalAmount ? totalPaid - sale.totalAmount : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-frost-border max-w-sm w-full overflow-hidden flex flex-col my-auto">
        {/* Screen Header Actions (no-print) */}
        <div className="p-3 bg-frost-surface border-b border-frost-border flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <span className="text-base">🖨️</span>
            <span className="text-xs font-bold text-frost-dark bn-text">
              থার্মাল রশিদ প্রিভিউ (৮০ মিমি)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-frost-muted hover:text-frost-dark text-base cursor-pointer p-1 rounded hover:bg-frost-hover transition-colors"
          >
            ✕
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
              <h1 className="text-base font-bold bn-text leading-tight text-black">
                মেসার্স আল-আমিন ট্রেডার্স
              </h1>
              <p className="text-[11px] font-semibold bn-text text-gray-800 mt-0.5">
                সিনজেনটা অনুমোদিত ডিলার
              </p>
              <p className="text-[10px] bn-text text-gray-700">
                কৃষি মার্কেট, উত্তর বাজার, নরসিংদী
              </p>
              <p className="text-[10px] text-gray-700">
                ফোন: ০১৭১১-২৩৪৫৬৭, ০১৯১১-১২৩৪৫৬
              </p>
              <div className="mt-1.5 inline-block border border-black rounded px-2 py-0.5 text-[10px] font-bold bn-text">
                {isWholesale ? "পাইকারি বিক্রয় রশিদ" : "খুচরা বিক্রয় ক্যাশ মেমো"}
              </div>
            </div>

            {/* Invoice Metadata */}
            <div className="text-[11px] space-y-0.5 pb-2 mb-2 border-b border-dashed border-gray-400">
              <div className="flex justify-between">
                <span className="bn-text font-medium text-gray-700">মেমো নং:</span>
                <span className="font-bold">{sale.invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="bn-text font-medium text-gray-700">তারিখ:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="bn-text font-medium text-gray-700">ক্যাশিয়ার:</span>
                <span className="bn-text">{sale.cashierName || "আল-আমিন"}</span>
              </div>
              {sale.customerName && (
                <div className="pt-1 mt-1 border-t border-dotted border-gray-300">
                  <div className="flex justify-between">
                    <span className="bn-text font-medium text-gray-700">ক্রেতা:</span>
                    <span className="font-bold bn-text">{sale.customerName}</span>
                  </div>
                  {sale.customerPhone && (
                    <div className="flex justify-between text-[10px]">
                      <span className="bn-text text-gray-600">মোবাইল:</span>
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
                  <th className="text-left py-1 bn-text font-bold">পণ্য</th>
                  <th className="text-center py-1 font-bold">পরিমাণ</th>
                  <th className="text-right py-1 font-bold">দর</th>
                  <th className="text-right py-1 font-bold">মোট</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-gray-300">
                {sale.items?.map((item) => (
                  <tr key={item.id || `${item.lotId}-${item.productNameBn}`}>
                    <td className="py-1.5 pr-1">
                      <div className="font-bold bn-text text-[11px] leading-tight">
                        {item.productNameBn || item.productNameEn}
                      </div>
                      <div className="text-[9px] text-gray-600 font-mono">
                        #{item.lotNumber}
                        {item.godownQuantity > 0 && (
                          <span className="ml-1 text-[9px] text-gray-800 bn-text">
                            (গো: {item.godownQuantity})
                          </span>
                        )}
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
                <span className="bn-text">উপ-মোট (Subtotal):</span>
                <span className="tabular-nums font-semibold">{tk(sale.subtotal)}</span>
              </div>

              {sale.discount > 0 && (
                <div className="flex justify-between text-gray-800">
                  <span className="bn-text">বিশেষ ছাড় (Discount):</span>
                  <span className="tabular-nums font-semibold">-{tk(sale.discount)}</span>
                </div>
              )}

              {sale.roundOff > 0 && (
                <div className="flex justify-between text-gray-800">
                  <span className="bn-text">রাউন্ড-অফ (Round-off):</span>
                  <span className="tabular-nums font-semibold">-{tk(sale.roundOff)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold border-t border-dashed border-gray-400 pt-1 text-black">
                <span className="bn-text">সর্বমোট প্রদেয়:</span>
                <span className="tabular-nums">{tk(sale.totalAmount)}</span>
              </div>

              {/* Payment Details */}
              <div className="border-t border-dotted border-gray-300 pt-1 space-y-0.5">
                <div className="flex justify-between text-gray-800">
                  <span className="bn-text">নগদ প্রদান (Cash):</span>
                  <span className="tabular-nums font-semibold">{tk(sale.cashPaid)}</span>
                </div>

                {sale.digitalPaid > 0 && (
                  <div className="flex justify-between text-gray-800">
                    <span className="bn-text">
                      ডিজিটাল ({sale.digitalMedium || "MFS"}):
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
                    <span className="bn-text">ফেরত দেওয়া হয়েছে:</span>
                    <span className="tabular-nums">{tk(changeAmount)}</span>
                  </div>
                )}

                {sale.dueAmount > 0 && (
                  <div className="flex justify-between text-red-700 font-bold text-xs pt-1 border-t border-gray-400">
                    <span className="bn-text">বকেয়া / বাকি:</span>
                    <span className="tabular-nums">{tk(sale.dueAmount)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-dashed border-gray-400 mt-4 pt-3 text-center space-y-1">
              <p className="text-[11px] font-bold bn-text text-black">
                ধন্যবাদ, আবার আসবেন!
              </p>
              <p className="text-[10px] bn-text text-gray-700">
                সিনজেনটা মানসম্মত ফসলের নিশ্চয়তা।
              </p>
              <p className="text-[9px] text-gray-500 font-mono mt-1">
                {sale.invoiceNo} · Powered by Al-Amin POS
              </p>
            </div>
          </div>
        </div>

        {/* Modal Buttons (no-print) */}
        <div className="p-3.5 bg-frost-surface border-t border-frost-border flex gap-2.5 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm bn-text transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <span>🖨️</span>
            <span>প্রিন্ট ক্যাশ মেমো (F2)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 rounded-xl border border-frost-border bg-white hover:bg-frost-surface text-frost-dark font-semibold text-sm bn-text transition-colors cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  )
}
