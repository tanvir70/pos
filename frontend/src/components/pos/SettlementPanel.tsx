import { useEffect, useState } from "react"
import {
  Banknote,
  Smartphone,
  Send,
  BookOpen,
  Landmark,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react"
import type { PaymentMethod } from "../../types"
import { useCart } from "../../context/CartContext"
import { formatTk, roundAccounting } from "../../utils/currency"
import Button from "../ui/Button"
import Collapse from "../ui/Collapse"

export interface SettlementPanelProps {
  isOwner?: boolean
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
  isOwner = false,
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
    preRoundTotal,
    roundOff,
    setRoundOff,
    roundOffDeficit,
    applyQuickRoundOff,
    finalTotalAmount,
    paymentMethod,
    setPaymentMethod,
    cashPaidInput,
    setCashPaidInput,
    digitalPaidInput,
    setDigitalPaidInput,
    digitalMedium,
    setDigitalMedium,
    digitalTrxId,
    setDigitalTrxId,
    cashPaid,
    digitalPaid,
    totalPaid,
    liveDue,
    changeToReturn,
    totalPurchaseCost,
    totalGrossProfit,
    grossProfitMargin,
  } = useCart()

  // Two-step settlement: review the summary first, then reveal payment
  // method selection + tender amount only once the cashier proceeds.
  const [isPaymentStep, setIsPaymentStep] = useState(false)

  // Drop back to the summary step whenever the cart empties out (e.g. after
  // a completed sale), so the next customer starts from a clean screen.
  useEffect(() => {
    if (cart.length === 0) setIsPaymentStep(false)
  }, [cart.length])

  // Hotkey F9: advance to the payment step, or complete the sale if already there
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9" && cart.length > 0 && !isSubmitting) {
        e.preventDefault()
        if (isPaymentStep) {
          onSubmitSale()
        } else {
          setIsPaymentStep(true)
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [cart.length, isSubmitting, isPaymentStep, onSubmitSale])

  // Quick cash addition
  const handleQuickCashAdd = (addAmount: number) => {
    const current = parseFloat(cashPaidInput) || 0
    setCashPaidInput(String(roundAccounting(current + addAmount)))
  }

  const handleSetExactCash = () => {
    setCashPaidInput(String(finalTotalAmount))
  }

  const isCartEmpty = cart.length === 0

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Financial Summary */}
      <div className="p-3.5 space-y-2 border-b border-slate-200/60 bg-slate-50/20 text-xs">
        {/* Subtotal */}
        <div className="flex items-center justify-between text-slate-500">
          <span className="font-medium">Item Subtotal:</span>
          <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
            {formatTk(subtotal)}
          </span>
        </div>

        {/* Discount Row */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/40">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Discount:</span>
            <div className="inline-flex rounded-md border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setDiscountType("flat")}
                className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                  discountType === "flat"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                ৳
              </button>
              <button
                type="button"
                onClick={() => setDiscountType("percent")}
                className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                  discountType === "percent"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                %
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder="0"
              className="w-16 py-0.5 px-2 text-right font-mono font-bold text-xs bg-white border border-slate-200 rounded focus:border-emerald-600 focus:outline-hidden"
            />
            {computedDiscount > 0 && (
              <span className="font-mono text-red-600 font-bold tabular-nums">
                -{formatTk(computedDiscount)}
              </span>
            )}
          </div>
        </div>

        {/* 1-Click Quick Round-Off */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-200/40">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Round-off:</span>
            {roundOffDeficit > 0 && (
              <button
                type="button"
                onClick={applyQuickRoundOff}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded cursor-pointer"
                title="Drop the loose change (1-click round-off)"
              >
                <Zap className="w-3 h-3" />
                Drop {roundOffDeficit}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              value={roundOff || ""}
              onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-16 py-0.5 px-2 text-right font-mono font-bold text-xs bg-white border border-slate-200 rounded focus:border-emerald-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Net Payable Highlight */}
        <div className="flex items-baseline justify-between pt-2 border-t border-slate-200/60 bg-emerald-50/50 -mx-3.5 -mb-3.5 px-3.5 py-2.5">
          <div>
            <span className="text-xs font-black text-emerald-950 block leading-tight">
              Net Payable:
            </span>
          </div>
          <span className="font-mono font-black text-xl text-emerald-800 tabular-nums tracking-tight">
            {formatTk(finalTotalAmount)}
          </span>
        </div>
      </div>

      {/* Step 1: Summary only — proceed when ready to take payment */}
      {!isPaymentStep && (
        <div className="p-3.5">
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            disabled={isCartEmpty}
            onClick={() => setIsPaymentStep(true)}
            className="h-12 text-sm font-bold shadow-md cursor-pointer"
          >
            <div className="flex items-center justify-center gap-2">
              <span>Proceed to Payment</span>
              <ArrowRight className="w-4 h-4" />
              <span className="text-xs font-mono font-semibold bg-white/20 px-1.5 py-0.5 rounded ml-1">
                F9
              </span>
            </div>
          </Button>
        </div>
      )}

      {/* Step 2: Payment Method Selector */}
      {isPaymentStep && (
      <div className="p-3.5 space-y-3">
        <button
          type="button"
          onClick={() => setIsPaymentStep(false)}
          className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer -mt-1 -ml-1 px-1 py-0.5"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to summary
        </button>

        <div>
          <label className="block text-xs font-bold text-slate-900 mb-1.5">
            Payment Method:
          </label>
          <div className="grid grid-cols-5 gap-1">
            {PAYMENT_METHODS.map((m) => {
              const isSelected = paymentMethod === m.id
              const Icon = m.icon
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`flex flex-col items-center justify-center p-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-emerald-700 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-500/20"
                      : "bg-slate-50/40 hover:bg-slate-50 text-slate-900 border-slate-200"
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1" />
                  <span className="text-[11px] leading-tight">{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Payment Amount Inputs */}
        {paymentMethod === "CASH" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-900">
                Cash Received:
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSetExactCash}
                  className="px-2 py-0.5 text-[10px] font-bold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded cursor-pointer"
                >
                  Exact
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCashAdd(100)}
                  className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded cursor-pointer font-mono"
                >
                  +100
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCashAdd(500)}
                  className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded cursor-pointer font-mono"
                >
                  +500
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCashAdd(1000)}
                  className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded cursor-pointer font-mono"
                >
                  +1000
                </button>
              </div>
            </div>

            <input
              type="number"
              step="any"
              value={cashPaidInput}
              onChange={(e) => setCashPaidInput(e.target.value)}
              placeholder="0.00"
              className="w-full text-right font-mono font-black text-lg py-2 px-3 bg-white border-2 border-slate-200 rounded-xl focus:border-emerald-600 focus:outline-hidden tabular-nums"
            />
          </div>
        )}

        {(paymentMethod === "BKASH" ||
          paymentMethod === "NAGAD" ||
          paymentMethod === "BANK_TRANSFER") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-900">
                Digital Payment:
              </label>
              <span className="text-[11px] font-bold text-emerald-800">
                {paymentMethod === "BKASH"
                  ? "bKash"
                  : paymentMethod === "NAGAD"
                    ? "Nagad"
                    : "Bank"}
              </span>
            </div>

            <input
              type="number"
              step="any"
              value={digitalPaidInput}
              onChange={(e) => setDigitalPaidInput(e.target.value)}
              placeholder="0.00"
              className="w-full text-right font-mono font-black text-lg py-2 px-3 bg-white border-2 border-slate-200 rounded-xl focus:border-emerald-600 focus:outline-hidden tabular-nums"
            />

            <input
              type="text"
              value={digitalTrxId}
              onChange={(e) => setDigitalTrxId(e.target.value)}
              placeholder="Transaction ID / TrxID (optional)"
              className="w-full text-xs font-mono py-1.5 px-3 bg-white border border-slate-200 rounded-lg focus:border-emerald-600 focus:outline-hidden"
            />
          </div>
        )}

        <Collapse show={paymentMethod === "DUE"}>
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Full Due Sale</span>
            </div>
            <p className="text-[11px] text-amber-800">
              A total of {formatTk(finalTotalAmount)} will be added to the selected customer's due ledger.
            </p>
          </div>
        </Collapse>

        {/* Change Return / Live Due Badges */}
        <Collapse show={changeToReturn > 0}>
          <div className="flex items-center justify-between p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl">
            <span className="text-xs font-bold text-emerald-900">
              Return to Customer:
            </span>
            <span className="font-mono font-black text-lg text-emerald-800 tabular-nums">
              {formatTk(changeToReturn)}
            </span>
          </div>
        </Collapse>

        <Collapse show={liveDue > 0 && paymentMethod !== "DUE"}>
          <div className="flex items-center justify-between p-2.5 bg-rose-50 border border-rose-300 rounded-xl">
            <span className="text-xs font-bold text-rose-900">
              Remaining Due:
            </span>
            <span className="font-mono font-black text-base text-rose-700 tabular-nums">
              {formatTk(liveDue)}
            </span>
          </div>
        </Collapse>

        {/* Owner Mode Gross Profit KPI */}
        <Collapse show={isOwner && finalTotalAmount > 0}>
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1 text-amber-900">
            <div className="flex items-center justify-between">
              <span>Total Cost:</span>
              <span className="font-mono font-bold">{formatTk(totalPurchaseCost)}</span>
            </div>
            <div className="flex items-center justify-between font-bold text-emerald-800">
              <span>Estimated Gross Profit:</span>
              <span className="font-mono">
                {formatTk(totalGrossProfit)} ({grossProfitMargin}%)
              </span>
            </div>
          </div>
        </Collapse>

        {/* Complete Sale Action Button */}
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          disabled={isCartEmpty || isSubmitting}
          isLoading={isSubmitting}
          onClick={onSubmitSale}
          className="h-12 text-sm font-bold shadow-md cursor-pointer"
        >
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Complete Sale</span>
            <span className="text-xs font-mono font-semibold bg-white/20 px-1.5 py-0.5 rounded ml-1">
              F9
            </span>
          </div>
        </Button>
      </div>
      )}
    </div>
  )
}
