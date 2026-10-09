import React, { useState, useMemo, useEffect, useRef } from "react"
import type { Product, InventoryLot, StockAdjustmentRequest, StockAdjustmentResponse } from "../types"
import { recordStockAdjustment } from "../api/endpoints"
import { formatLotNumber } from "../utils/lotNumber"
import { getEffectiveMultiplier } from "../utils/unit"
import {
  X,
  AlertTriangle,
  Flame,
  ShieldAlert,
  ClipboardList,
  Layers,
  CheckCircle2,
  Package,
  Search,
  Lock,
} from "lucide-react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select"

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
    titleEn: "Breakage / Leakage",
    titleBn: "ভাঙা বা লিক",
    label: "Breakage / Bottle Leakage (ভাঙা বা লিক)",
    desc: "Bottle shattered, lid leaked, or pouch torn during transit or counter handling",
    icon: Flame,
  },
  {
    type: "DAMAGE_SPOILAGE",
    titleEn: "Moisture / Spoilage",
    titleBn: "নষ্ট বা জমাট",
    label: "Moisture / Spoilage (নষ্ট বা জমাট)",
    desc: "Powder got moist, caked, or active ingredient coagulated before expiry",
    icon: ShieldAlert,
  },
  {
    type: "PHYSICAL_AUDIT_VARIANCE",
    titleEn: "Physical Audit Variance",
    titleBn: "হিসাবের গরমিল",
    label: "Physical Audit Variance (হিসাবের গরমিল)",
    desc: "Discrepancy found during routine stock count / cycle counting",
    icon: ClipboardList,
  },
  {
    type: "EXPIRED_SCRAP",
    titleEn: "Expired Chemical Scrap",
    titleBn: "মেয়াদোত্তীর্ণ স্ক্র্যাপ",
    label: "Expired Chemical Scrap (মেয়াদোত্তীর্ণ স্ক্র্যাপ)",
    desc: "Shelf-life expired and lawfully prohibited from sale under Pesticide Ordinance",
    icon: AlertTriangle,
  },
  {
    type: "PROMOTIONAL_SAMPLE",
    titleEn: "Promotional / Farmer Demo",
    titleBn: "নমুনা প্রদান",
    label: "Promotional Sample / Farmer Demo (নমুনা প্রদান)",
    desc: "Free demonstration sample distributed to farmer for field trial",
    icon: Package,
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
  const [cartonMultiplier, setCartonMultiplier] = useState<string>("20")
  const [cartons, setCartons] = useState<string>("")
  const [looseUnits, setLooseUnits] = useState<string>("1")
  const [reason, setReason] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [productSearchQuery, setProductSearchQuery] = useState<string>("")
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState<boolean>(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedProductId(initialProductId)
      const availLots = lots.filter((l) => (initialProductId ? l.productId === initialProductId : true))
      const resolvedLot = initialLotId
        ? availLots.find((l) => l.id === initialLotId)
        : availLots[0]
      setSelectedLotId(resolvedLot?.id)
      setReason("")
      setErrorMessage(null)
      setCartons("")
      setLooseUnits("1")
      setProductSearchQuery("")
      setIsProductDropdownOpen(false)

      const prod = products.find((p) => p.id === initialProductId)
      if (resolvedLot || prod) {
        const detected =
          getEffectiveMultiplier(
            resolvedLot?.cartonMultiplier ?? prod?.cartonMultiplier,
            resolvedLot?.packSize || prod?.packSize,
            resolvedLot?.unitSize || prod?.unitSize,
          ) || 20
        setCartonMultiplier(String(detected))
      } else {
        setCartonMultiplier("20")
      }
    }
  }, [isOpen, initialProductId, initialLotId, lots, products])

  // Click outside search container to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsProductDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

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

  // Auto-detect carton multiplier when selected lot or product changes
  useEffect(() => {
    if (currentLot || currentProduct) {
      const lotMultiplier = currentLot?.cartonMultiplier
      const productMultiplier = currentProduct?.cartonMultiplier
      const packStr = currentLot?.packSize || currentProduct?.packSize
      const unitStr = currentLot?.unitSize || currentProduct?.unitSize

      const detected =
        getEffectiveMultiplier(
          lotMultiplier ?? productMultiplier,
          packStr,
          unitStr,
        ) || 20
      setCartonMultiplier(String(detected))
    } else {
      setCartonMultiplier("20")
    }
  }, [currentLot, currentProduct])

  // Clear product and refresh all associated fields
  const handleClearProduct = () => {
    setSelectedProductId(undefined)
    setSelectedLotId(undefined)
    setCartons("")
    setLooseUnits("1")
    setCartonMultiplier("20")
    setReason("")
    setErrorMessage(null)
    setProductSearchQuery("")
    setIsProductDropdownOpen(true)
  }

  // Select product and reset quantities/errors
  const handleSelectProduct = (p: Product) => {
    const availLots = lots.filter((l) => l.productId === p.id)
    const initialLot = availLots[0]
    setSelectedProductId(p.id)
    setSelectedLotId(initialLot?.id)
    setCartons("")
    setLooseUnits("1")
    setReason("")
    setErrorMessage(null)
    setProductSearchQuery("")
    setIsProductDropdownOpen(false)

    const detected =
      getEffectiveMultiplier(
        initialLot?.cartonMultiplier ?? p.cartonMultiplier,
        initialLot?.packSize || p.packSize,
        initialLot?.unitSize || p.unitSize,
      ) || 20
    setCartonMultiplier(String(detected))
  }

  // Filtered products for search
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return products.slice(0, 60)
    const q = productSearchQuery.toLowerCase().trim()
    return products.filter((p) =>
      (p.nameEn || "").toLowerCase().includes(q) ||
      (p.nameBn || "").toLowerCase().includes(q) ||
      (p.productCode || "").toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q)
    ).slice(0, 60)
  }, [products, productSearchQuery])

  // Total Quantity Calculation with flexible Carton Multiplier
  const multiplierNum = Math.max(1, parseFloat(cartonMultiplier) || 1)
  const numCartons = parseFloat(cartons) || 0
  const numLoose = parseFloat(looseUnits) || 0
  const totalBaseUnits = numCartons * multiplierNum + numLoose

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
        actionType: "SCRAP_DISCARD",
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
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-amber-200/90 dark:border-amber-900/60 bg-gradient-to-r from-amber-100/90 via-amber-50 to-orange-50/70 dark:from-amber-950/75 dark:via-amber-950/50 dark:to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/60 flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5 text-amber-800 dark:text-amber-300 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Stock Adjustment &amp; Damage Write-Off
                </h2>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/60 shadow-2xs">
                  Inventory Scrap
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Reconcile physical variance, bottle leakage, or quarantine stock write-off
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-rose-950/60 border border-red-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-red-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Product Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Product *
              </label>

              {currentProduct ? (
                /* Selected Product Card with Clear / Cross (X) Button */
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {currentProduct.nameEn}
                        </span>
                        <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                          #{currentProduct.productCode}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {currentProduct.category} • {currentProduct.packSize || currentProduct.unitSize || currentProduct.baseUnit}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearProduct}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer shrink-0"
                    title="Clear product and refresh all info"
                    aria-label="Clear product selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* Searchable Product Input with Dropdown */
                <div className="relative" ref={searchContainerRef}>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value)
                        setIsProductDropdownOpen(true)
                      }}
                      onFocus={() => setIsProductDropdownOpen(true)}
                      placeholder="Search product by name or code..."
                      className="w-full text-xs font-medium pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    {productSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setProductSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                        aria-label="Clear search query"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {isProductDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredProducts.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
                          No products found matching &ldquo;{productSearchQuery}&rdquo;
                        </div>
                      ) : (
                        filteredProducts.map((p) => {
                          const availLots = lots.filter((l) => l.productId === p.id)
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectProduct(p)}
                              className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {p.nameEn}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-medium">#{p.productCode}</span>
                                  <span>•</span>
                                  <span>{p.category}</span>
                                  {p.packSize && (
                                    <>
                                      <span>•</span>
                                      <span>{p.packSize}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {availLots.length} {availLots.length === 1 ? "lot" : "lots"}
                                </span>
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Lot Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Batch / Lot *
              </label>
              <Select
                value={selectedLotId ? String(selectedLotId) : (currentLot?.id ? String(currentLot.id) : "")}
                onValueChange={(val) => {
                  const idNum = Number(val)
                  setSelectedLotId(idNum)
                  const targetLot = productLots.find((l) => l.id === idNum)
                  if (targetLot) {
                    const detected =
                      getEffectiveMultiplier(
                        targetLot.cartonMultiplier ?? currentProduct?.cartonMultiplier,
                        targetLot.packSize || currentProduct?.packSize,
                        targetLot.unitSize || currentProduct?.unitSize,
                      ) || 20
                    setCartonMultiplier(String(detected))
                  }
                }}
                disabled={!selectedProductId || productLots.length === 0}
              >
                <SelectTrigger className="w-full bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 font-mono">
                  <SelectValue placeholder="-- Select Batch / Lot --" />
                </SelectTrigger>
                <SelectContent>
                  {productLots.map((l) => {
                    const multNum = l.cartonMultiplier != null ? Number(l.cartonMultiplier) : null
                    const unitLabel = currentProduct?.baseUnit ? `${currentProduct.baseUnit}/ctn` : "pcs/ctn"
                    return (
                      <SelectItem key={l.id} value={String(l.id)} className="font-mono">
                        {formatLotNumber(l.lotNumber)} (Exp: {l.expiryDate} • Cost: {formatTk(l.purchaseCost)}{multNum ? ` • ${multNum} ${unitLabel}` : ""})
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 3. Reason Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Adjustment Reason *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ADJUSTMENT_REASONS.map((r) => {
                const isSelected = adjustmentType === r.type
                const IconComponent = r.icon
                return (
                  <button
                    key={r.type}
                    type="button"
                    onClick={() => setAdjustmentType(r.type)}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 dark:bg-emerald-600 border-slate-900 dark:border-emerald-600 text-white shadow-sm ring-1 ring-slate-900/10 dark:ring-emerald-500/20"
                        : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        isSelected
                          ? "bg-white/15 text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span
                          className={`text-xs font-bold leading-snug tracking-tight ${
                            isSelected ? "text-white" : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {r.titleEn}
                        </span>
                        <span
                          className={`text-[11px] font-medium leading-snug font-bangla ${
                            isSelected
                              ? "text-slate-300 dark:text-emerald-100"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          ({r.titleBn})
                        </span>
                      </div>
                      <p
                        className={`text-[11px] leading-relaxed mt-1 line-clamp-2 ${
                          isSelected
                            ? "text-slate-300 dark:text-emerald-100"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {r.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 4. Quantity & Conversion */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Quantity to Deduct *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 dark:text-slate-400 font-bold mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Carton Multiplier</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {currentProduct?.baseUnit || "pcs"}/ctn
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    readOnly
                    tabIndex={-1}
                    value={cartonMultiplier}
                    placeholder="20"
                    className="w-full text-xs font-bold font-mono px-3 py-2 pr-8 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/90 text-slate-700 dark:text-slate-300 cursor-not-allowed select-none focus:outline-none"
                    title={
                      currentLot?.cartonMultiplier
                        ? `Carton multiplier is locked to Lot #${currentLot.lotNumber} packaging ratio`
                        : "Carton multiplier is locked to product master definition"
                    }
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                  {currentLot?.cartonMultiplier
                    ? `Lot #${currentLot.lotNumber} ratio (locked)`
                    : "Product master default (locked)"}
                </span>
              </div>

              <div>
                <label className="text-[11px] text-slate-600 dark:text-slate-400 font-bold mb-1 flex items-center justify-between">
                  <span>Cartons</span>
                  <span className="text-[10px] text-slate-400 font-normal">boxes</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={cartons}
                  onChange={(e) => setCartons(e.target.value)}
                  placeholder="0"
                  className="w-full text-xs font-semibold font-mono px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 dark:text-slate-400 font-bold mb-1 flex items-center justify-between">
                  <span>Loose {currentProduct?.baseUnit || "Units"}</span>
                  <span className="text-[10px] text-slate-400 font-normal">pieces</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={looseUnits}
                  onChange={(e) => setLooseUnits(e.target.value)}
                  placeholder="0"
                  className="w-full text-xs font-semibold font-mono px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Live Financial Calculation Box */}
            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-slate-600 dark:text-slate-300">
                  Total Deducted:{" "}
                  <strong className="text-slate-900 dark:text-slate-100 font-mono text-sm">
                    {totalBaseUnits} {currentProduct?.baseUnit || "units"}
                  </strong>
                  {numCartons > 0 && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1.5 font-mono">
                      ({numCartons} ctn × {multiplierNum}{numLoose > 0 ? ` + ${numLoose} loose` : ""})
                    </span>
                  )}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Calculated Loss Value:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 text-sm tabular-nums">
                  {formatTk(totalLossValue)}
                </span>
              </div>
            </div>
          </div>

          {/* 6. Remarks / Reason Details */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Reason / Inspection Notes *
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., 1 bottle cracked during shelf cleaning; lid shattered; safely neutralized"
              className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {/* Submit Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
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
