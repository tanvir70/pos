import React, { useState, useMemo, useEffect } from "react"
import type { Product, InventoryLot, StockAdjustmentRequest, StockAdjustmentResponse } from "../types"
import { recordStockAdjustment } from "../api/endpoints"
import {
  X,
  AlertTriangle,
  Flame,
  ShieldAlert,
  ClipboardList,
  Layers,
  CheckCircle2,
  Package,
} from "lucide-react"

export interface StockAdjustmentModalProps {
  isOpen: boolean
  products: Product[]
  lots: InventoryLot[]
  initialProductId?: number
  initialLotId?: number
  onClose: () => void
  onSuccess: (adjustment: StockAdjustmentResponse) => void
}

const formatTk = (n: number) =>
  `৳${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ADJUSTMENT_REASONS = [
  {
    type: "BREAKAGE_LEAKAGE",
    label: "Breakage / Bottle Leakage (ভাঙা বা লিক)",
    desc: "Bottle shattered, lid leaked, or pouch torn during transit or counter handling",
    icon: <Flame className="w-4 h-4 text-rose-600" />,
  },
  {
    type: "DAMAGE_SPOILAGE",
    label: "Moisture / Spoilage (নষ্ট বা জমাট)",
    desc: "Powder got moist, caked, or active ingredient coagulated before expiry",
    icon: <ShieldAlert className="w-4 h-4 text-orange-600" />,
  },
  {
    type: "PHYSICAL_AUDIT_VARIANCE",
    label: "Physical Audit Variance (হিসাবের গরমিল)",
    desc: "Discrepancy found during routine stock count / cycle counting",
    icon: <ClipboardList className="w-4 h-4 text-amber-600" />,
  },
  {
    type: "EXPIRED_SCRAP",
    label: "Expired Chemical Scrap (মেয়াদোত্তীর্ণ স্ক্র্যাপ)",
    desc: "Shelf-life expired and lawfully prohibited from sale under Pesticide Ordinance",
    icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
  },
  {
    type: "PROMOTIONAL_SAMPLE",
    label: "Promotional Sample / Farmer Demo (নমুনা প্রদান)",
    desc: "Free demonstration sample distributed to farmer for field trial",
    icon: <Package className="w-4 h-4 text-emerald-600" />,
  },
]

export default function StockAdjustmentModal({
  isOpen,
  products,
  lots,
  initialProductId,
  initialLotId,
  onClose,
  onSuccess,
}: StockAdjustmentModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>(initialProductId)
  const [selectedLotId, setSelectedLotId] = useState<number | undefined>(initialLotId)
  const [adjustmentType, setAdjustmentType] = useState<string>("BREAKAGE_LEAKAGE")
  const [actionType, setActionType] = useState<"SCRAP_DISCARD" | "MOVE_TO_QUARANTINE">("SCRAP_DISCARD")
  const [cartons, setCartons] = useState<string>("")
  const [looseUnits, setLooseUnits] = useState<string>("1")
  const [reason, setReason] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedProductId(initialProductId)
      setSelectedLotId(initialLotId)
      setReason("")
      setErrorMessage(null)
      setCartons("")
      setLooseUnits("1")
    }
  }, [isOpen, initialProductId, initialLotId])

  // Selected Product & Lots
  const currentProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  )

  const productLots = useMemo(
    () => lots.filter((l) => (selectedProductId ? l.productId === selectedProductId : true)),
    [lots, selectedProductId]
  )

  const currentLot = useMemo(() => {
    if (selectedLotId) return productLots.find((l) => l.id === selectedLotId)
    return productLots[0]
  }, [productLots, selectedLotId])

  // Total Quantity Calculation
  const cartonMultiplier = currentProduct?.cartonMultiplier || 1
  const numCartons = parseFloat(cartons) || 0
  const numLoose = parseFloat(looseUnits) || 0
  const totalBaseUnits = numCartons * cartonMultiplier + numLoose

  // Financial Loss Calculation
  const costPrice = currentLot?.purchaseCost || currentProduct?.buyingPrice || 0
  const totalLossValue = totalBaseUnits * costPrice

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!selectedProductId) {
      setErrorMessage("Please select a product.")
      return
    }
    if (!currentLot) {
      setErrorMessage("Please select an active lot.")
      return
    }
    if (totalBaseUnits <= 0) {
      setErrorMessage("Adjustment quantity must be greater than zero.")
      return
    }
    if (!reason.trim()) {
      setErrorMessage("Please specify the reason or inspection details.")
      return
    }

    try {
      setIsSubmitting(true)
      const payload: StockAdjustmentRequest = {
        productId: selectedProductId,
        lotId: currentLot.id,
        adjustmentType,
        quantity: totalBaseUnits,
        actionType,
        reason: reason.trim(),
        performedBy: "Store Owner",
      }

      const response = await recordStockAdjustment(payload)
      onSuccess(response)
      onClose()
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to record stock adjustment.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Stock Adjustment & Damage Write-Off
              </h2>
              <p className="text-xs text-slate-500">
                Reconcile physical variance, bottle leakage, or safe quarantine isolation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Product Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Product *
              </label>
              <select
                value={selectedProductId || ""}
                onChange={(e) => {
                  const val = Number(e.target.value) || undefined
                  setSelectedProductId(val)
                  setSelectedLotId(undefined)
                }}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-emerald-500"
                required
              >
                <option value="">-- Select Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameEn} ({p.productCode})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Lot Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Batch / Lot *
              </label>
              <select
                value={selectedLotId || currentLot?.id || ""}
                onChange={(e) => setSelectedLotId(Number(e.target.value))}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                required
                disabled={!selectedProductId}
              >
                {productLots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lotNumber || "DEFAULT"} (Exp: {l.expiryDate} • Cost: {formatTk(l.purchaseCost)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Reason Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Adjustment Reason *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ADJUSTMENT_REASONS.map((r) => {
                const isSelected = adjustmentType === r.type
                return (
                  <button
                    key={r.type}
                    type="button"
                    onClick={() => setAdjustmentType(r.type)}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{r.icon}</div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold ${isSelected ? "text-white" : "text-slate-900"}`}>
                        {r.label}
                      </p>
                      <p className={`text-[10px] mt-0.5 line-clamp-2 ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                        {r.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 4. Action Choice */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Inventory Disposition Action *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  actionType === "SCRAP_DISCARD"
                    ? "bg-rose-50 border-rose-300 text-rose-950 font-bold"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                }`}
              >
                <input
                  type="radio"
                  name="actionType"
                  value="SCRAP_DISCARD"
                  checked={actionType === "SCRAP_DISCARD"}
                  onChange={() => setActionType("SCRAP_DISCARD")}
                  className="accent-rose-600"
                />
                <div>
                  <p className="text-xs">Direct Disposal / Scrap</p>
                  <p className="text-[10px] text-slate-500 font-normal">Permanently write off stock</p>
                </div>
              </label>

              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  actionType === "MOVE_TO_QUARANTINE"
                    ? "bg-amber-50 border-amber-300 text-amber-950 font-bold"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                }`}
              >
                <input
                  type="radio"
                  name="actionType"
                  value="MOVE_TO_QUARANTINE"
                  checked={actionType === "MOVE_TO_QUARANTINE"}
                  onChange={() => setActionType("MOVE_TO_QUARANTINE")}
                  className="accent-amber-600"
                />
                <div>
                  <p className="text-xs">Move to Quarantine</p>
                  <p className="text-[10px] text-slate-500 font-normal">Hold for hazardous disposal</p>
                </div>
              </label>
            </div>
          </div>

          {/* 5. Quantity & Conversion */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Quantity to Deduct *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 font-medium mb-1 block">
                  Cartons ({cartonMultiplier} {currentProduct?.baseUnit || "units"}/ctn)
                </span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={cartons}
                  onChange={(e) => setCartons(e.target.value)}
                  placeholder="0"
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-medium mb-1 block">
                  Loose {currentProduct?.baseUnit || "Units"}
                </span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={looseUnits}
                  onChange={(e) => setLooseUnits(e.target.value)}
                  placeholder="0"
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Live Financial Calculation Box */}
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">
                  Total Deducted:{" "}
                  <strong className="text-slate-900">
                    {totalBaseUnits} {currentProduct?.baseUnit || "units"}
                  </strong>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Calculated Loss Value:</span>
                <span className="font-bold text-rose-600 text-sm tabular-nums">
                  {formatTk(totalLossValue)}
                </span>
              </div>
            </div>
          </div>

          {/* 6. Remarks / Reason Details */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason / Inspection Notes *
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., 1 bottle cracked during shelf cleaning; lid shattered; safely neutralized"
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {/* Submit Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Recording..." : "Record Adjustment"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
