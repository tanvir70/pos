import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  MessageCircle,
  PartyPopper,
  Printer,
  UserPlus,
  UserRound,
} from "lucide-react"
import type { SaleResponse, Customer } from "../../types"
import { formatTk } from "../../utils/currency"
import { isTypingTarget } from "../../utils/keyboard"
import { openWhatsAppPaymentReminder } from "../../utils/whatsapp"
import Modal from "../ui/Modal"
import Button from "../ui/Button"
import ThermalReceipt from "../ThermalReceipt"
import A4InvoicePrint from "../A4InvoicePrint"

function normalizeBangladeshPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  if (digits.length === 13 && digits.startsWith("88")) return digits.slice(2)
  return digits
}

function readableErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: string
      details?: Record<string, string> | null
      data?: { details?: Record<string, string> | null; message?: string } | unknown
    }
    const details =
      maybeError.details ||
      (maybeError.data &&
      typeof maybeError.data === "object" &&
      "details" in maybeError.data
        ? (maybeError.data as { details?: Record<string, string> | null }).details
        : null)
    if (details && Object.keys(details).length > 0) {
      return Object.values(details).join(" ")
    }
    if (maybeError.message) return maybeError.message
  }
  return "The sale could not be registered. Please try again."
}

export interface DualPrintModalProps {
  isOpen: boolean
  sale: SaleResponse | null
  customer?: Customer | null
  onClose: () => void
  draft?: {
    totalAmount: number
    cashPaid: number
    digitalPaid: number
  }
  onRegisterForThermalPrint?: (customerId?: number | null) => Promise<SaleResponse>
  customers?: Customer[]
  onResolveCustomerForSale?: (details: {
    phone: string
    name: string
  }) => Promise<Customer>
}

