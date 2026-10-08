import React, { useState, useEffect } from "react"
import { createPortal } from "react-dom"
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
  PackageCheck,
  Boxes,
  Calendar,
  CheckCircle2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface StockModalProduct {
  productId: number
  productCode?: string
  nameEn: string
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
  const { showSuccess, showError, showWarning } = useToast()

  const [hasCartons, setHasCartons] = useState<boolean>(true)
  const [cartonMultiplier, setCartonMultiplier] = useState<string>("20")
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
  const [showConfirmModal, setShowConfirmModal] = useState(false)

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
      setShowConfirmModal(false)
    }
  }, [product, groupedProducts])

  useEffect(() => {
    if (!showConfirmModal) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        setShowConfirmModal(false)
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [showConfirmModal])

  if (!product) return null

  const multiplierNum = Math.max(1, parseFloat(cartonMultiplier) || 1)
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
    setShowConfirmModal(false)
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

    setShowConfirmModal(true)
  }

  const handleConfirmInwarding = async () => {
    try {
      setIsAddingStock(true)
      const qty = Math.max(0, parseFloat(addStockQty) || 0)
      const buying = Math.max(0, parseFloat(addStockBuying) || product.buyingPrice || 0)
      const retail = Math.max(0, parseFloat(addStockRetail) || product.retailPrice || 0)
      const wholesale = Math.max(0, parseFloat(addStockWholesale) || product.wholesalePrice || retail)
      const expiryDate =
        addStockExpiry ||
        new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

      const m = groupedProducts.find((p) => p.productId === product.productId)
      const defaultLot = getNextLotNumber(m?.lots)
      const lotNumber = addStockLotNumber.trim() || defaultLot
      const challanNo = addStockChallan.trim() || `CH-${Date.now().toString().slice(-6)}`
      const cleanCode =
        (m?.productCode || product.productCode || "").replace(/[^A-Za-z0-9]/g, "") ||
        String(product.productId)
      const cleanLot = lotNumber.replace(/^LOT-?/i, "") || "01"
      const lotBarcode = `${cleanCode}-${cleanLot}`

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
        saveAsDefaultCartonSize: hasCartons && saveAsDefaultCarton,
        cartonMultiplier: hasCartons && saveAsDefaultCarton ? multiplierNum : undefined,
      })

      const unitLabel = qty === 1 ? countUnit.singular : countUnit.plural
      const cartonBreakdown =
        hasCartons && parseFloat(cartons) > 0
          ? ` (${cartons} ctn${parseFloat(loose) > 0 ? ` + ${loose} loose` : ""})`
          : ""
      const cartonUpdateNotice =
        hasCartons && saveAsDefaultCarton
          ? ` • Default carton set to ${multiplierNum}`
          : ""

      showSuccess(
        `Added +${qty} ${unitLabel}${cartonBreakdown} (Lot #${lotNumber}) for ${product.nameEn}${cartonUpdateNotice}`,
        "Stock Lot Inwarded",
      )
      setShowConfirmModal(false)
      handleClose()
      onSuccess()
    } catch (err) {
      showError(err, "Failed to add stock")
    } finally {
      setIsAddingStock(false)
    }
  }

  return (
    <>
      <Modal
        isOpen={!!product}
        onClose={handleClose}
        closeOnEsc={!showConfirmModal}
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

              {/* Explicit Checkbox: Save default carton size for future lot entries & POS carton sales */}
              <label className="flex items-center gap-2 px-1 py-0.5 cursor-pointer select-none text-[11px] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100">
                <input
                  type="checkbox"
                  checked={saveAsDefaultCarton}
                  onChange={(e) => setSaveAsDefaultCarton(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer accent-emerald-600"
                />
                <span>
                  Save <strong className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{multiplierNum}</strong> as default carton size for future lot entries &amp; POS carton sales
                </span>
              </label>

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

    {/* ─── Centered Confirmation Dialog ─── */}
    {showConfirmModal &&
      typeof document !== "undefined" &&
      createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-inwarding-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            if (!isAddingStock) setShowConfirmModal(false)
          }}
        >
          <div
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs">
                  <PackageCheck className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3
                    id="confirm-inwarding-title"
                    className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug"
                  >
                    Confirm Stock Inwarding
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Please verify batch details and pricing before confirming
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isAddingStock}
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1.5 transition-colors cursor-pointer"
                aria-label="Close confirmation dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Content */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Product Identity */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Product
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {product.nameEn}
                  </h4>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {effectivePackStr && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-2xs">
                      {effectivePackStr}
                    </span>
                  )}
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {product.baseUnit}
                  </span>
                </div>
              </div>

              {/* Hero Inwarding Quantity Card */}
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-200 dark:border-emerald-800/80 p-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5" />
                    Inwarding Quantity
                  </span>
                  {hasCartons && parseFloat(cartons) > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-200/80 dark:bg-emerald-800/60 text-emerald-900 dark:text-emerald-100 font-mono">
                      {cartons} {parseFloat(cartons) === 1 ? "Carton" : "Cartons"}
                      {parseFloat(loose) > 0 ? ` + ${loose} ${countUnit.singular}` : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black font-mono tracking-tight text-emerald-700 dark:text-emerald-400">
                    +{parseFloat(addStockQty) || 0}
                  </span>
                  <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                    {(parseFloat(addStockQty) || 0) === 1 ? countUnit.singular : countUnit.plural}
                  </span>
                </div>
                {hasCartons && multiplierNum > 1 && (
                  <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 mt-1">
                    Carton Packing: {multiplierNum} {countUnit.plural} per carton
                  </p>
                )}
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Lot / Batch */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                    <Lock className="w-3 h-3 text-slate-400" />
                    Lot / Batch No
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">
                    {addStockLotNumber.trim() || getNextLotNumber(matched?.lots)}
                  </div>
                </div>

                {/* Expiry Date */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Expiry Date
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">
                    {addStockExpiry || new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                  </div>
                </div>

                {/* Purchase Cost */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Purchase Cost
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">
                    ৳{(parseFloat(addStockBuying) || product.buyingPrice || 0).toFixed(2)}
                  </div>
                  {hasCartons && multiplierNum > 1 && (
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      ৳{((parseFloat(addStockBuying) || product.buyingPrice || 0) * multiplierNum).toFixed(2)} / ctn
                    </div>
                  )}
                </div>

                {/* Retail Price (MRP) */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold mb-1">
                    Retail Price (MRP)
                  </div>
                  <div className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    ৳{(parseFloat(addStockRetail) || product.retailPrice || 0).toFixed(2)}
                  </div>
                  {hasCartons && multiplierNum > 1 && (
                    <div className="text-[10px] font-mono text-emerald-600/80 dark:text-emerald-500">
                      ৳{((parseFloat(addStockRetail) || product.retailPrice || 0) * multiplierNum).toFixed(2)} / ctn
                    </div>
                  )}
                </div>

                {/* Wholesale Price */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Wholesale Price
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100">
                    ৳{(parseFloat(addStockWholesale) || product.wholesalePrice || parseFloat(addStockRetail) || 0).toFixed(2)}
                  </div>
                </div>

                {/* Challan No */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Challan No
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100 truncate">
                    {addStockChallan.trim() || `CH-${Date.now().toString().slice(-6)}`}
                  </div>
                </div>
              </div>

              {/* Supplier Info */}
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Supplier / Vendor:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[240px]">
                  {addStockSupplier.trim() || "Syngenta Bangladesh Limited"}
                </span>
              </div>

              {/* Default Carton Size Notification (if checked) */}
              {hasCartons && saveAsDefaultCarton && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Will save <strong>{multiplierNum}</strong> as default carton size for this product.
                  </span>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 bg-slate-50/90 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled={isAddingStock}
                onClick={() => setShowConfirmModal(false)}
                className="cursor-pointer"
              >
                Back to Edit
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                isLoading={isAddingStock}
                onClick={handleConfirmInwarding}
                className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold px-6 shadow-sm cursor-pointer"
              >
                Confirm Inwarding
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
