import { useState } from "react"
import type { SaleResponse, Customer } from "../../types"
import { formatTk } from "../../utils/currency"
import { openWhatsAppPaymentReminder } from "../../utils/whatsapp"
import Modal from "../ui/Modal"
import Button from "../ui/Button"
import ThermalReceipt from "../ThermalReceipt"
import A4InvoicePrint from "../A4InvoicePrint"

export interface DualPrintModalProps {
  isOpen: boolean
  sale: SaleResponse | null
  customer?: Customer | null
  onClose: () => void
}

export default function DualPrintModal({
  isOpen,
  sale,
  customer,
  onClose,
}: DualPrintModalProps) {
  const [activePrintView, setActivePrintView] = useState<"thermal" | "a4" | null>(null)

  if (!sale) return null

  // If active print view is chosen, render that modal directly
  if (activePrintView === "thermal") {
    return (
      <ThermalReceipt
        sale={sale}
        onClose={() => setActivePrintView(null)}
      />
    )
  }

  if (activePrintView === "a4") {
    return (
      <A4InvoicePrint
        sale={sale}
        customer={customer}
        onClose={() => setActivePrintView(null)}
      />
    )
  }

  const totalPaid = (sale.cashPaid || 0) + (sale.digitalPaid || 0)
  const changeToReturn =
    totalPaid > sale.totalAmount ? totalPaid - sale.totalAmount : 0
  const remainingDue =
    sale.totalAmount > totalPaid ? sale.totalAmount - totalPaid : 0

  const handleWhatsAppClick = () => {
    const phone = customer?.phone || (sale as any).customerPhone
    if (phone) {
      openWhatsAppPaymentReminder(
        phone,
        customer?.name || "সম্মানিত গ্রাহক",
        sale.totalAmount,
        remainingDue,
        sale.invoiceNumber,
      )
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="বিক্রি সফলভাবে সম্পন্ন হয়েছে!"
      subtitle="ইনভয়েস এবং প্রিন্ট অপশন নির্বাচন করুন"
      icon="🎉"
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" size="sm" onClick={onClose} className="bn-text">
            নতুন বিক্রি (Esc)
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setActivePrintView("thermal")}
              leftIcon={<span>🖨️</span>}
              className="bn-text"
            >
              থার্মাল রসিদ (80mm)
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setActivePrintView("a4")}
              leftIcon={<span>📄</span>}
              className="bn-text"
            >
              A4 ইনভয়েস প্রিন্ট
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Invoice Header Badge */}
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-800 font-semibold bn-text block">
              ইনভয়েস নম্বর:
            </span>
            <span className="text-base font-black font-mono text-emerald-950">
              #{sale.invoiceNumber}
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs text-emerald-800 font-semibold bn-text block">
              মোট বিল:
            </span>
            <span className="text-base font-black font-mono text-emerald-950">
              {formatTk(sale.totalAmount)}
            </span>
          </div>
        </div>

        {/* Financial Highlights */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 bg-frost-surface border border-frost-border rounded-xl">
            <span className="text-[11px] text-frost-muted bn-text block">পরিশোধ:</span>
            <span className="text-sm font-bold font-mono text-frost-dark">
              {formatTk(totalPaid)}
            </span>
          </div>

          <div className="p-2.5 bg-frost-surface border border-frost-border rounded-xl">
            <span className="text-[11px] text-frost-muted bn-text block">ফেরত:</span>
            <span className="text-sm font-bold font-mono text-emerald-800">
              {formatTk(changeToReturn)}
            </span>
          </div>

          <div className="p-2.5 bg-frost-surface border border-frost-border rounded-xl">
            <span className="text-[11px] text-frost-muted bn-text block">বাকি:</span>
            <span
              className={`text-sm font-bold font-mono ${
                remainingDue > 0 ? "text-red-600" : "text-frost-dark"
              }`}
            >
              {formatTk(remainingDue)}
            </span>
          </div>
        </div>

        {/* Customer Information (if available) */}
        {customer && (
          <div className="p-3 bg-frost-surface/60 border border-frost-border rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-frost-dark bn-text block">
                ক্রেতা: {customer.name}
              </span>
              <span className="text-frost-muted font-mono">{customer.phone}</span>
            </div>

            {customer.phone && (
              <button
                type="button"
                onClick={handleWhatsAppClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs bn-text transition-colors"
              >
                <span>💬</span>
                <span>WhatsApp চালান</span>
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
