import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  FileText,
  Phone,
  Printer,
  Receipt,
  User,
  UserPlus,
  UserRound,
} from "lucide-react"
import type { SaleResponse, Customer } from "../../types"
import { formatTk } from "../../utils/currency"
import { isTypingTarget } from "../../utils/keyboard"
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
  onSaleCompleted?: (sale: SaleResponse, action: "thermal" | "a4" | "skipped") => void
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
  onSaleCompleted,
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
  const saleCompletedNotifiedRef = useRef(false)

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
      saleCompletedNotifiedRef.current = false
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
      saleCompletedNotifiedRef.current = false
    }

    wasOpenRef.current = isOpen
  }, [isOpen, customer])

  const notifySaleCompleted = useCallback(
    (completedSale: SaleResponse, action: "thermal" | "a4" | "skipped") => {
      if (saleCompletedNotifiedRef.current) return
      saleCompletedNotifiedRef.current = true
      onSaleCompleted?.(completedSale, action)
    },
    [onSaleCompleted],
  )

  const ensureSaleRegistered = useCallback(async (): Promise<SaleResponse | null> => {
    if (effectiveSale) return effectiveSale
    if (!onRegisterForThermalPrint || isRegistering) return null

    try {
      setIsRegistering(true)
      const draftTotalAmount = draft?.totalAmount ?? 0
      const draftCashPaid = draft?.cashPaid ?? 0
      const draftDigitalPaid = draft?.digitalPaid ?? 0
      const draftRemainingDue = Math.max(0, draftTotalAmount - draftCashPaid - draftDigitalPaid)
      let customerForSale = matchedCustomer
      if (draftRemainingDue > 0 && !phoneDigits && !matchedCustomer) {
        setRegistrationError("Customer phone is required when the sale has due amount.")
        return null
      }
      if (phoneDigits && !matchedCustomer && onResolveCustomerForSale) {
        if (!/^01[3-9]\d{8}$/.test(phoneDigits)) {
          setRegistrationError("Enter a valid 11 digit Bangladesh phone number.")
          return null
        }
        if (!customerName.trim()) {
          setRegistrationError("Customer name is required for a new phone number.")
          return null
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
      return response
    } catch (error) {
      setRegistrationError(readableErrorMessage(error))
      return null
    } finally {
      setIsRegistering(false)
    }
  }, [
    customerName,
    customerPhone,
    draft,
    effectiveSale,
    isRegistering,
    matchedCustomer,
    onRegisterForThermalPrint,
    onResolveCustomerForSale,
    phoneDigits,
  ])

  const openThermalReceipt = useCallback(
    async (shouldAutoPrint = false) => {
      const registered = await ensureSaleRegistered()
      if (registered) {
        setAutoPrint(shouldAutoPrint)
        setActivePrintView("thermal")
      }
    },
    [ensureSaleRegistered],
  )

  const openA4Invoice = useCallback(async () => {
    const registered = await ensureSaleRegistered()
    if (registered) {
      setActivePrintView("a4")
    }
  }, [ensureSaleRegistered])

  const handleSkipPrint = useCallback(async () => {
    const registered = await ensureSaleRegistered()
    if (registered) {
      notifySaleCompleted(registered, "skipped")
      onClose()
    }
  }, [ensureSaleRegistered, notifySaleCompleted, onClose])

  const closeAfterPrint = useCallback(
    (action: "thermal" | "a4") => {
      setActivePrintView(null)
      setAutoPrint(false)
      if (effectiveSale) {
        notifySaleCompleted(effectiveSale, action)
      }
      onClose()
    },
    [effectiveSale, notifySaleCompleted, onClose],
  )

  const handleModalClose = useCallback(() => {
    if (effectiveSale) {
      notifySaleCompleted(effectiveSale, "skipped")
    }
    onClose()
  }, [effectiveSale, notifySaleCompleted, onClose])

  // Keydown for Enter shortcut across modal
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

  if (!effectiveSale && !draft) return null

  if (activePrintView === "thermal" && effectiveSale) {
    return (
      <ThermalReceipt
        sale={effectiveSale}
        autoPrint={autoPrint}
        onClose={() => {
          setActivePrintView(null)
          setAutoPrint(false)
        }}
        onAfterPrint={() => closeAfterPrint("thermal")}
      />
    )
  }

  if (activePrintView === "a4" && effectiveSale) {
    return (
      <A4InvoicePrint
        sale={effectiveSale}
        customer={customerForPrint}
        onClose={() => setActivePrintView(null)}
        onAfterPrint={() => closeAfterPrint("a4")}
      />
    )
  }

  const totalAmount = effectiveSale?.totalAmount ?? draft?.totalAmount ?? 0
  const cashPaid = effectiveSale?.cashPaid ?? draft?.cashPaid ?? 0
  const digitalPaid = effectiveSale?.digitalPaid ?? draft?.digitalPaid ?? 0
  const totalPaid = cashPaid + digitalPaid
  const changeToReturn = totalPaid > totalAmount ? totalPaid - totalAmount : 0
  const remainingDue = totalAmount > totalPaid ? totalAmount - totalPaid : 0
  const customerState = matchedCustomer
    ? "found"
    : shouldCreateCustomer
      ? "new"
      : remainingDue > 0
        ? "required"
        : "optional"

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      headerVariant="light"
      title={
        <div className="flex items-center gap-2">
          <span>{requiresRegistration ? "Register Sale & Print" : "Sale Completed"}</span>
        </div>
      }
      icon={<Receipt className="w-5 h-5 text-emerald-600" />}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="ghost"
            size="md"
            onClick={handleModalClose}
            disabled={isRegistering}
            className="text-slate-500 hover:text-slate-900 font-semibold"
          >
            {requiresRegistration ? "Cancel" : "Done (Esc)"}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="md"
              onClick={() => void handleSkipPrint()}
              disabled={isRegistering}
              className="text-slate-600 hover:text-slate-900 font-semibold"
              leftIcon={<Check className="w-4 h-4 text-slate-500" />}
            >
              Skip Print
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => void openA4Invoice()}
              disabled={isRegistering}
              leftIcon={<FileText className="w-4 h-4 text-slate-600" />}
              className="border-slate-300 font-semibold hover:bg-slate-50"
            >
              A4 Invoice
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => void openThermalReceipt(true)}
              isLoading={isRegistering}
              leftIcon={<Printer className="w-4 h-4" />}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold shadow-xs px-5 cursor-pointer"
            >
              <span>{requiresRegistration ? "Register & Print" : "Thermal Receipt"}</span>
              <span className="ml-2 inline-flex items-center rounded bg-emerald-700/60 border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white">
                ↵ Enter
              </span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Settlement Summary Hero Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-5 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="flex items-center justify-between gap-4">
            <div>
              {effectiveSale ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Invoice #{effectiveSale.invoiceNo}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Ready to Register</span>
                </div>
              )}
            </div>

            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Net Payable
              </span>
              <div className="mt-0.5 font-mono text-2xl sm:text-3xl font-black tracking-tight text-white tabular-nums">
                {formatTk(totalAmount)}
              </div>
            </div>
          </div>

          {/* Metric Pills */}
          <div
            className={`mt-4 grid gap-2 sm:gap-3 ${
              remainingDue > 0 ? "grid-cols-3" : "grid-cols-2"
            }`}
          >
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Paid
              </span>
              <div className="mt-1 font-mono text-sm sm:text-base font-black tabular-nums text-white">
                {formatTk(totalPaid)}
              </div>
            </div>

            <div
              className={`rounded-xl border p-3 transition-colors ${
                changeToReturn > 0
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  changeToReturn > 0 ? "text-emerald-300 font-extrabold" : "text-slate-400"
                }`}
              >
                Change Return
              </span>
              <div
                className={`mt-1 font-mono text-sm sm:text-base font-black tabular-nums ${
                  changeToReturn > 0 ? "text-emerald-300" : "text-slate-300"
                }`}
              >
                {formatTk(changeToReturn)}
              </div>
            </div>

            {remainingDue > 0 && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-3 text-rose-300 transition-colors">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300">
                  Balance Due
                </span>
                <div className="mt-1 font-mono text-sm sm:text-base font-black tabular-nums text-rose-300">
                  {formatTk(remainingDue)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error alert banner */}
        {registrationError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 animate-in fade-in duration-150">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div className="flex-1">{registrationError}</div>
          </div>
        )}

        {/* Customer Ledger Configuration Card */}
        {requiresRegistration && (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <UserRound className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    Customer Ledger
                  </div>
                  <p className="text-xs text-slate-500">
                    Auto-matches existing customer or registers new account
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                  customerState === "found"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-2xs"
                    : customerState === "new"
                      ? "border-sky-200 bg-sky-50 text-sky-800 shadow-2xs"
                      : customerState === "required"
                        ? "border-rose-200 bg-rose-50 text-rose-700 shadow-2xs animate-pulse"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                {customerState === "found" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : customerState === "new" ? (
                  <UserPlus className="h-3.5 w-3.5 text-sky-600" />
                ) : customerState === "required" ? (
                  <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                ) : (
                  <UserRound className="h-3.5 w-3.5 text-slate-500" />
                )}
                {customerState === "found"
                  ? "Matched Customer"
                  : customerState === "new"
                    ? "New Ledger Profile"
                    : customerState === "required"
                      ? "Phone Required (Due)"
                      : "Walk-in (Optional)"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Phone Number
                  </label>
                  {remainingDue > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                      Required
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    value={customerPhone}
                    onChange={(event) => {
                      const cleaned = event.target.value.replace(/\D/g, "").slice(0, 11)
                      setCustomerPhone(cleaned)
                      setResolvedCustomer(null)
                      setRegistrationError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void openThermalReceipt(true)
                      }
                    }}
                    placeholder="01XXXXXXXXX"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3 font-mono text-sm font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-3 focus:ring-emerald-500/15"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Customer Name
                  </label>
                  {shouldCreateCustomer && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">
                      Required for New
                    </span>
                  )}
                </div>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={matchedCustomer ? matchedCustomer.name : customerName}
                    onChange={(event) => {
                      setCustomerName(event.target.value)
                      setRegistrationError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void openThermalReceipt(true)
                      }
                    }}
                    readOnly={!!matchedCustomer}
                    placeholder={
                      shouldCreateCustomer
                        ? "Enter customer name"
                        : "Auto-filled if matched"
                    }
                    className={`h-11 w-full rounded-xl border pl-10 pr-9 text-sm font-bold outline-none transition ${
                      matchedCustomer
                        ? "border-emerald-200 bg-emerald-50/70 text-emerald-950 font-bold select-none cursor-default"
                        : "border-slate-200 bg-slate-50/50 text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-3 focus:ring-emerald-500/15"
                    }`}
                  />
                  {matchedCustomer && (
                    <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                  )}
                </div>
              </div>
            </div>

            {/* Contextual feedback callout */}
            {matchedCustomer ? (
              <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <div className="font-bold text-emerald-950">
                      {matchedCustomer.name}
                      <span className="ml-1.5 font-mono font-normal text-emerald-700">
                        ({matchedCustomer.phone})
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-emerald-800/90">
                      Customer found in directory. This invoice will link to their account ledger.
                    </p>
                  </div>
                </div>
                {Number(matchedCustomer.currentDue || 0) > 0 && (
                  <div className="shrink-0 rounded-lg border border-rose-200/80 bg-white/90 px-2.5 py-1 text-right">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-600">
                      Current Due
                    </span>
                    <span className="font-mono text-xs font-black text-rose-700">
                      {formatTk(matchedCustomer.currentDue)}
                    </span>
                  </div>
                )}
              </div>
            ) : shouldCreateCustomer ? (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-xs text-sky-900">
                <UserPlus className="h-4 w-4 shrink-0 text-sky-600" />
                <span>
                  New customer profile will be created and saved to your directory upon registration.
                </span>
              </div>
            ) : customerState === "required" ? (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>
                  Credit sale requires a customer phone to track remaining due of{" "}
                  <strong className="font-mono">{formatTk(remainingDue)}</strong> in the ledger.
                </span>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs text-slate-500">
                <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>
                  Walk-in cash sale. You can leave phone blank, or enter a number to record points.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
