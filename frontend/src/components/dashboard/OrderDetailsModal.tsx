import {
  FileText,
  Printer,
  User,
  Calendar,
  CreditCard,
  Percent,
  CheckCircle2,
  AlertCircle,
  Hash,
} from "lucide-react"
import type { SaleResponse } from "../../types"
import { formatTk } from "../../utils/currency"
import Modal from "../ui/Modal"
import Button from "../ui/Button"
import Badge from "../ui/Badge"
import { Separator } from "../ui/separator"

export interface OrderDetailsModalProps {
  isOpen: boolean
  sale: SaleResponse | null
  onClose: () => void
  onPrintReceipt?: (sale: SaleResponse) => void
}

export default function OrderDetailsModal({
  isOpen,
  sale,
  onClose,
  onPrintReceipt,
}: OrderDetailsModalProps) {
  if (!sale) return null

  const isWholesale = sale.saleMode === "WHOLESALE"
  const isDue = (sale.dueAmount ?? 0) > 0
  const isPartial = isDue && ((sale.cashPaid ?? 0) > 0 || (sale.digitalPaid ?? 0) > 0)
  const totalPaid = (sale.cashPaid || 0) + (sale.digitalPaid || 0)
  const changeAmount = totalPaid > sale.totalAmount ? totalPaid - sale.totalAmount : 0

  const discountAmount = sale.discount || 0
  const subtotal = sale.subtotal || sale.totalAmount
  const discountPercent =
    subtotal > 0 && discountAmount > 0
      ? ((discountAmount / subtotal) * 100).toFixed(1)
      : null

  const formattedDate = sale.saleDate
    ? new Date(sale.saleDate).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-"

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Order #{sale.invoiceNo}</span>
          <Badge
            variant={isWholesale ? "purple" : "emerald"}
            className="text-xs"
          >
            {isWholesale ? "Wholesale Dispatch" : "Retail Sale"}
          </Badge>
        </div>
      }
      subtitle={`Recorded on ${formattedDate} · Served by ${sale.cashierName || "Rajib"}`}
      icon={<FileText className="w-5 h-5 text-emerald-400" />}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" size="md" onClick={onClose}>
            Close
          </Button>
          {onPrintReceipt && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Printer className="w-4 h-4" />}
              onClick={() => {
                onClose()
                onPrintReceipt(sale)
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
            >
              Print Receipt
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Customer & Basic Meta Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Customer Profile
              </span>
              <span className="font-bold text-slate-900 text-sm block">
                {sale.customerName || "Walk-in Retail Customer"}
              </span>
              {sale.customerPhone && (
                <span className="font-mono text-slate-500">{sale.customerPhone}</span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Order Timestamp & Cashier
              </span>
              <span className="font-semibold text-slate-900 block">{formattedDate}</span>
              <span className="text-slate-500">Cashier: {sale.cashierName || "Rajib"}</span>
            </div>
          </div>
        </div>

        {/* Ordered Items Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="px-3.5 py-2 bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>Ordered Items ({sale.items?.length || 0})</span>
            <span className="font-mono text-[11px] text-slate-500">
              Total Qty:{" "}
              {(sale.items ?? []).reduce((acc, it) => acc + (Number(it.totalQuantity) || 0), 0)}
            </span>
          </div>

          <div className="overflow-x-auto max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 text-[11px] font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Product Description</th>
                  <th className="py-2 px-3 text-center">Lot No.</th>
                  <th className="py-2 px-3 text-right">Qty</th>
                  <th className="py-2 px-3 text-right">Rate</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(sale.items ?? []).map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-900">
                        {item.productNameBn || item.productNameEn}
                      </div>
                      {item.productNameBn && item.productNameEn && (
                        <div className="text-[10px] text-slate-500">
                          {item.productNameEn}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-slate-600 text-[11px]">
                      #{item.lotNumber}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {item.totalQuantity} {item.baseUnit || ""}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600 tabular-nums">
                      {formatTk(item.unitPrice)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {formatTk(item.subtotal || item.unitPrice * item.totalQuantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial & Settlement Breakdown Card */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
              Settlement & Payment Details
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isDue
                  ? isPartial
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}
            >
              {isDue ? (
                <AlertCircle className="w-3 h-3" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              )}
              <span>
                {isDue ? (isPartial ? "Partial Due" : "Full Due") : "Settled (Paid)"}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Left: Financial Ledger Math */}
            <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200/80">
              <div className="flex justify-between text-slate-600">
                <span>Gross Subtotal:</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatTk(subtotal)}
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3 h-3" />
                    <span>Discount {discountPercent ? `(${discountPercent}%)` : ""}:</span>
                  </span>
                  <span className="font-mono tabular-nums">-{formatTk(discountAmount)}</span>
                </div>
              )}

              {sale.roundOff !== 0 && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Round-off Adjustment:</span>
                  <span className="font-mono tabular-nums">{formatTk(sale.roundOff)}</span>
                </div>
              )}

              <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                <span>Net Total Bill:</span>
                <span className="font-mono text-base font-black text-slate-950 tabular-nums">
                  {formatTk(sale.totalAmount)}
                </span>
              </div>
            </div>

            {/* Right: Payment Channels & Dues */}
            <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200/80">
              <div className="flex justify-between text-slate-600">
                <span>Payment Method:</span>
                <span className="font-bold text-slate-900 uppercase">
                  {sale.paymentMethod || "Cash"}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Cash Paid:</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatTk(sale.cashPaid)}
                </span>
              </div>

              {sale.digitalPaid > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Digital Paid ({sale.digitalMedium || "MFS"}):</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatTk(sale.digitalPaid)}
                  </span>
                </div>
              )}

              {sale.digitalTrxId && (
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Trx ID:</span>
                  <span className="font-mono font-bold text-slate-700">
                    {sale.digitalTrxId}
                  </span>
                </div>
              )}

              {changeAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold pt-1 border-t border-slate-100">
                  <span>Change Returned:</span>
                  <span className="font-mono tabular-nums">{formatTk(changeAmount)}</span>
                </div>
              )}

              <div
                className={`pt-1.5 border-t border-slate-200 flex justify-between font-bold ${
                  sale.dueAmount > 0 ? "text-rose-700" : "text-slate-600"
                }`}
              >
                <span>Balance Due:</span>
                <span className="font-mono text-sm font-black tabular-nums">
                  {formatTk(sale.dueAmount || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
