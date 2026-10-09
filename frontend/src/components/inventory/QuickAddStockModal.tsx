import React, { useState, useEffect, useRef } from "react"
import type { GroupedProduct } from "../../types"
import { createLot } from "../../api/endpoints"
import { getNextLotNumber } from "../../utils/lotNumber"
import { useToast } from "../../context/ToastContext"
import Modal from "../ui/Modal"
import Input from "../ui/Input"
import Button from "../ui/Button"
import {
  parsePackSize,
  isDiscreteUnit,
  extractCartonMultiplier,
  getEffectiveMultiplier,
  pluralizeUnit,
  getPackagingUnit,
} from "../../utils/unit"
import {
  Package,
  TrendingUp,
  Layers,
  Warehouse,
  Box,
  Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface StockModalProduct {
  productId: number
  productCode?: string
  nameEn: string
  nameBn?: string | null
  baseUnit: string
  packSize?: string | null
  unitSize?: string | null
  cartonMultiplier?: number
  retailPrice: number
  wholesalePrice: number
  buyingPrice: number
}

export interface QuickAddStockModalProps {
  product: StockModalProduct | null
  groupedProducts: GroupedProduct[]
  onClose: () => void
  onSuccess: () => void
}

export default function QuickAddStockModal({
  product,
  groupedProducts,
  onClose,
  onSuccess,
}: QuickAddStockModalProps) {
  const { showSuccess, showError, showWarning, showToast, dismissToast } = useToast()
  const confirmToastIdRef = useRef<string | null>(null)

  const [hasCartons, setHasCartons] = useState<boolean>(true)
  const [cartonMultiplier, setCartonMultiplier] = useState<string>("20")
  const [initialCartonMultiplier, setInitialCartonMultiplier] = useState<number>(20)
  const [saveAsDefaultCarton, setSaveAsDefaultCarton] = useState<boolean>(false)
  const [addStockQty, setAddStockQty] = useState("")
  const [cartons, setCartons] = useState("")
  const [loose, setLoose] = useState("")
  const [addStockBuying, setAddStockBuying] = useState("")
  const [addStockRetail, setAddStockRetail] = useState("")
  const [addStockWholesale, setAddStockWholesale] = useState("")
  const [addStockLotNumber, setAddStockLotNumber] = useState("")
  const [addStockExpiry, setAddStockExpiry] = useState("")
  const [addStockSupplier, setAddStockSupplier] = useState("")
  const [addStockChallan, setAddStockChallan] = useState("")
  const [isAddingStock, setIsAddingStock] = useState(false)

  const matched = groupedProducts.find((p) => p.productId === product?.productId)

  useEffect(() => {
    if (product) {
      const m = groupedProducts.find((p) => p.productId === product.productId)
      const detectedMultiplier =
        getEffectiveMultiplier(
          product.cartonMultiplier || m?.cartonMultiplier,
          product.packSize || m?.packSize,
          product.unitSize || m?.unitSize,
        ) || 20

      setCartonMultiplier(String(detectedMultiplier))
      setInitialCartonMultiplier(detectedMultiplier)
      setSaveAsDefaultCarton(false)
      setHasCartons(true)
      setAddStockQty("")
      setCartons("")
      setLoose("")
      setAddStockBuying(product.buyingPrice ? String(product.buyingPrice) : "")
      setAddStockRetail(product.retailPrice ? String(product.retailPrice) : "")
      setAddStockWholesale(product.wholesalePrice ? String(product.wholesalePrice) : "")
      setAddStockLotNumber(getNextLotNumber(m?.lots))
      setAddStockExpiry(
        new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      )
      setAddStockSupplier("Syngenta Bangladesh Limited")
      setAddStockChallan(`CH-${Date.now().toString().slice(-6)}`)
    }
  }, [product, groupedProducts])

  useEffect(() => {
    return () => {
      if (confirmToastIdRef.current) {
        dismissToast(confirmToastIdRef.current)
        confirmToastIdRef.current = null
      }
    }
  }, [dismissToast])

  if (!product) return null

  const multiplierNum = Math.max(1, parseFloat(cartonMultiplier) || 1)
  const isMultiplierChanged = Math.abs(multiplierNum - initialCartonMultiplier) > 0.001
  const effectivePackStr = product.packSize || product.unitSize || matched?.packSize || matched?.unitSize
  const parsedPack = parsePackSize(effectivePackStr, product.baseUnit)
  const countUnit = getPackagingUnit(product.baseUnit, effectivePackStr)

  // ─── Reactive Quantity Handlers ───
  const handleMultiplierChange = (val: string) => {
    setCartonMultiplier(val)
    const m = Math.max(1, parseFloat(val) || 1)
    const c = parseFloat(cartons) || 0
    const l = parseFloat(loose) || 0
    const total = c * m + l
    setAddStockQty(total > 0 ? String(total) : "")

    // Reset default-carton choice if reverted back to initial multiplier
    if (Math.abs(m - initialCartonMultiplier) <= 0.001) {
      setSaveAsDefaultCarton(false)
    }
  }

  const handleCartonsChange = (val: string) => {
    setCartons(val)
    const c = parseFloat(val) || 0
    const l = parseFloat(loose) || 0
    const total = c * multiplierNum + l
    setAddStockQty(total > 0 ? String(total) : "")
  }

  const handleLooseChange = (val: string) => {
    setLoose(val)
    const c = parseFloat(cartons) || 0
    const l = parseFloat(val) || 0
    const total = c * multiplierNum + l
    setAddStockQty(total > 0 ? String(total) : "")
  }

  const handleQtyChange = (val: string) => {
    setAddStockQty(val)
    const total = parseFloat(val) || 0
    if (hasCartons && multiplierNum > 1) {
      const c = Math.floor(total / multiplierNum)
      const l = Math.round((total % multiplierNum) * 1000) / 1000
      setCartons(c > 0 ? String(c) : "")
      setLoose(l > 0 ? String(l) : "")
    } else {
      setCartons("")
      setLoose(total > 0 ? String(total) : "")
    }
  }

  const handleTogglePackaging = (cartonMode: boolean) => {
    setHasCartons(cartonMode)
    if (!cartonMode) {
      setCartons("")
      setLoose(addStockQty)
    } else {
      const total = parseFloat(addStockQty) || 0
      if (multiplierNum > 1 && total > 0) {
        const c = Math.floor(total / multiplierNum)
        const l = Math.round((total % multiplierNum) * 1000) / 1000
        setCartons(c > 0 ? String(c) : "")
        setLoose(l > 0 ? String(l) : "")
      }
    }
  }

  // Margin Calculation
  const retailNum = parseFloat(addStockRetail) || 0
  const buyingNum = parseFloat(addStockBuying) || 0
  const wholesaleNum = parseFloat(addStockWholesale) || 0
  const totalQtyNum = parseFloat(addStockQty) || 0

  const calculateMargin = (selling: number, cost: number) => {
    if (selling <= 0 || cost <= 0) return null
    const diff = selling - cost
    const pct = ((diff / selling) * 100).toFixed(1)
    const isPositive = diff >= 0
    return {
      profit: diff.toFixed(2),
      pct: `${isPositive ? "+" : ""}${pct}%`,
      isPositive,
    }
  }

  const retailMargin = calculateMargin(retailNum, buyingNum)

  const handleClose = () => {
    if (confirmToastIdRef.current) {
      dismissToast(confirmToastIdRef.current)
      confirmToastIdRef.current = null
    }
    setAddStockQty("")
    setCartons("")
    setLoose("")
    setAddStockBuying("")
    setAddStockRetail("")
    setAddStockWholesale("")
    setAddStockLotNumber("")
    setAddStockExpiry("")
    setAddStockSupplier("")
    setAddStockChallan("")
    setSaveAsDefaultCarton(false)
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const qty = Math.max(0, parseFloat(addStockQty) || 0)
    if (qty <= 0) {
      showWarning("Please enter a valid stock quantity")
      return
    }

    const retail = Math.max(0, parseFloat(addStockRetail) || product.retailPrice || 0)
    const wholesale = Math.max(0, parseFloat(addStockWholesale) || product.wholesalePrice || retail)

    if (retail <= 0) {
      showWarning("Please enter a valid retail price")
      return
    }

    if (wholesale <= 0) {
      showWarning("Please enter a valid wholesale price")
      return
    }

    const today = new Date().toISOString().split("T")[0]
    const expiryDate =
      addStockExpiry ||
      new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

    if (expiryDate < today) {
      showWarning("Expiry date cannot be in the past.")
      return
    }

    const buying = Math.max(0, parseFloat(addStockBuying) || product.buyingPrice || 0)
    const m = groupedProducts.find((p) => p.productId === product.productId)
    const defaultLot = getNextLotNumber(m?.lots)
    const lotNumber = addStockLotNumber.trim() || defaultLot
    const challanNo = addStockChallan.trim() || `CH-${Date.now().toString().slice(-6)}`
    const cleanCode =
      (m?.productCode || product.productCode || "").replace(/[^A-Za-z0-9]/g, "") ||
      String(product.productId)
    const cleanLot = lotNumber.replace(/^LOT-?/i, "") || "01"
    const lotBarcode = `${cleanCode}-${cleanLot}`

    const unitLabel = qty === 1 ? countUnit.singular : countUnit.plural
    const cartonBreakdown =
      hasCartons && parseFloat(cartons) > 0
        ? `${cartons} ctn${parseFloat(loose) > 0 ? ` + ${loose} loose` : ""}`
        : ""
    const cartonUpdateNotice =
      hasCartons && isMultiplierChanged && saveAsDefaultCarton
        ? `Default carton set to ${multiplierNum} ${countUnit.singular || "pcs"}`
        : ""

    // Dismiss previous confirmation toast if active
    if (confirmToastIdRef.current) {
      dismissToast(confirmToastIdRef.current)
      confirmToastIdRef.current = null
    }

    const bengaliName = product.nameBn || matched?.nameBn

    const toastId = showToast({
      type: "success",
      title: "Confirm Stock Inwarding",
      presentation: "confirmation",
      duration: 0,
      closePrevious: true,
      message: (
        <div className="space-y-3">
          {/* Product Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">
                {product.nameEn}
              </div>
              {bengaliName && bengaliName !== product.nameEn && (
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bangla mt-0.5">
                  {bengaliName}
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 font-mono whitespace-nowrap shadow-2xs">
                +{qty} {unitLabel}
              </span>
              {cartonBreakdown && (
                <div className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap">
                  ({cartonBreakdown})
                </div>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <div className="space-y-0.5">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Lot Number
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                #{lotNumber}
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Retail MRP
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                ৳{retail.toFixed(2)}
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Expiry Date
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                {expiryDate}
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Carton Multiplier
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                {multiplierNum} {countUnit.singular || "pcs"}/ctn
              </span>
            </div>
          </div>

          {cartonUpdateNotice && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <span className="text-base leading-none">⚠️</span>
              <span>{cartonUpdateNotice}</span>
            </div>
          )}
        </div>
      ),
      actions: [
        {
          label: "Cancel",
          intent: "default",
          onClick: () => {
            dismissToast(toastId)
            confirmToastIdRef.current = null
          },
        },
        {
          label: "Confirm",
          intent: "danger",
          onClick: async () => {
            dismissToast(toastId)
            confirmToastIdRef.current = null
            try {
              setIsAddingStock(true)
              await createLot({
                productId: product.productId,
                lotNumber,
                barcode: lotBarcode,
                quantity: qty,
                purchaseCost: buying,
                lotRetailPrice: retail,
                lotWholesalePrice: wholesale,
                entryDate: new Date().toISOString().split("T")[0],
                expiryDate,
                supplierName: addStockSupplier.trim() || "Syngenta Bangladesh Limited",
                challanNo,
                saveAsDefaultCartonSize: hasCartons && isMultiplierChanged && saveAsDefaultCarton,
                cartonMultiplier: hasCartons ? multiplierNum : (product.cartonMultiplier || undefined),
              })

              const summaryMsg = `${product.nameEn} • +${qty} ${unitLabel}${cartonBreakdown} • Lot #${lotNumber} • MRP ৳${retail.toFixed(2)} • Exp: ${expiryDate}${cartonUpdateNotice}`
              showSuccess(summaryMsg, "Stock Lot Inwarded")
              handleClose()
              onSuccess()
            } catch (err) {
              showError(err, "Failed to add stock")
            } finally {
              setIsAddingStock(false)
            }
          },
        },
      ],
    })

    confirmToastIdRef.current = toastId
  }

  return (
    <Modal
      isOpen={!!product}
      onClose={handleClose}
      closeOnEsc={true}
      closeOnClickOutside={false}
      size="lg"
      headerVariant="light"
      icon={
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 shadow-2xs">
          <Package className="w-5 h-5 stroke-[2.5]" />
        </div>
      }
      title={
        <div className="flex items-center gap-2 flex-wrap">
          <span>Add Stock Lot</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            {product.nameEn}
          </span>
          {effectivePackStr && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {effectivePackStr}
            </span>
          )}
        </div>
      }
      subtitle="Receive a new batch with purchase cost, selling price, and expiry tracking."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ─── 1. Quantity & Packaging Setup ─── */}
        <div className="bg-slate-50/70 border border-slate-200/80 dark:bg-slate-800/40 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              1. Inwarding Quantity & Packaging
            </span>

            <div className="flex items-center gap-2.5">
              {/* Packaging Mode Segmented Toggle (Same as Add Product) */}
              <div className="inline-flex bg-slate-200/70 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => handleTogglePackaging(false)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                    !hasCartons
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200",
                  )}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePackaging(true)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1",
                    hasCartons
                      ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200",
                  )}
                >
                  <Box className="w-3 h-3" />
                  Carton
                </button>
              </div>

              {/* Total Units & Net Mass/Volume Badge (No "mls" or invalid plurals) */}
              {totalQtyNum > 0 && (
                <span className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                  Total: {totalQtyNum} {totalQtyNum === 1 ? countUnit.singular : countUnit.plural}
                  {parsedPack && (
                    <span className="font-sans font-semibold text-emerald-900 dark:text-emerald-200 ml-1.5">
                      ({parsedPack.formatTotal(totalQtyNum).combinedText} net)
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {hasCartons ? (
            <div className="space-y-2.5">
              {/* Known Carton Multiplier Banner (Editable) */}
              <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-850/40 px-3 py-1.5 rounded-lg flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-800 dark:text-emerald-300 font-medium">Packaging: 1 Carton =</span>
                  <div className="w-20">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={cartonMultiplier}
                      onChange={(e) => handleMultiplierChange(e.target.value)}
                      placeholder="20"
                      isMonospace
                      inputSize="sm"
                      className="font-bold text-center h-7 py-0 text-xs bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                    />
                  </div>
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    {multiplierNum === 1 ? countUnit.singular : countUnit.plural}
                  </span>
                </div>
                {parsedPack && (
                  <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    {parsedPack.formatTotal(multiplierNum).combinedText} / carton
                  </span>
                )}
              </div>

              {/* Checkbox: Hidden by default, shown only when carton multiplier differs from product master */}
              {hasCartons && isMultiplierChanged && (
                <label
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer select-none text-[11px] transition-all duration-150 border animate-in fade-in slide-in-from-top-1",
                    saveAsDefaultCarton
                      ? "bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 shadow-2xs font-medium"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={saveAsDefaultCarton}
                    onChange={(e) => setSaveAsDefaultCarton(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer accent-emerald-600 shrink-0"
                  />
                  <span className="leading-snug">
                    Save{" "}
                    <strong className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {multiplierNum}
                    </strong>{" "}
                    as default carton size for this product
                  </span>
                </label>
              )}

              {/* Inwarding Inputs: Cartons + Loose Units = Total Quantity */}
              <div className="flex flex-wrap items-center gap-3 pt-0.5">
                <div className="w-32">
                  <Input
                    label="Cartons"
                    type="number"
                    min="0"
                    step="any"
                    value={cartons}
                    onChange={(e) => handleCartonsChange(e.target.value)}
                    placeholder="0"
                    isMonospace
                    inputSize="sm"
                    rightAdornment={<span className="text-xs text-slate-400 font-medium">ctn</span>}
                  />
                </div>
                <span className="text-slate-400 font-bold text-base pt-5">+</span>
                <div className="w-36">
                  <Input
                    label={`Loose Units`}
                    type="number"
                    min="0"
                    step="any"
                    value={loose}
                    onChange={(e) => handleLooseChange(e.target.value)}
                    placeholder="0"
                    isMonospace
                    inputSize="sm"
                    rightAdornment={
                      <span className="text-xs text-slate-400 font-medium">
                        {countUnit.singular.toLowerCase()}
                      </span>
                    }
                  />
                </div>
                <span className="text-slate-400 font-bold text-base pt-5">=</span>
                <div className="w-40">
                  <Input
                    id="addStockQtyInput"
                    label="Total Quantity *"
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={addStockQty}
                    onChange={(e) => handleQtyChange(e.target.value)}
                    placeholder="0"
                    isMonospace
                    inputSize="sm"
                    rightAdornment={
                      <span className="text-xs text-slate-400 font-medium">
                        {countUnit.plural.toLowerCase()}
                      </span>
                    }
                    className="font-bold pr-16"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="w-56 pt-0.5">
              <Input
                id="addStockQtyInput"
                label="Total Quantity *"
                type="number"
                step="any"
                min="0.01"
                required
                value={addStockQty}
                onChange={(e) => handleQtyChange(e.target.value)}
                placeholder="e.g. 50"
                isMonospace
                inputSize="sm"
                rightAdornment={
                  <span className="text-xs text-slate-400 font-medium select-none">
                    {countUnit.plural.toLowerCase()}
                  </span>
                }
                className="font-bold pr-16"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* ─── 2. Lot Financials & Pricing Matrix ─── */}
        <div className="bg-white border border-slate-200/90 dark:bg-slate-800/50 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-emerald-400" />
              2. Lot Pricing & Economics
            </span>
            {retailMargin && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold font-mono",
                  retailMargin.isPositive
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
                )}
              >
                <TrendingUp className="w-3 h-3" />
                {retailMargin.pct} margin (৳{retailMargin.profit}/unit)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <Input
                id="addStockBuyingInput"
                label="Purchase Cost / Unit *"
                type="number"
                step="0.01"
                min="0"
                value={addStockBuying}
                onChange={(e) => setAddStockBuying(e.target.value)}
                placeholder={String(product.buyingPrice || "0.00")}
                isMonospace
                inputSize="sm"
                leftAdornment={<span className="text-xs font-bold text-slate-400 dark:text-slate-500">৳</span>}
                className="font-semibold"
              />
              {hasCartons && multiplierNum > 1 && buyingNum > 0 && (
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1">
                  ৳{(buyingNum * multiplierNum).toFixed(2)} / carton
                </div>
              )}
            </div>

            <div>
              <Input
                id="addStockRetailInput"
                label="Retail Price (MRP) *"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={addStockRetail}
                onChange={(e) => setAddStockRetail(e.target.value)}
                placeholder={String(product.retailPrice || "0.00")}
                isMonospace
                inputSize="sm"
                leftAdornment={<span className="text-xs font-bold text-slate-400 dark:text-slate-500">৳</span>}
                className="font-semibold"
              />
              {hasCartons && multiplierNum > 1 && retailNum > 0 && (
                <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold pt-1">
                  ৳{(retailNum * multiplierNum).toFixed(2)} / carton
                </div>
              )}
            </div>

            <div>
              <Input
                id="addStockWholesaleInput"
                label="Wholesale Price *"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={addStockWholesale}
                onChange={(e) => setAddStockWholesale(e.target.value)}
                placeholder={String(product.wholesalePrice || product.retailPrice || "0.00")}
                isMonospace
                inputSize="sm"
                leftAdornment={<span className="text-xs font-bold text-slate-400 dark:text-slate-500">৳</span>}
                className="font-semibold"
              />
              {hasCartons && multiplierNum > 1 && wholesaleNum > 0 && (
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1">
                  ৳{(wholesaleNum * multiplierNum).toFixed(2)} / carton
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── 3. Traceability & Supplier Metadata ─── */}
        <div className="bg-slate-50/70 border border-slate-200/80 dark:bg-slate-800/40 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Warehouse className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            3. Batch Traceability & Vendor
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <Input
                id="addStockLotInput"
                label="Lot / Batch No *"
                required
                readOnly
                tabIndex={-1}
                value={addStockLotNumber || getNextLotNumber(matched?.lots)}
                placeholder="e.g. LOT-02"
                isMonospace
                inputSize="sm"
                rightAdornment={<Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />}
                className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-bold cursor-not-allowed select-none"
                helperText="Auto-incremented"
              />
            </div>

            <div>
              <Input
                id="addStockExpiryInput"
                label="Expiry Date *"
                type="date"
                required
                value={addStockExpiry}
                onChange={(e) => setAddStockExpiry(e.target.value)}
                inputSize="sm"
              />
            </div>

            <div>
              <Input
                id="addStockChallanInput"
                label="Challan Reference"
                value={addStockChallan}
                onChange={(e) => setAddStockChallan(e.target.value)}
                placeholder="e.g. CH-080598"
                isMonospace
                inputSize="sm"
              />
            </div>
          </div>

          <div className="pt-0.5">
            <Input
              id="addStockSupplierInput"
              label="Supplier / Vendor"
              value={addStockSupplier}
              onChange={(e) => setAddStockSupplier(e.target.value)}
              placeholder="Supplier name"
              inputSize="sm"
            />
          </div>
        </div>

        {/* ─── Footer Action Buttons ─── */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={handleClose}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isAddingStock}
            disabled={!addStockQty || parseFloat(addStockQty) <= 0}
            className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold px-6 shadow-sm cursor-pointer"
          >
            Add Stock
          </Button>
        </div>
      </form>
    </Modal>
  )
}
