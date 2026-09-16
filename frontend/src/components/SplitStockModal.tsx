import { useState, useEffect } from "react"
import type { CartItem } from "../types"

// BUSINESS DECISION: Split-stock allocation allows fulfilling sales across Dokan counter and
// Godown warehouse on the same invoice. Asymmetric negative stock is allowed for Dokan (for newly
// arrived unentered stock) but strictly prevented for Godown to protect warehouse audit integrity.

export interface SplitStockModalProps {
  item: CartItem
  isOpen: boolean
  onClose: () => void
  onApplySplit: (dokanQty: number, godownQty: number) => void
}

export default function SplitStockModal({
  item,
  isOpen,
  onClose,
  onApplySplit,
}: SplitStockModalProps) {
  const requested = item.quantity ?? item.totalQuantity ?? 0
  const dokanAvailable = item.dokanAvailable ?? 0
  const godownAvailable = item.godownAvailable ?? 0

  const [dokanQty, setDokanQty] = useState<number>(item.dokanQuantity ?? requested)
  const [godownQty, setGodownQty] = useState<number>(item.godownQuantity ?? 0)

  // Reset when item changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setDokanQty(item.dokanQuantity ?? requested)
      setGodownQty(item.godownQuantity ?? 0)
    }
  }, [isOpen, item, requested])

  if (!isOpen) return null

  const currentTotal = Number((dokanQty + godownQty).toFixed(3))
  const isSumValid = Math.abs(currentTotal - requested) < 0.001
  const isGodownOverdrawn = godownQty > godownAvailable
  const isDokanDeficit = dokanQty > dokanAvailable

  // Quick Actions:
  // 1. All from Dokan (allows negative stock)
  const handleAllDokan = () => {
    setDokanQty(requested)
    setGodownQty(0)
  }

  // 2. Fulfill deficit from Godown
  const handleFulfillDeficitFromGodown = () => {
    if (dokanAvailable >= requested) {
      setDokanQty(requested)
      setGodownQty(0)
    } else if (dokanAvailable > 0) {
      setDokanQty(dokanAvailable)
      setGodownQty(Number((requested - dokanAvailable).toFixed(3)))
    } else {
      setDokanQty(0)
      setGodownQty(requested)
    }
  }

  // 3. All from Godown
  const handleAllGodown = () => {
    setDokanQty(0)
    setGodownQty(requested)
  }

  const handleApply = () => {
    if (!isSumValid || isGodownOverdrawn) return
    onApplySplit(dokanQty, godownQty)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-frost-border max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-frost-surface border-b border-frost-border flex items-center justify-between">
          <div>
            <h3 className="font-bold text-frost-dark bn-text text-lg">
              স্টক বিভাজন ও ঘাটতি পূরণ
            </h3>
            <p className="text-xs text-frost-muted mt-0.5">
              {item.nameBn} ({item.nameEn}) · লট: #{item.lotNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-frost-muted hover:text-frost-dark text-lg leading-none cursor-pointer p-1 rounded hover:bg-frost-hover transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Stock Availability Overview */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5">
              <span className="text-[11px] font-semibold text-blue-700 bn-text block">
                চাহিদা পরিমাণ
              </span>
              <span className="text-xl font-bold tabular-nums text-blue-950">
                {requested}
              </span>
              <span className="text-[10px] text-blue-600 block bn-text">
                {item.baseUnit}
              </span>
            </div>

            <div
              className={`rounded-xl p-2.5 border ${
                dokanAvailable < requested
                  ? "bg-amber-50/80 border-amber-300"
                  : "bg-emerald-50/70 border-emerald-200"
              }`}
            >
              <span className="text-[11px] font-semibold text-frost-dark bn-text block">
                দোকান স্টক
              </span>
              <span className="text-xl font-bold tabular-nums text-frost-dark">
                {dokanAvailable}
              </span>
              <span className="text-[10px] text-frost-muted block bn-text">
                {item.baseUnit}
              </span>
            </div>

            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-2.5">
              <span className="text-[11px] font-semibold text-purple-700 bn-text block">
                গুদাম স্টক
              </span>
              <span className="text-xl font-bold tabular-nums text-purple-950">
                {godownAvailable}
              </span>
              <span className="text-[10px] text-purple-600 block bn-text">
                {item.baseUnit}
              </span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div>
            <label className="block text-xs font-semibold text-frost-muted bn-text mb-1.5">
              দ্রুত বিভাজন বাটন:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleAllDokan}
                className="px-2 py-2 rounded-lg text-xs font-bold border border-frost-border bg-white hover:bg-frost-surface text-frost-dark bn-text transition-colors text-center cursor-pointer shadow-xs"
              >
                সব দোকান থেকে
              </button>
              <button
                type="button"
                onClick={handleFulfillDeficitFromGodown}
                className="px-2 py-2 rounded-lg text-xs font-bold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 bn-text transition-colors text-center cursor-pointer shadow-xs"
              >
                ঘাটতি গুদাম থেকে
              </button>
              <button
                type="button"
                onClick={handleAllGodown}
                className="px-2 py-2 rounded-lg text-xs font-bold border border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100 bn-text transition-colors text-center cursor-pointer shadow-xs"
              >
                সব গুদাম থেকে
              </button>
            </div>
          </div>

          {/* Manual Numeric Inputs */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-frost-dark bn-text mb-1">
                দোকান কাউন্টার থেকে:
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={dokanQty}
                  onChange={(e) => setDokanQty(parseFloat(e.target.value) || 0)}
                  className="w-full border-2 border-frost-border rounded-xl px-3 py-2 text-lg font-bold tabular-nums focus:border-emerald-600 focus:outline-hidden"
                />
                <span className="absolute right-3 top-2.5 text-xs text-frost-muted pointer-events-none bn-text">
                  {item.baseUnit}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-frost-dark bn-text mb-1">
                গুদাম (Godown) থেকে:
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max={godownAvailable}
                  step="any"
                  value={godownQty}
                  onChange={(e) => setGodownQty(parseFloat(e.target.value) || 0)}
                  className={`w-full border-2 rounded-xl px-3 py-2 text-lg font-bold tabular-nums focus:outline-hidden ${
                    isGodownOverdrawn
                      ? "border-red-500 bg-red-50/50 text-red-700"
                      : "border-frost-border focus:border-emerald-600"
                  }`}
                />
                <span className="absolute right-3 top-2.5 text-xs text-frost-muted pointer-events-none bn-text">
                  {item.baseUnit}
                </span>
              </div>
            </div>
          </div>

          {/* Validation & Status Notices */}
          <div className="space-y-1.5 pt-1">
            {!isSumValid && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-800 bn-text flex items-center justify-between">
                <span>
                  ⚠️ মোট বণ্টন ({currentTotal}) মূল চাহিদার ({requested}) সমান হতে হবে।
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const diff = requested - dokanQty
                    if (diff >= 0) {
                      setGodownQty(Number(diff.toFixed(3)))
                    } else {
                      setDokanQty(requested)
                      setGodownQty(0)
                    }
                  }}
                  className="text-[11px] font-bold text-amber-900 underline cursor-pointer ml-2 shrink-0"
                >
                  ব্যালেন্স ঠিক করুন
                </button>
              </div>
            )}

            {isGodownOverdrawn && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-300 text-xs text-red-700 bn-text">
                ❌ গুদামে পর্যাপ্ত স্টক নেই! গুদাম সর্বোচ্চ মজুদ: {godownAvailable} {item.baseUnit}।
                গুদামে ঋণাত্মক স্টক অনুমোদিত নয়।
              </div>
            )}

            {isDokanDeficit && isSumValid && (
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 bn-text">
                ℹ️ দোকানের বিদ্যমান স্টকের চেয়ে বেশি ({dokanQty} &gt; {dokanAvailable}) বরাদ্দ হচ্ছে।
                কাউন্টার বিক্রির সুবিধার্থে দোকানে ঋণাত্মক ব্যালেন্স অনুমোদিত।
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-frost-surface border-t border-frost-border flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-frost-muted hover:bg-frost-hover transition-colors bn-text cursor-pointer"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!isSumValid || isGodownOverdrawn}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs bn-text cursor-pointer"
          >
            বিভাজন নিশ্চিত করুন
          </button>
        </div>
      </div>
    </div>
  )
}