export default function DualPrintModal({
  isOpen,
  sale,
  customer,
  onClose,
  draft,
  onRegisterForThermalPrint,
  customers = [],
  onResolveCustomerForSale,
}: DualPrintModalProps) {
  const [activePrintView, setActivePrintView] = useState<"thermal" | "a4" | null>(null)
  const [autoPrint, setAutoPrint] = useState(false)
  const [registeredSale, setRegisteredSale] = useState<SaleResponse | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [registrationError, setRegistrationError] = useState<string | null>(null)
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || "")
  const [customerName, setCustomerName] = useState(customer?.name || "")
  const [resolvedCustomer, setResolvedCustomer] = useState<Customer | null>(customer || null)
  const wasOpenRef = useRef(false)
  const effectiveSale = registeredSale || sale
  const requiresRegistration = !effectiveSale && !!onRegisterForThermalPrint
  const phoneDigits = normalizeBangladeshPhone(customerPhone)
  const selectedCustomerMatchesPhone =
    !!customer && !!phoneDigits && normalizeBangladeshPhone(customer.phone) === phoneDigits
  const matchedCustomer = phoneDigits
    ? customers.find((c) => normalizeBangladeshPhone(c.phone) === phoneDigits) ||
      (selectedCustomerMatchesPhone ? customer : null)
    : null
  const customerForPrint = resolvedCustomer || matchedCustomer || customer || null
  const shouldCreateCustomer = !!phoneDigits && !matchedCustomer

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setCustomerPhone(customer?.phone || "")
      setCustomerName(customer?.name || "")
      setResolvedCustomer(customer || null)
    }

    if (!isOpen) {
      setActivePrintView(null)
      setAutoPrint(false)
      setRegisteredSale(null)
      setRegistrationError(null)
      setIsRegistering(false)
      setCustomerPhone(customer?.phone || "")
      setCustomerName(customer?.name || "")
      setResolvedCustomer(customer || null)
    }

    wasOpenRef.current = isOpen
  }, [isOpen, customer])

  const openThermalReceipt = useCallback(
    async (shouldAutoPrint = false) => {
      if (effectiveSale) {
        setAutoPrint(shouldAutoPrint)
        setActivePrintView("thermal")
        return
      }
      if (!onRegisterForThermalPrint || isRegistering) return

      try {
        setIsRegistering(true)
        setRegistrationError(null)
        const draftTotalAmount = effectiveSale?.totalAmount ?? draft?.totalAmount ?? 0
        const draftCashPaid = effectiveSale?.cashPaid ?? draft?.cashPaid ?? 0
        const draftDigitalPaid = effectiveSale?.digitalPaid ?? draft?.digitalPaid ?? 0
        const draftRemainingDue = Math.max(0, draftTotalAmount - draftCashPaid - draftDigitalPaid)
        let customerForSale = matchedCustomer
        if (draftRemainingDue > 0 && !phoneDigits && !matchedCustomer) {
          setRegistrationError("Customer phone is required when the sale has due amount.")
          return
        }
        if (phoneDigits && !matchedCustomer && onResolveCustomerForSale) {
          if (!/^01[3-9]\d{8}$/.test(phoneDigits)) {
            setRegistrationError("Enter a valid 11 digit Bangladesh phone number.")
            return
          }
          if (!customerName.trim()) {
            setRegistrationError("Customer name is required for a new phone number.")
            return
          }
          customerForSale = await onResolveCustomerForSale({
            phone: phoneDigits,
            name: customerName.trim(),
          })
          setResolvedCustomer(customerForSale)
        } else if (matchedCustomer) {
          setResolvedCustomer(matchedCustomer)
        }
        const response = await onRegisterForThermalPrint(customerForSale?.id ?? null)
        setRegisteredSale(response)
        setAutoPrint(shouldAutoPrint)
        setActivePrintView("thermal")
      } catch (error) {
        setRegistrationError(readableErrorMessage(error))
      } finally {
        setIsRegistering(false)
      }
    }, [
      customerName,
      customerPhone,
      effectiveSale,
      isRegistering,
      matchedCustomer,
      onRegisterForThermalPrint,
      onResolveCustomerForSale,
      phoneDigits,
      draft,
    ])

  // Third Enter of the checkout chain: print the cash memo straight away.
  useEffect(() => {
    if (!isOpen || activePrintView) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || isTypingTarget(e.target)) return
      e.preventDefault()
      void openThermalReceipt(true)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, activePrintView, openThermalReceipt])

  const closeAfterPrint = useCallback(() => {
    setActivePrintView(null)
    setAutoPrint(false)
    onClose()
  }, [onClose])

  if (!effectiveSale && !draft) return null

  // If active print view is chosen, render that modal directly
  if (activePrintView === "thermal" && effectiveSale) {
    return (
      <ThermalReceipt
        sale={effectiveSale}
        autoPrint={autoPrint}
        onClose={() => {
          setActivePrintView(null)
          setAutoPrint(false)
        }}
        onAfterPrint={closeAfterPrint}
      />
    )
  }

  if (activePrintView === "a4" && effectiveSale) {
    return (
      <A4InvoicePrint
        sale={effectiveSale}
        customer={customerForPrint}
        onClose={() => setActivePrintView(null)}
        onAfterPrint={closeAfterPrint}
      />
    )
  }

  const totalAmount = effectiveSale?.totalAmount ?? draft?.totalAmount ?? 0
  const cashPaid = effectiveSale?.cashPaid ?? draft?.cashPaid ?? 0
  const digitalPaid = effectiveSale?.digitalPaid ?? draft?.digitalPaid ?? 0
  const totalPaid = cashPaid + digitalPaid
  const changeToReturn =
    totalPaid > totalAmount ? totalPaid - totalAmount : 0
  const remainingDue =
    totalAmount > totalPaid ? totalAmount - totalPaid : 0
  const customerState = matchedCustomer
    ? "found"
    : shouldCreateCustomer
      ? "new"
      : remainingDue > 0
        ? "required"
        : "optional"

  const handleWhatsAppClick = () => {
    const phone = customerForPrint?.phone || (effectiveSale as any)?.customerPhone
    if (phone) {
      openWhatsAppPaymentReminder(
        phone,
        customerForPrint?.name || "Valued Customer",
        totalAmount,
        remainingDue,
        effectiveSale?.invoiceNo || "Pending",
      )
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={requiresRegistration ? "Register & Print Sale" : "Sale Completed Successfully!"}
      subtitle={requiresRegistration ? undefined : "Choose your invoice and print option"}
      icon={<PartyPopper className="w-5 h-5" />}
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isRegistering}>
            {requiresRegistration ? "Cancel" : "New Sale (Esc)"}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => void openThermalReceipt(true)}
              isLoading={isRegistering}
              leftIcon={<Printer className="w-4 h-4" />}
              className="bg-slate-950 hover:bg-slate-800"
            >
              {requiresRegistration ? "Register & Print" : "Thermal Receipt"}
              <span className="text-[11px] font-mono font-semibold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded ml-1.5">
                Enter
              </span>
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => setActivePrintView("a4")}
              disabled={!effectiveSale || isRegistering}
              leftIcon={<FileText className="w-4 h-4" />}
              title={!effectiveSale ? "Available after thermal registration" : undefined}
            >
              A4 Invoice
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-start justify-between gap-4 bg-slate-950 px-4 py-4 text-white">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                {effectiveSale ? "Invoice ready" : "Ready to register"}
              </span>
              <div className="mt-1 font-mono text-lg font-black">
                {effectiveSale ? `#${effectiveSale.invoiceNo}` : "Thermal print pending"}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Total bill
              </span>
              <div className="mt-1 font-mono text-2xl font-black tabular-nums">
                {formatTk(totalAmount)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50">
            <div className="px-4 py-3">
              <span className="text-[11px] font-semibold text-slate-500">Paid</span>
              <div className="mt-0.5 font-mono text-sm font-black text-slate-950">
                {formatTk(totalPaid)}
              </div>
            </div>
            <div className="px-4 py-3">
              <span className="text-[11px] font-semibold text-slate-500">Change</span>
              <div className="mt-0.5 font-mono text-sm font-black text-emerald-800">
                {formatTk(changeToReturn)}
              </div>
            </div>
            <div className="px-4 py-3">
              <span className="text-[11px] font-semibold text-slate-500">Due</span>
              <div
                className={`mt-0.5 font-mono text-sm font-black ${
                  remainingDue > 0 ? "text-red-600" : "text-slate-950"
                }`}
              >
                {formatTk(remainingDue)}
              </div>
            </div>
          </div>
        </div>

        {registrationError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {registrationError}
          </div>
        )}

        {requiresRegistration && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                  <UserRound className="h-4 w-4 text-emerald-700" />
                  Customer ledger
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {customerState === "found"
                    ? "Existing profile selected for this invoice."
                    : customerState === "new"
                      ? "Create a ledger profile with this sale."
                      : customerState === "required"
                        ? "Add a customer before registering due."
                        : "Cash sales can continue without a customer."}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${
                  customerState === "found"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : customerState === "new"
                      ? "border-sky-200 bg-sky-50 text-sky-800"
                      : customerState === "required"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                {customerState === "found" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : customerState === "new" ? (
                  <UserPlus className="h-3.5 w-3.5" />
                ) : customerState === "required" ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  <UserRound className="h-3.5 w-3.5" />
                )}
                {customerState === "found"
                  ? "Found"
                  : customerState === "new"
                    ? "New"
                    : customerState === "required"
                      ? "Required"
                      : "Optional"}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  Phone number
                </span>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => {
                    setCustomerPhone(event.target.value)
                    setResolvedCustomer(null)
                    setRegistrationError(null)
                  }}
                  placeholder="017xxxxxxxx"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm font-bold outline-hidden transition focus:border-emerald-700 focus:bg-white focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  Customer name
                </span>
                <input
                  type="text"
                  value={matchedCustomer ? matchedCustomer.name : customerName}
                  onChange={(event) => {
                    setCustomerName(event.target.value)
                    setRegistrationError(null)
                  }}
                  readOnly={!!matchedCustomer}
                  placeholder={shouldCreateCustomer ? "Required for new customer" : "Auto-filled if found"}
                  className={`h-11 w-full rounded-xl border px-3 text-sm font-bold outline-hidden transition focus:border-emerald-700 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)] ${
                    matchedCustomer
                      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                      : "border-slate-200 bg-slate-50 focus:bg-white"
                  }`}
                />
              </label>
            </div>
            <div
              className={`mt-3 rounded-xl border px-3 py-2 text-xs font-semibold ${
                customerState === "found"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : customerState === "new"
                    ? "border-sky-200 bg-sky-50 text-sky-900"
                    : customerState === "required"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {matchedCustomer
                ? `${matchedCustomer.name} matched by phone. This invoice will be registered under their ledger.`
                : shouldCreateCustomer
                  ? "No matching phone found. Enter the name and the profile will be created during registration."
                  : remainingDue > 0
                    ? "Due sale needs a customer phone before registration."
                    : "No customer selected. This will register as a walk-in cash sale."}
            </div>
          </div>
        )}

        {/* Customer Information (if available) */}
        {customerForPrint && (
          <div className="p-3 bg-slate-50/60 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-900 block">
                Customer: {customerForPrint.name}
              </span>
              <span className="text-slate-500 font-mono">{customerForPrint.phone}</span>
            </div>

            {customerForPrint.phone && (
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
