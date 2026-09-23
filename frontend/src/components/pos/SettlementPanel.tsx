import { useState, useEffect } from "react"
import {
  Banknote,
  Smartphone,
  Send,
  BookOpen,
  Landmark,
  AlertTriangle,
  CheckCircle2,
  Percent,
  type LucideIcon,
} from "lucide-react"
import type { PaymentMethod, SaleMode } from "../../types"
import { useCart } from "../../context/CartContext"
import { useToast } from "../../context/ToastContext"
import { formatTk, roundAccounting } from "../../utils/currency"
import { getWholesaleSettings, type WholesaleSettings } from "../../utils/wholesaleSettings"
import Button from "../ui/Button"
import Collapse from "../ui/Collapse"
import Badge from "../ui/Badge"
import { Separator } from "../ui/separator"

export interface SettlementPanelProps {
  isSubmitting?: boolean
  onSubmitSale: () => void
  customerDue?: number
}

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { id: "CASH", label: "Cash", icon: Banknote },
  { id: "BKASH", label: "bKash", icon: Smartphone },
  { id: "NAGAD", label: "Nagad", icon: Send },
  { id: "DUE", label: "Due", icon: BookOpen },
  { id: "BANK_TRANSFER", label: "Bank", icon: Landmark },
]

export default function SettlementPanel({
  isSubmitting = false,
  onSubmitSale,
  customerDue = 0,
}: SettlementPanelProps) {
  const {
    cart,
    subtotal,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    computedDiscount,
    roundOff,
    setRoundOff,
    roundOffDeficit,
    applyQuickRoundOff,
    finalTotalAmount,
    paymentMethod,
    setPaymentMethod,
    cashPaidInput,
    setCashPaidInput,
    dueAmountInput,
    setDueAmountInput,
    dueAmount,
    cashPaid,
    digitalPaidInput,
    setDigitalPaidInput,
    setDigitalMedium,
    digitalTrxId,
    setDigitalTrxId,
    liveDue,
    changeToReturn,
    saleMode,
    toggleSaleMode,
  } = useCart()

  const { showSuccess, showInfo } = useToast()
  const [wholesaleSettings, setWholesaleSettings] = useState<WholesaleSettings>(getWholesaleSettings)
  const [showAdjustments, setShowAdjustments] = useState(false)

  useEffect(() => {
    const handleSettingsUpdated = (e: Event) => {
      const custom = e as CustomEvent<WholesaleSettings>
      if (custom.detail) {
        setWholesaleSettings(custom.detail)
        if (saleMode === "WHOLESALE") {
          setDiscountType("percent")
          setDiscountValue(String(custom.detail.discountPercentage))
        }
      }
    }
    window.addEventListener("wholesale-settings-updated", handleSettingsUpdated)
    return () => window.removeEventListener("wholesale-settings-updated", handleSettingsUpdated)
  }, [
    saleMode,
    setDiscountType,
    setDiscountValue,
  ])

  const handleToggleWholesale = () => {
    // 1. Fetch fresh wholesale configuration settings directly from storage
    const latestSettings = getWholesaleSettings()
    setWholesaleSettings(latestSettings)

    // 2. Toggle sale mode; wholesale is represented as a visible order adjustment.
    const nextMode: SaleMode = saleMode === "WHOLESALE" ? "RETAIL" : "WHOLESALE"
    toggleSaleMode(nextMode)

    if (nextMode === "WHOLESALE") {
      setDiscountType("percent")
      setDiscountValue(String(latestSettings.discountPercentage))
      setShowAdjustments(true)
      showSuccess(
        `Wholesale adjustment (${latestSettings.discountPercentage}%) applied.`,
        "Wholesale Applied",
        { closePrevious: true },
      )
    } else {
      setDiscountValue("")
      showInfo("Reverted order back to standard Retail pricing.", "Retail Mode", {
        closePrevious: true,
      })
    }
  }

  // Quick cash addition
  const handleQuickCashAdd = (addAmount: number) => {
    const current = parseFloat(cashPaidInput) || 0
    setCashPaidInput(String(roundAccounting(current + addAmount)))
  }

  const handleSetExactCash = () => {
    setCashPaidInput(String(finalTotalAmount))
  }

  const handleSetFullDue = () => {
    setDueAmountInput(finalTotalAmount > 0 ? String(finalTotalAmount) : "")
  }

  const handleDueAmountChange = (val: string) => {
    const num = parseFloat(val)
    if (!isNaN(num) && num > finalTotalAmount) {
      setDueAmountInput(String(finalTotalAmount))
    } else {
      setDueAmountInput(val)
    }
  }

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setPaymentMethod(method)
    if (method === "BKASH") setDigitalMedium("BKASH")
    if (method === "NAGAD") setDigitalMedium("NAGAD")
    if (method === "BANK_TRANSFER") setDigitalMedium("BANK_TRANSFER")
  }

  const isCartEmpty = cart.length === 0
  const hasAdjustments = computedDiscount > 0 || roundOff > 0
  const selectedPayment = PAYMENT_METHODS.find((method) => method.id === paymentMethod)
  const paymentLabel = selectedPayment?.label || "Payment"

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
      <div className="shrink-0 border-b border-slate-200 bg-slate-950 px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-300">
              Amount due
            </span>
            <div className="mt-1 font-mono text-3xl font-black leading-none tabular-nums">
              {formatTk(finalTotalAmount)}
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleWholesale}
            title={
              saleMode === "WHOLESALE"
                ? "Click to revert to standard Retail prices"
                : `Click to apply wholesale pricing (-${wholesaleSettings.discountPercentage}%)`
            }
            className={`shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-black uppercase transition-colors cursor-pointer ${
              saleMode === "WHOLESALE"
                ? "border-emerald-300 bg-emerald-300 text-slate-950 shadow-xs"
                : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            {saleMode === "WHOLESALE" ? "Wholesale" : "Retail"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-md bg-white/[0.07] px-2 py-2">
            <span className="block text-slate-400">Subtotal</span>
            <span className="font-mono font-bold tabular-nums">{formatTk(subtotal)}</span>
          </div>
          <div className="rounded-md bg-white/[0.07] px-2 py-2">
            <span className="block text-slate-400">Discount</span>
            <span className="font-mono font-bold tabular-nums">
              {computedDiscount > 0 ? `-${formatTk(computedDiscount)}` : formatTk(0)}
            </span>
          </div>
          <div className="rounded-md bg-white/[0.07] px-2 py-2">
            <span className="block text-slate-400">Round</span>
            <span className="font-mono font-bold tabular-nums">
              {roundOff > 0 ? `-${formatTk(roundOff)}` : formatTk(0)}
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-3">
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-black uppercase text-slate-500">
              Payment
            </label>
            {customerDue > 0 && (
              <span className="text-[11px] font-semibold text-slate-500">
                Previous due:{" "}
                <span className="font-mono text-slate-900">{formatTk(customerDue)}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-5 gap-1 rounded-lg bg-slate-100 p-1">
            {PAYMENT_METHODS.map((m) => {
              const isSelected = paymentMethod === m.id
              const Icon = m.icon
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => handlePaymentMethodChange(m.id)}
                  className={`flex h-12 flex-col items-center justify-center rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-white text-emerald-800 shadow-xs ring-1 ring-slate-200"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                  }`}
                >
                  <Icon className="mb-0.5 h-3.5 w-3.5" />
                  <span className="leading-none">{m.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Payment Amount Inputs */}
        {paymentMethod === "CASH" && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-black uppercase text-slate-500">
                Cash received
              </label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSetExactCash}
                  className="h-6 px-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Exact
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickCashAdd(100)}
                  className="h-6 px-1.5 font-mono text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  +100
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickCashAdd(500)}
                  className="h-6 px-1.5 font-mono text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  +500
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickCashAdd(1000)}
                  className="h-6 px-1.5 font-mono text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  +1000
                </Button>
              </div>
            </div>

            <input
              type="number"
              step="any"
              value={cashPaidInput}
              onChange={(e) => setCashPaidInput(e.target.value)}
              placeholder="0.00"
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-right font-mono text-2xl font-black text-slate-950 tabular-nums outline-hidden focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
            />
          </section>
        )}

        {(paymentMethod === "BKASH" ||
          paymentMethod === "NAGAD" ||
          paymentMethod === "BANK_TRANSFER") && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-black uppercase text-slate-500">
                {paymentLabel} received
              </label>
            </div>

            <input
              type="number"
              step="any"
              value={digitalPaidInput}
              onChange={(e) => setDigitalPaidInput(e.target.value)}
              placeholder="0.00"
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-right font-mono text-2xl font-black text-slate-950 tabular-nums outline-hidden focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
            />

            <input
              type="text"
              value={digitalTrxId}
              onChange={(e) => setDigitalTrxId(e.target.value)}
              placeholder="Transaction ID / TrxID (optional)"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs outline-hidden focus:border-emerald-700 focus:bg-white"
            />
          </section>
        )}

        {paymentMethod === "DUE" && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-black uppercase text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Due amount (to ledger)
              </label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSetFullDue}
                  className="h-6 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-[10px] font-bold cursor-pointer px-2"
                >
                  Full Due
                </Button>
              </div>
            </div>

            <input
              type="number"
              step="any"
              min="0"
              max={finalTotalAmount}
              value={dueAmountInput}
              onChange={(e) => handleDueAmountChange(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder={finalTotalAmount > 0 ? String(finalTotalAmount) : "0.00"}
              className="h-12 w-full rounded-lg border border-amber-300 bg-white px-3 text-right font-mono text-2xl font-black text-amber-950 tabular-nums outline-hidden focus:border-amber-600 focus:ring-4 focus:ring-amber-500/15"
            />

            {/* Live due vs cash down payment breakdown */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Customer Due (Ledger):</span>
                <span className="font-mono font-bold text-amber-900 text-sm">
                  {formatTk(dueAmount)}
                </span>
              </div>
              {cashPaid > 0 ? (
                <div className="flex items-center justify-between border-t border-amber-200/80 pt-2">
                  <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    Cash to collect now:
                  </span>
                  <span className="font-mono font-black text-emerald-700 text-base">
                    {formatTk(cashPaid)}
                  </span>
                </div>
              ) : (
                <div className="text-[11px] text-amber-800 border-t border-amber-200/80 pt-1.5">
                  100% full amount will be added to the customer's credit ledger.
                </div>
              )}
            </div>
          </section>
        )}

        <section className="rounded-lg border border-slate-200 bg-slate-50/70">
          <button
            type="button"
            onClick={() => setShowAdjustments((current) => !current)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-bold text-slate-700 cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              <Percent className="h-3.5 w-3.5 text-slate-500" />
              Adjustments
              {hasAdjustments && (
                <Badge variant="success" className="text-[10px] py-0 px-1.5">
                  Applied
                </Badge>
              )}
            </span>
            <span className="text-[11px] text-slate-400">
              {showAdjustments ? "Hide" : "Edit"}
            </span>
          </button>

          <Collapse show={showAdjustments}>
            <div className="space-y-2 border-t border-slate-200 px-3 py-2.5">
              <div className="grid grid-cols-[1fr_112px] items-end gap-2">
                <label className="space-y-1">
                  <span className="block text-[11px] font-bold text-slate-500">
                    Discount
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="0"
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-right font-mono text-sm font-bold outline-hidden focus:border-emerald-700"
                  />
                </label>
                <div className="grid h-9 grid-cols-2 overflow-hidden rounded-md border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setDiscountType("flat")}
                    className={`text-xs font-black cursor-pointer ${
                      discountType === "flat"
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    ৳
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("percent")}
                    className={`border-l border-slate-200 text-xs font-black cursor-pointer ${
                      discountType === "percent"
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>

              {saleMode === "WHOLESALE" && (
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold leading-tight text-slate-700">
                      Wholesale percentage
                    </p>
                    <p className="text-[10px] leading-tight text-slate-500">
                      Default: {wholesaleSettings.discountPercentage}%. Edit this sale directly when needed.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-[1fr_112px] items-end gap-2">
                <label className="space-y-1">
                  <span className="block text-[11px] font-bold text-slate-500">
                    Round off
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={roundOff || ""}
                    onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-right font-mono text-sm font-bold outline-hidden focus:border-emerald-700"
                  />
                </label>
                <button
                  type="button"
                  onClick={applyQuickRoundOff}
                  disabled={roundOffDeficit <= 0}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 cursor-pointer"
                >
                  Auto round
                </button>
              </div>
            </div>
          </Collapse>
        </section>

        {/* Change Return / Live Due Badges */}
        <Collapse show={changeToReturn > 0}>
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <span className="text-xs font-bold text-emerald-900">
              Return to customer
            </span>
            <span className="font-mono text-lg font-black text-emerald-800 tabular-nums">
              {formatTk(changeToReturn)}
            </span>
          </div>
        </Collapse>

        <Collapse show={liveDue > 0 && paymentMethod !== "DUE"}>
          <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
            <span className="text-xs font-bold text-rose-900">
              Remaining due
            </span>
            <span className="font-mono text-base font-black text-rose-700 tabular-nums">
              {formatTk(liveDue)}
            </span>
          </div>
        </Collapse>

      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white p-4 shadow-[0_-10px_24px_rgba(15,23,42,0.08)]">
        {/* Complete Sale Action Button */}
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          disabled={isCartEmpty || isSubmitting}
          isLoading={isSubmitting}
          onClick={onSubmitSale}
          className="h-[52px] rounded-lg text-sm font-black shadow-sm cursor-pointer"
        >
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Complete & Print</span>
            <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs font-semibold">
              Enter
            </span>
          </div>
        </Button>
      </div>
    </div>
  )
}
