import React, { useState, useEffect, useMemo, useRef } from "react"
import type { Product, GroupedProduct } from "../../types"
import { updateProduct } from "../../api/endpoints"
import { useToast } from "../../context/ToastContext"
import Modal from "../ui/Modal"
import Input from "../ui/Input"
import Button from "../ui/Button"
import {
  Edit3,
  Layers,
  Box,
  Tag,
  ShieldAlert,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface EditProductModalProps {
  isOpen: boolean
  product: Product | GroupedProduct | null
  onClose: () => void
  onSuccess: (updated: Product) => void
}

const COMMON_CATEGORIES = [
  "Insecticide",
  "Fungicide",
  "Herbicide",
  "Fertilizer",
  "Seed",
  "Micronutrient",
  "PGR",
  "Other",
]

const COMMON_BASE_UNITS = [
  "Piece",
  "Bottle",
  "Packet",
  "Bag",
  "KG",
  "Liter",
  "Can",
  "Drum",
]

export default function EditProductModal({
  isOpen,
  product,
  onClose,
  onSuccess,
}: EditProductModalProps) {
  const { showToast, showSuccess, showError, showWarning, dismissToast } = useToast()
  const confirmToastIdRef = useRef<string | null>(null)

  // Form states
  const [nameEn, setNameEn] = useState("")
  const [nameBn, setNameBn] = useState("")
  const [category, setCategory] = useState("Insecticide")
  const [companyName, setCompanyName] = useState("Syngenta Bangladesh Limited")
  const [baseUnit, setBaseUnit] = useState("Piece")
  const [packSize, setPackSize] = useState("")
  const [cartonMultiplier, setCartonMultiplier] = useState("20")
  const [standardRetailPrice, setStandardRetailPrice] = useState("")
  const [standardWholesalePrice, setStandardWholesalePrice] = useState("")
  const [buyingPrice, setBuyingPrice] = useState("")
  const [defaultBarcode, setDefaultBarcode] = useState("")
  const [minStockAlert, setMinStockAlert] = useState("5")
  const [isSaving, setIsSaving] = useState(false)

  // Target product extraction (handles either Product or GroupedProduct)
  const targetProduct = useMemo<Product | null>(() => {
    if (!product) return null
    if ("product" in product && product.product) {
      return product.product
    }
    return product as Product
  }, [product])

  // Reset form whenever active product changes
  useEffect(() => {
    if (targetProduct) {
      setNameEn(targetProduct.nameEn || "")
      setNameBn(targetProduct.nameBn || targetProduct.nameEn || "")
      setCategory(targetProduct.category || "Insecticide")
      setCompanyName(targetProduct.companyName || "Syngenta Bangladesh Limited")
      setBaseUnit(targetProduct.baseUnit || "Piece")
      setPackSize(targetProduct.packSize || targetProduct.unitSize || "")
      setCartonMultiplier(String(targetProduct.cartonMultiplier || 20))
      setStandardRetailPrice(
        targetProduct.standardRetailPrice ? String(targetProduct.standardRetailPrice) : "",
      )
      setStandardWholesalePrice(
        targetProduct.standardWholesalePrice
          ? String(targetProduct.standardWholesalePrice)
          : targetProduct.standardRetailPrice
            ? String(Math.round(targetProduct.standardRetailPrice * 0.95 * 100) / 100)
            : "",
      )
      setBuyingPrice(
        targetProduct.buyingPrice ? String(targetProduct.buyingPrice) : "",
      )
      setDefaultBarcode(targetProduct.defaultBarcode || "")
      setMinStockAlert(String(targetProduct.minStockAlert ?? 5))
    }
  }, [targetProduct])

  // Dirty state tracking (Layer 1 Invariant: prevent redundant DB locks)
  const isChanged = useMemo(() => {
    if (!targetProduct) return false
    const origNameEn = (targetProduct.nameEn || "").trim()
    const origNameBn = (targetProduct.nameBn || "").trim()
    const origCategory = (targetProduct.category || "").trim()
    const origBaseUnit = (targetProduct.baseUnit || "").trim()
    const origPackSize = (targetProduct.packSize || targetProduct.unitSize || "").trim()
    const origMultiplier = Number(targetProduct.cartonMultiplier || 20)
    const origRetail = Number(targetProduct.standardRetailPrice || 0)
    const origWholesale = Number(targetProduct.standardWholesalePrice || 0)
    const origBuying = Number(targetProduct.buyingPrice || 0)
    const origBarcode = (targetProduct.defaultBarcode || "").trim()
    const origMinStock = Number(targetProduct.minStockAlert ?? 5)

    return (
      nameEn.trim() !== origNameEn ||
      nameBn.trim() !== origNameBn ||
      category.trim() !== origCategory ||
      baseUnit.trim() !== origBaseUnit ||
      packSize.trim() !== origPackSize ||
      Number(cartonMultiplier || 0) !== origMultiplier ||
      Number(standardRetailPrice || 0) !== origRetail ||
      Number(standardWholesalePrice || 0) !== origWholesale ||
      Number(buyingPrice || 0) !== origBuying ||
      defaultBarcode.trim() !== origBarcode ||
      Number(minStockAlert || 0) !== origMinStock
    )
  }, [
    targetProduct,
    nameEn,
    nameBn,
    category,
    baseUnit,
    packSize,
    cartonMultiplier,
    standardRetailPrice,
    standardWholesalePrice,
    buyingPrice,
    defaultBarcode,
    minStockAlert,
  ])

  // Margin Preview
  const retailNum = parseFloat(standardRetailPrice) || 0
  const buyingNum = parseFloat(buyingPrice) || 0
  const marginPct = retailNum > 0 && buyingNum > 0
    ? (((retailNum - buyingNum) / retailNum) * 100).toFixed(1)
    : null

  if (!isOpen || !targetProduct) return null

  useEffect(() => {
    return () => {
      if (confirmToastIdRef.current) {
        dismissToast(confirmToastIdRef.current)
        confirmToastIdRef.current = null
      }
    }
  }, [dismissToast])

  const handleClose = () => {
    if (confirmToastIdRef.current) {
      dismissToast(confirmToastIdRef.current)
      confirmToastIdRef.current = null
    }
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const cleanNameEn = nameEn.trim()
    if (!cleanNameEn) {
      showWarning("Product English Name is required.")
      return
    }

    const retail = parseFloat(standardRetailPrice) || 0
    if (retail <= 0) {
      showWarning("Please specify a valid Standard Retail Price (MRP).")
      return
    }

    const wholesale = parseFloat(standardWholesalePrice) || 0
    if (wholesale <= 0) {
      showWarning("Please specify a valid Standard Wholesale Price.")
      return
    }

    const buying = Math.max(0, parseFloat(buyingPrice) || 0)
    const multiplier = Math.max(1, parseFloat(cartonMultiplier) || 1)
    const minAlert = Math.max(0, parseInt(minStockAlert, 10) || 5)

    const origRetail = Number(targetProduct.standardRetailPrice || 0)
    const retailChanged = Math.abs(origRetail - retail) > 0.001

    const origWholesale = Number(targetProduct.standardWholesalePrice || 0)
    const wholesaleChanged = Math.abs(origWholesale - wholesale) > 0.001

    const origBuying = Number(targetProduct.buyingPrice || 0)
    const buyingChanged = Math.abs(origBuying - buying) > 0.001

    const origMultiplier = Number(targetProduct.cartonMultiplier || 20)
    const multiplierChanged = Math.abs(origMultiplier - multiplier) > 0.001

    const origPack = (targetProduct.packSize || targetProduct.unitSize || "").trim()
    const packChanged = packSize.trim() !== origPack

    const origCategory = (targetProduct.category || "").trim()
    const categoryChanged = category.trim() !== origCategory

    const origNameEn = (targetProduct.nameEn || "").trim()
    const nameChanged = cleanNameEn !== origNameEn

    const executeSave = async () => {
      try {
        setIsSaving(true)
        const payload: Partial<Product> = {
          nameEn: cleanNameEn,
          nameBn: nameBn.trim() || cleanNameEn,
          category: category.trim(),
          companyName: companyName.trim() || "Syngenta Bangladesh Limited",
          baseUnit: baseUnit.trim(),
          packSize: packSize.trim() || null,
          unitSize: packSize.trim() || null,
          cartonMultiplier: multiplier,
          standardRetailPrice: retail,
          standardWholesalePrice: wholesale,
          buyingPrice: buying,
          defaultBarcode: defaultBarcode.trim() || targetProduct.defaultBarcode,
          minStockAlert: minAlert,
        }

        const updated = await updateProduct(targetProduct.id, payload)
        const summaryMsg = `${updated.nameEn} • MRP ৳${updated.standardRetailPrice} • Wholesale ৳${updated.standardWholesalePrice || updated.standardRetailPrice} • Pack: ${updated.packSize || updated.baseUnit}`
        showSuccess(summaryMsg, "Product Master Updated")
        onSuccess(updated)
        onClose()
      } catch (err) {
        showError(err, "Failed to update product master")
      } finally {
        setIsSaving(false)
      }
    }

    // Dismiss previous confirmation toast if active
    if (confirmToastIdRef.current) {
      dismissToast(confirmToastIdRef.current)
      confirmToastIdRef.current = null
    }

    const toastId = showToast({
      type: "info",
      title: "Confirm Product Changes",
      presentation: "confirmation",
      duration: 0,
      closePrevious: true,
      message: (
        <div className="space-y-3">
          {/* Product Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">
                {cleanNameEn}
              </div>
              {nameBn && nameBn.trim() !== cleanNameEn && (
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bangla mt-0.5">
                  {nameBn.trim()}
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 whitespace-nowrap">
                #{targetProduct.productCode}
              </span>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium whitespace-nowrap">
                {category.trim()} • {baseUnit.trim()}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs">
            {/* Retail MRP */}
            <div className="space-y-0.5">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Retail MRP
              </span>
              <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                {retailChanged ? (
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <span className="line-through text-slate-400 font-normal">৳{origRetail.toFixed(2)}</span>
                    <span className="text-emerald-700 dark:text-emerald-400">→ ৳{retail.toFixed(2)}</span>
                  </span>
                ) : (
                  <span>৳{retail.toFixed(2)}</span>
                )}
              </div>
            </div>

            {/* Wholesale Price */}
            <div className="space-y-0.5">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Wholesale Price
              </span>
              <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                {wholesaleChanged ? (
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <span className="line-through text-slate-400 font-normal">৳{origWholesale.toFixed(2)}</span>
                    <span className="text-emerald-700 dark:text-emerald-400">→ ৳{wholesale.toFixed(2)}</span>
                  </span>
                ) : (
                  <span>৳{wholesale.toFixed(2)}</span>
                )}
              </div>
            </div>

            {/* Purchase Cost */}
            <div className="space-y-0.5">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Purchase Cost
              </span>
              <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                {buyingChanged ? (
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <span className="line-through text-slate-400 font-normal">৳{origBuying.toFixed(2)}</span>
                    <span className="text-emerald-700 dark:text-emerald-400">→ ৳{buying.toFixed(2)}</span>
                  </span>
                ) : (
                  <span>৳{buying.toFixed(2)}</span>
                )}
              </div>
            </div>

            {/* Carton Multiplier */}
            <div className="space-y-0.5">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                Units per Carton
              </span>
              <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                {multiplierChanged ? (
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <span className="line-through text-slate-400 font-normal">{origMultiplier}</span>
                    <span className="text-emerald-700 dark:text-emerald-400">→ {multiplier} /ctn</span>
                  </span>
                ) : (
                  <span>{multiplier} /ctn</span>
                )}
              </div>
            </div>
          </div>

          {/* Changed Attributes Banner if applicable */}
          {(packChanged || categoryChanged || nameChanged) && (
            <div className="p-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
              {nameChanged && (
                <span>
                  <strong className="text-slate-800 dark:text-slate-200">Name:</strong> {cleanNameEn}
                </span>
              )}
              {packChanged && (
                <span>
                  <strong className="text-slate-800 dark:text-slate-200">Pack:</strong> {packSize.trim() || "Default"}
                </span>
              )}
              {categoryChanged && (
                <span>
                  <strong className="text-slate-800 dark:text-slate-200">Category:</strong> {category.trim()}
                </span>
              )}
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
            await executeSave()
          },
        },
      ],
    })

    confirmToastIdRef.current = toastId
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      closeOnEsc={true}
      size="lg"
      headerVariant="light"
      icon={
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-2xs">
          <Edit3 className="w-5 h-5 stroke-[2.5]" />
        </div>
      }
      title={
        <div className="flex items-center gap-2 flex-wrap">
          <span>Edit Product Master</span>
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
            #{targetProduct.productCode}
          </span>
        </div>
      }
      subtitle="Modify master catalog data, default pricing matrix, packaging ratio, and reorder point."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Identification & Nomenclature */}
        <div className="bg-slate-50/70 border border-slate-200/80 dark:bg-slate-800/40 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-teal-700 dark:text-emerald-400" />
            1. Product Identification
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <Input
                label="Product Name (English) *"
                required
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Sempra 75 WDG"
                inputSize="sm"
                className="font-semibold"
              />
            </div>
            <div>
              <Input
                label="Product Name (Bengali)"
                value={nameBn}
                onChange={(e) => setNameBn(e.target.value)}
                placeholder="e.g. সেমপ্রা ৭৫ ডব্লিউডিজি"
                inputSize="sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-0.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer"
              >
                {COMMON_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Input
                label="Company / Manufacturer"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Syngenta Bangladesh Limited"
                inputSize="sm"
              />
            </div>
          </div>
        </div>

        {/* 2. Packaging & Units */}
        <div className="bg-white border border-slate-200/90 dark:bg-slate-800/50 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            2. Packaging & Unit Configuration
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Base Unit *
              </label>
              <select
                value={baseUnit}
                onChange={(e) => setBaseUnit(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer"
              >
                {COMMON_BASE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Input
                label="Pack Size / Weight"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
                placeholder="e.g. 100 ml, 500 gm"
                inputSize="sm"
              />
            </div>

            <div>
              <Input
                label="Units per Carton"
                type="number"
                min="1"
                step="1"
                value={cartonMultiplier}
                onChange={(e) => setCartonMultiplier(e.target.value)}
                placeholder="20"
                isMonospace
                inputSize="sm"
              />
            </div>
          </div>
        </div>

        {/* 3. Pricing Matrix */}
        <div className="bg-slate-50/70 border border-slate-200/80 dark:bg-slate-800/40 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-emerald-400" />
              3. Reference Pricing Matrix
            </span>
            {marginPct && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100/80 dark:text-emerald-300 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded">
                <TrendingUp className="w-3 h-3" />
                {marginPct}% margin
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <Input
                label="Standard Retail Price (MRP) *"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={standardRetailPrice}
                onChange={(e) => setStandardRetailPrice(e.target.value)}
                placeholder="0.00"
                isMonospace
                inputSize="sm"
                leftAdornment={<span className="text-xs font-bold text-slate-400 dark:text-slate-500">৳</span>}
                className="font-bold text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <Input
                label="Standard Wholesale Price *"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={standardWholesalePrice}
                onChange={(e) => setStandardWholesalePrice(e.target.value)}
                placeholder="0.00"
                isMonospace
                inputSize="sm"
                leftAdornment={<span className="text-xs font-bold text-slate-400 dark:text-slate-500">৳</span>}
                className="font-semibold"
              />
            </div>

            <div>
              <Input
                label="Purchase Cost / Unit"
                type="number"
                step="0.01"
                min="0"
                value={buyingPrice}
                onChange={(e) => setBuyingPrice(e.target.value)}
                placeholder="0.00"
                isMonospace
                inputSize="sm"
                leftAdornment={<span className="text-xs font-bold text-slate-400 dark:text-slate-500">৳</span>}
              />
            </div>
          </div>
        </div>

        {/* 4. Barcode & Low Stock Invariant */}
        <div className="bg-white border border-slate-200/90 dark:bg-slate-800/50 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            4. Barcode & Inventory Alerts
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <Input
                label="Default Barcode / SKU"
                value={defaultBarcode}
                onChange={(e) => setDefaultBarcode(e.target.value)}
                placeholder="e.g. 890123456789"
                isMonospace
                inputSize="sm"
              />
            </div>

            <div>
              <Input
                label="Low Stock Alert Threshold"
                type="number"
                min="0"
                step="1"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(e.target.value)}
                placeholder="5"
                isMonospace
                inputSize="sm"
                rightAdornment={<span className="text-xs text-slate-400 dark:text-slate-500">units</span>}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {isChanged ? "Unsaved changes detected" : "No modifications made"}
          </span>

          <div className="flex items-center gap-2">
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
              isLoading={isSaving}
              disabled={!isChanged || isSaving}
              className={cn(
                "font-bold px-6 shadow-sm cursor-pointer",
                isChanged
                  ? "bg-teal-700 hover:bg-teal-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white"
                  : "opacity-60 cursor-not-allowed",
              )}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
