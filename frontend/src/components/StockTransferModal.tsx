import { useState, useEffect, useId } from "react"
import type { StockItem, StockTransferRequest } from "../types"
import { transferStock } from "../api/endpoints"

// BUSINESS DECISION: Stock transfers strictly pre-validate source location balance.
// 1-click Max fill button prevents typographical transfer errors during rush hours.
// Godown transfers strictly prevent negative balances while updating movement audit logs.

export interface StockTransferModalProps {
  stockItems: StockItem[]
  initialLotId?: number
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function StockTransferModal({
  stockItems,
  initialLotId,
  isOpen,
  onClose,
  onSuccess,
}: StockTransferModalProps) {
  const lotSelectId = useId()
  const transferQtyId = useId()
  const remarksId = useId()

  const [selectedLotId, setSelectedLotId] = useState<number | "">("")
  const [direction, setDirection] = useState<"GODOWN_TO_DOKAN" | "DOKAN_TO_GODOWN">(
    "GODOWN_TO_DOKAN",
  )
  const [quantity, setQuantity] = useState<string>("")
  const [remarks, setRemarks] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Pre-select initial lot when opened
  useEffect(() => {
    if (initialLotId) {
      setSelectedLotId(initialLotId)
    } else if (stockItems.length > 0 && selectedLotId === "") {
      setSelectedLotId(stockItems[0].lotId)
    }
  }, [initialLotId, stockItems, selectedLotId, isOpen])

  const selectedItem = stockItems.find((s) => s.lotId === selectedLotId)

  const fromLocation = direction === "GODOWN_TO_DOKAN" ? "GODOWN" : "DOKAN"
  const toLocation = direction === "GODOWN_TO_DOKAN" ? "DOKAN" : "GODOWN"

  const availableSourceStock = selectedItem
    ? fromLocation === "GODOWN"
      ? Number(selectedItem.godownQuantity) || 0
      : Number(selectedItem.dokanQuantity) || 0
    : 0

  const handleMaxClick = () => {
    if (availableSourceStock > 0) {
      setQuantity(String(availableSourceStock))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!selectedLotId) {
      setErrorMessage("অনুগ্রহ করে একটি লট নির্বাচন করুন")
      return
    }

    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      setErrorMessage("স্থানান্তরের পরিমাণ অবশ্যই ০ এর বেশি হতে হবে")
      return
    }

    if (qty > availableSourceStock) {
      setErrorMessage(
        `${fromLocation === "GODOWN" ? "গুদামে" : "দোকানে"} পর্যাপ্ত স্টক নেই (বর্তমান উপলব্ধ: ${availableSourceStock})`,
      )
      return
    }

    try {
      setIsSubmitting(true)
      const request: StockTransferRequest = {
        lotId: Number(selectedLotId),
        fromLocation,
        toLocation,
        quantity: qty,
        remarks: remarks.trim() || undefined,
      }

      await transferStock(request)
      setQuantity("")
      setRemarks("")
      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMessage(
        err?.message || "স্টক স্থানান্তরে ত্রুটি হয়েছে। পুনরায় চেষ্টা করুন।",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-frost-border max-w-lg w-full my-auto overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-800 to-indigo-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🔄</span>
            <div>
              <h2 className="font-bold text-lg bn-text leading-tight">
                স্টক স্থানান্তর (Stock Transfer)
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                গুদাম ও দোকান কাউন্টারের মধ্যে নিরাপদ ব্যালেন্স স্থানান্তর
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="text-white/80 hover:text-white text-xl leading-none cursor-pointer p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold bn-text flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Transfer Direction Toggle */}
          <div>
            <label className="block text-xs font-bold text-frost-dark bn-text mb-1.5">
              স্থানান্তরের দিক (Transfer Direction)
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-frost-surface rounded-xl border border-frost-border">
              <button
                type="button"
                onClick={() => {
                  setDirection("GODOWN_TO_DOKAN")
                  setQuantity("")
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer bn-text ${
                  direction === "GODOWN_TO_DOKAN"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-frost-muted hover:text-frost-dark hover:bg-white/60"
                }`}
              >
                <span>🏭 গুদাম</span>
                <span>➔</span>
                <span>🏪 দোকান</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirection("DOKAN_TO_GODOWN")
                  setQuantity("")
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer bn-text ${
                  direction === "DOKAN_TO_GODOWN"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-frost-muted hover:text-frost-dark hover:bg-white/60"
                }`}
              >
                <span>🏪 দোকান</span>
                <span>➔</span>
                <span>🏭 গুদাম</span>
              </button>
            </div>
          </div>

          {/* Lot Selector */}
          <div>
            <label
              htmlFor={lotSelectId}
              className="block text-xs font-bold text-frost-dark bn-text mb-1.5"
            >
              লট নির্বাচন করুন (Select Lot) *
            </label>
            <select
              id={lotSelectId}
              value={selectedLotId}
              onChange={(e) => {
                setSelectedLotId(e.target.value ? Number(e.target.value) : "")
                setQuantity("")
              }}
              required
              className="w-full bg-white border-2 border-frost-border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-frost-dark focus:border-blue-600 focus:outline-hidden transition-all bn-text cursor-pointer"
            >
              <option value="">-- লট বেছে নিন --</option>
              {stockItems.map((item) => (
                <option key={item.lotId} value={item.lotId}>
                  {item.productNameBn || item.nameBn} ({item.lotNumber}) — গুদাম:{" "}
                  {item.godownQuantity} | দোকান: {item.dokanQuantity}{" "}
                  {item.baseUnit}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Lot Balances Card */}
          {selectedItem && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 bn-text">
                  {selectedItem.productNameBn || selectedItem.nameBn}
                </span>
                <span className="text-xs font-mono font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                  {selectedItem.lotNumber}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div
                  className={`p-2.5 rounded-lg border text-center ${
                    fromLocation === "GODOWN"
                      ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400/30"
                      : "bg-white border-frost-border"
                  }`}
                >
                  <p className="text-[11px] text-frost-muted bn-text">
                    🏭 গুদাম বর্তমান স্টক
                  </p>
                  <p className="text-base font-black text-frost-dark tabular-nums mt-0.5">
                    {selectedItem.godownQuantity}{" "}
                    <span className="text-xs font-normal">
                      {selectedItem.baseUnit}
                    </span>
                  </p>
                  {selectedItem.cartonMultiplier > 1 && (
                    <p className="text-[10px] text-frost-muted mt-0.5 bn-text">
                      (
                      {Math.floor(
                        selectedItem.godownQuantity /
                          selectedItem.cartonMultiplier,
                      )}{" "}
                      কার্টন +{" "}
                      {selectedItem.godownQuantity %
                        selectedItem.cartonMultiplier}
                      )
                    </p>
                  )}
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-center ${
                    fromLocation === "DOKAN"
                      ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400/30"
                      : "bg-white border-frost-border"
                  }`}
                >
                  <p className="text-[11px] text-frost-muted bn-text">
                    🏪 দোকান বর্তমান স্টক
                  </p>
                  <p className="text-base font-black text-frost-dark tabular-nums mt-0.5">
                    {selectedItem.dokanQuantity}{" "}
                    <span className="text-xs font-normal">
                      {selectedItem.baseUnit}
                    </span>
                  </p>
                  {selectedItem.cartonMultiplier > 1 && (
                    <p className="text-[10px] text-frost-muted mt-0.5 bn-text">
                      (
                      {Math.floor(
                        selectedItem.dokanQuantity /
                          selectedItem.cartonMultiplier,
                      )}{" "}
                      কার্টন +{" "}
                      {selectedItem.dokanQuantity %
                        selectedItem.cartonMultiplier}
                      )
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Transfer Quantity Input with MAX Button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor={transferQtyId}
                className="text-xs font-bold text-frost-dark bn-text"
              >
                স্থানান্তরের পরিমাণ (Quantity) *
              </label>
              <span className="text-xs text-frost-muted bn-text">
                উৎস ব্যালেন্স:{" "}
                <strong className="text-blue-700 font-mono">
                  {availableSourceStock} {selectedItem?.baseUnit || "ইউনিট"}
                </strong>
              </span>
            </div>

            <div className="relative flex items-center">
              <input
                id={transferQtyId}
                type="number"
                min="0.001"
                max={availableSourceStock}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="০.০০"
                required
                className="w-full bg-white border-2 border-frost-border rounded-xl px-3.5 py-2.5 pr-20 text-lg font-black text-frost-dark focus:border-blue-600 focus:outline-hidden tabular-nums"
              />
              <button
                type="button"
                onClick={handleMaxClick}
                disabled={availableSourceStock <= 0}
                className="absolute right-2 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bn-text"
              >
                সর্বোচ্চ (Max)
              </button>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label
              htmlFor={remarksId}
              className="block text-xs font-bold text-frost-dark bn-text mb-1"
            >
              মন্তব্য / কারণ (Remarks - ঐচ্ছিক)
            </label>
            <input
              id={remarksId}
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="যেমন: কাউন্টার সেলফ রিস্টক / অতিরিক্ত ব্যালেন্স ফেরত"
              className="w-full bg-white border border-frost-border rounded-xl px-3 py-2 text-xs text-frost-dark focus:border-blue-600 focus:outline-hidden bn-text"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-frost-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-frost-muted hover:bg-frost-hover cursor-pointer bn-text transition-colors"
            >
              বাতিল (Cancel)
            </button>
            <button
              type="submit"
              disabled={isSubmitting || availableSourceStock <= 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40 cursor-pointer bn-text transition-colors shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>স্থানান্তর হচ্ছে...</span>
                </>
              ) : (
                <>
                  <span>➔</span>
                  <span>স্থানান্তর নিশ্চিত করুন (Transfer)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
