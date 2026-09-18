import { useEffect, useState } from "react"
import { PartyPopper, Printer, FileText, MessageCircle } from "lucide-react"
import type { SaleResponse, Customer } from "../../types"
import { formatTk } from "../../utils/currency"
import { isTypingTarget } from "../../utils/keyboard"
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
  const [autoPrint, setAutoPrint] = useState(false)

  // Third Enter of the checkout chain: print the cash memo straight away.
  useEffect(() => {
    if (!isOpen || activePrintView) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || isTypingTarget(e.target)) return
      e.preventDefault()
      setAutoPrint(true)
      setActivePrintView("thermal")
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, activePrintView])

  if (!sale) return null

  // If active print view is chosen, render that modal directly
  if (activePrintView === "thermal") {
    return (
      <ThermalReceipt
        sale={sale}
        autoPrint={autoPrint}
        onClose={() => {
          setActivePrintView(null)
          setAutoPrint(false)
        }}
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
        customer?.name || "Valued Customer",
        sale.totalAmount,
        remainingDue,
        sale.invoiceNo,
      )
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sale Completed Successfully!"
      subtitle="Choose your invoice and print option"
      icon={<PartyPopper className="w-5 h-5" />}
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" size="sm" onClick={onClose}>
            New Sale (Esc)
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setActivePrintView("thermal")}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              Thermal Receipt (80mm)
              <span className="text-[11px] font-mono font-semibold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded ml-1.5">
                Enter
              </span>
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setActivePrintView("a4")}
              leftIcon={<FileText className="w-4 h-4" />}
            >
              A4 Invoice Print
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Invoice Header Badge */}
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-800 font-semibold block">
              Invoice Number:
            </span>
            <span className="text-base font-black font-mono text-emerald-950">
              #{sale.invoiceNo}
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs text-emerald-800 font-semibold block">
              Total Bill:
            </span>
            <span className="text-base font-black font-mono text-emerald-950">
              {formatTk(sale.totalAmount)}
            </span>
          </div>
        </div>

        {/* Financial Highlights */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] text-slate-500 block">Paid:</span>
            <span className="text-sm font-bold font-mono text-slate-900">
              {formatTk(totalPaid)}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] text-slate-500 block">Change:</span>
            <span className="text-sm font-bold font-mono text-emerald-800">
              {formatTk(changeToReturn)}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] text-slate-500 block">Due:</span>
            <span
              className={`text-sm font-bold font-mono ${
                remainingDue > 0 ? "text-red-600" : "text-slate-900"
              }`}
            >
              {formatTk(remainingDue)}
            </span>
          </div>
        </div>

        {/* Customer Information (if available) */}
        {customer && (
          <div className="p-3 bg-slate-50/60 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-900 block">
                Customer: {customer.name}
              </span>
              <span className="text-slate-500 font-mono">{customer.phone}</span>
            </div>

            {customer.phone && (
              <button
                type="button"
                onClick={handleWhatsAppClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Send via WhatsApp</span>
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
