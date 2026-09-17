import { useEffect } from "react"
import type { PaymentMethod } from "../../types"
import { useCart } from "../../context/CartContext"
import { formatTk, roundAccounting } from "../../utils/currency"
import Button from "../ui/Button"

export interface SettlementPanelProps {
  isOwner?: boolean
  isSubmitting?: boolean
  onSubmitSale: () => void
  customerDue?: number
}

const PAYMENT_METHODS: { id: PaymentMethod; labelBn: string; icon: string }[] = [
  { id: "CASH", labelBn: "নগদ", icon: "💵" },
  { id: "BKASH", labelBn: "বিকাশ", icon: "📱" },
  { id: "NAGAD", labelBn: "নগদ পে", icon: "📲" },
  { id: "DUE", labelBn: "বাকি", icon: "📒" },
  { id: "BANK_TRANSFER", labelBn: "ব্যাংক", icon: "🏦" },
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

  // Hotkey F9 to submit sale
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9" && cart.length > 0 && !isSubmitting) {
        e.preventDefault()
        onSubmitSale()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [cart.length, isSubmitting, onSubmitSale])

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
    <div className="flex flex-col bg-white rounded-2xl border border-frost-border shadow-xs overflow-hidden">
      {/* Financial Summary */}
      <div className="p-3.5 space-y-2 border-b border-frost-border/60 bg-frost-surface/20 text-xs">
        {/* Subtotal */}
        <div className="flex items-center justify-between text-frost-muted">
          <span className="bn-text font-medium">মোট আইটেম মূল্য:</span>
          <span className="font-mono font-bold text-frost-dark text-sm tabular-nums">
            {formatTk(subtotal)}
          </span>
        </div>

        {/* Discount Row */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-frost-border/40">
          <div className="flex items-center gap-1.5">
            <span className="bn-text text-frost-muted font-medium">ছাড় (Discount):</span>
            <div className="inline-flex rounded-md border border-frost-border bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setDiscountType("flat")}
                className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                  discountType === "flat"
                    ? "bg-frost-dark text-white"
                    : "text-frost-muted hover:bg-frost-hover"
                }`}
              >
                ৳
              </button>
              <button
                type="button"
                onClick={() => setDiscountType("percent")}
                className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                  discountType === "percent"
                    ? "bg-frost-dark text-white"
                    : "text-frost-muted hover:bg-frost-hover"
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
              className="w-16 py-0.5 px-2 text-right font-mono font-bold text-xs bg-white border border-frost-border rounded focus:border-emerald-600 focus:outline-hidden"
            />
            {computedDiscount > 0 && (
              <span className="font-mono text-red-600 font-bold tabular-nums">
                -{formatTk(computedDiscount)}
              </span>
            )}
          </div>
        </div>

        {/* 1-Click Quick Round-Off */}
        <div className="flex items-center justify-between pt-1 border-t border-frost-border/40">
          <div className="flex items-center gap-1.5">
            <span className="bn-text text-frost-muted font-medium">রাউন্ড-অফ:</span>
            {roundOffDeficit > 0 && (
              <button
                type="button"
                onClick={applyQuickRoundOff}
                className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded cursor-pointer bn-text"
                title="খুচরা পয়সা বাদ দিন (১-ক্লিক রাউন্ড-অফ)"
              >
                ⚡ {roundOffDeficit} বাদ দিন
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
              className="w-16 py-0.5 px-2 text-right font-mono font-bold text-xs bg-white border border-frost-border rounded focus:border-emerald-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Net Payable Highlight */}
        <div className="flex items-baseline justify-between pt-2 border-t border-frost-border/60 bg-emerald-50/50 -mx-3.5 -mb-3.5 px-3.5 py-2.5">
          <div>
            <span className="text-xs font-black text-emerald-950 bn-text block leading-tight">
              সর্বমোট পরিশোধযোগ্য:
            </span>
            <span className="text-[10px] text-frost-muted font-mono">Net Payable</span>
          </div>
          <span className="font-mono font-black text-xl text-emerald-800 tabular-nums tracking-tight">
            {formatTk(finalTotalAmount)}
          </span>
        </div>
      </div>

      {/* Payment Method Selector */}
      <div className="p-3.5 space-y-3">
        <div>
          <label className="block text-xs font-bold text-frost-dark bn-text mb-1.5">
            পরিশোধ মাধ্যম:
          </label>
          <div className="grid grid-cols-5 gap-1">
            {PAYMENT_METHODS.map((m) => {
              const isSelected = paymentMethod === m.id
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`flex flex-col items-center justify-center p-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-emerald-700 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-500/20"
                      : "bg-frost-surface/40 hover:bg-frost-surface text-frost-dark border-frost-border"
                  }`}
                >
                  <span className="text-sm leading-none mb-1">{m.icon}</span>
                  <span className="bn-text text-[11px] leading-tight">{m.labelBn}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Payment Amount Inputs */}
        {paymentMethod === "CASH" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-frost-dark bn-text">
                প্রাপ্ত নগদ টাকা:
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSetExactCash}
                  className="px-2 py-0.5 text-[10px] font-bold bg-frost-surface hover:bg-frost-hover border border-frost-border rounded cursor-pointer bn-text"
                >
                  সমান সমান
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
              className="w-full text-right font-mono font-black text-lg py-2 px-3 bg-white border-2 border-frost-border rounded-xl focus:border-emerald-600 focus:outline-hidden tabular-nums"
            />
          </div>
        )}

        {(paymentMethod === "BKASH" ||
          paymentMethod === "NAGAD" ||
          paymentMethod === "BANK_TRANSFER") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-frost-dark bn-text">
                ডিজিটাল পরিশোধ:
              </label>
              <span className="text-[11px] font-bold text-emerald-800 bn-text">
                {paymentMethod === "BKASH"
                  ? "বিকাশ"
                  : paymentMethod === "NAGAD"
                    ? "নগদ পে"
                    : "ব্যাংক"}
              </span>
            </div>

            <input
              type="number"
              step="any"
              value={digitalPaidInput}
              onChange={(e) => setDigitalPaidInput(e.target.value)}
              placeholder="0.00"
              className="w-full text-right font-mono font-black text-lg py-2 px-3 bg-white border-2 border-frost-border rounded-xl focus:border-emerald-600 focus:outline-hidden tabular-nums"
            />

            <input
              type="text"
              value={digitalTrxId}
              onChange={(e) => setDigitalTrxId(e.target.value)}
              placeholder="ট্রানজেকশন আইডি / TrxID (ঐচ্ছিক)"
              className="w-full text-xs font-mono py-1.5 px-3 bg-white border border-frost-border rounded-lg focus:border-emerald-600 focus:outline-hidden"
            />
          </div>
        )}

        {paymentMethod === "DUE" && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs bn-text">
              <span>⚠️</span>
              <span>সম্পূর্ণ বাকি বিক্রয় (Due Sale)</span>
            </div>
            <p className="text-[11px] text-amber-800 bn-text">
              সর্বমোট {formatTk(finalTotalAmount)} টাকা নির্বাচিত গ্রাহকের বাকি খাতায় যুক্ত হবে।
            </p>
          </div>
        )}

        {/* Change Return / Live Due Badges */}
        {changeToReturn > 0 && (
          <div className="flex items-center justify-between p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl animate-in fade-in">
            <span className="text-xs font-bold text-emerald-900 bn-text">
              ক্রেতাকে ফেরত দিন:
            </span>
            <span className="font-mono font-black text-lg text-emerald-800 tabular-nums">
              {formatTk(changeToReturn)}
            </span>
          </div>
        )}

        {liveDue > 0 && paymentMethod !== "DUE" && (
          <div className="flex items-center justify-between p-2.5 bg-rose-50 border border-rose-300 rounded-xl animate-in fade-in">
            <span className="text-xs font-bold text-rose-900 bn-text">
              বাকি থাকবে:
            </span>
            <span className="font-mono font-black text-base text-rose-700 tabular-nums">
              {formatTk(liveDue)}
            </span>
          </div>
        )}

        {/* Owner Mode Gross Profit KPI */}
        {isOwner && finalTotalAmount > 0 && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1 bn-text text-amber-900">
            <div className="flex items-center justify-between">
              <span>মোট কেনা খরচ (Cost):</span>
              <span className="font-mono font-bold">{formatTk(totalPurchaseCost)}</span>
            </div>
            <div className="flex items-center justify-between font-bold text-emerald-800">
              <span>আনুমানিক মোট লাভ:</span>
              <span className="font-mono">
                {formatTk(totalGrossProfit)} ({grossProfitMargin}%)
              </span>
            </div>
          </div>
        )}

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
            <span>✅</span>
            <span className="bn-text">বিক্রি সম্পন্ন করুন</span>
            <span className="text-xs font-mono font-semibold bg-white/20 px-1.5 py-0.5 rounded ml-1">
              F9
            </span>
          </div>
        </Button>
      </div>
    </div>
  )
}
