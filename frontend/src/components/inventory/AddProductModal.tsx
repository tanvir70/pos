import React, { useState, useEffect } from "react"
import {
  Plus,
  X,
  Package,
  Box,
  Layers,
  Warehouse,
  Hash,
  TrendingUp,
} from "lucide-react"
import { createProduct, getSupportedUnits } from "../../api/endpoints"
import { useToast } from "../../context/ToastContext"
import Input from "../ui/Input"
import Button from "../ui/Button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from "../ui/select"
import { parsePackSize } from "../../utils/unit"
import type { UnitGroup } from "../../types"
import { cn } from "@/lib/utils"

export interface AddProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onPrintSticker?: (lot: any, lots?: any[]) => void
}

const COMMON_PACK_SIZES = [
  "50 ml",
  "100 ml",
  "250 ml",
  "500 ml",
  "1 L",
  "10 gm",
  "100 gm",
  "1 Kg",
]

const DEFAULT_UNIT_GROUPS: UnitGroup[] = [
  {
    groupId: "liquid",
    label: "Liquid & Volume",
    units: [
      { value: "ml", label: "ml (Milliliter)", isDiscrete: false, category: "liquid" },
      { value: "Liter", label: "Liter (L)", isDiscrete: false, category: "liquid" },
    ],
  },
  {
    groupId: "weight",
    label: "Weight & Mass",
    units: [
      { value: "gm", label: "gm (Gram)", isDiscrete: false, category: "weight" },
      { value: "Kg", label: "Kg (Kilogram)", isDiscrete: false, category: "weight" },
    ],
  },
  {
    groupId: "container",
    label: "Physical Containers",
    units: [
      { value: "Bottle", label: "Bottle", isDiscrete: true, category: "container" },
      { value: "Packet", label: "Packet", isDiscrete: true, category: "container" },
      { value: "Piece", label: "Piece", isDiscrete: true, category: "container" },
      { value: "Bag", label: "Bag", isDiscrete: true, category: "container" },
      { value: "Can", label: "Can / Drum", isDiscrete: true, category: "container" },
    ],
  },
]

export default function AddProductModal({
  isOpen,
  onClose,
  onSuccess,
  onPrintSticker,
}: AddProductModalProps) {
  const { showSuccess, showError, showWarning } = useToast()

  // ─── 1. Basic Information ──────────────────────────────────────────
  const [newProdName, setNewProdName] = useState("")
  const [newProdCategory, setNewProdCategory] = useState("Insecticide")
  const [newProdBaseUnit, setNewProdBaseUnit] = useState("Bottle")
  const [newProdUnitSize, setNewProdUnitSize] = useState("")

  // Dynamic Units loaded from Backend Single Source of Truth
  const [unitGroups, setUnitGroups] = useState<UnitGroup[]>(DEFAULT_UNIT_GROUPS)

  // ─── 2. Packaging Configuration ────────────────────────────────────
  const [hasCartons, setHasCartons] = useState(true)
  const [cartonMultiplier, setCartonMultiplier] = useState("20")

  // ─── 3. 2-Way Synchronized Pricing Matrix ──────────────────────────
  const [retailPack, setRetailPack] = useState("")
  const [retailCarton, setRetailCarton] = useState("")

  const [wholesalePack, setWholesalePack] = useState("")
  const [wholesaleCarton, setWholesaleCarton] = useState("")

  const [buyingPack, setBuyingPack] = useState("")
  const [buyingCarton, setBuyingCarton] = useState("")

  // ─── 4. Initial Stock on Hand ──────────────────────────────────────
  const [stockCartons, setStockCartons] = useState("")
  const [stockLoose, setStockLoose] = useState("")
  const [stockSingle, setStockSingle] = useState("")

  // ─── 5. Advanced Options (Always Visible) ───────────────────────────
  const [newProdCode, setNewProdCode] = useState("")
  const [newProdMinStock, setNewProdMinStock] = useState("5")

  const [isSavingProd, setIsSavingProd] = useState(false)

  // Fetch canonical units from backend on mount
  useEffect(() => {
    if (isOpen) {
      getSupportedUnits()
        .then((groups) => {
          if (groups && groups.length > 0) {
            setUnitGroups(groups)
          }
        })
        .catch(() => {
          // Keep DEFAULT_UNIT_GROUPS on failure
        })
    }
  }, [isOpen])

  if (!isOpen) return null

  const multiplierNum = hasCartons ? Math.max(1, parseFloat(cartonMultiplier) || 1) : 1
  const parsedPack = parsePackSize(newProdUnitSize, newProdBaseUnit)

  const handleCategoryChange = (cat: string) => {
    setNewProdCategory(cat)
    if (cat === "Seed") {
      setNewProdBaseUnit("Packet")
    } else if (cat === "Equipment") {
      setNewProdBaseUnit("Piece")
    } else {
      setNewProdBaseUnit("Bottle")
    }
  }

  // ─── Price Synchronization Helpers ─────────────────────────────────
  const handleMultiplierChange = (val: string) => {
    setCartonMultiplier(val)
    const m = Math.max(1, parseFloat(val) || 1)
    if (retailPack && !isNaN(parseFloat(retailPack))) {
      setRetailCarton((parseFloat(retailPack) * m).toFixed(2))
    }
    if (wholesalePack && !isNaN(parseFloat(wholesalePack))) {
      setWholesaleCarton((parseFloat(wholesalePack) * m).toFixed(2))
    }
    if (buyingPack && !isNaN(parseFloat(buyingPack))) {
      setBuyingCarton((parseFloat(buyingPack) * m).toFixed(2))
    }
  }

  // Retail MRP
  const handleRetailPackChange = (val: string) => {
    setRetailPack(val)
    const p = parseFloat(val)
    if (!isNaN(p) && hasCartons && multiplierNum > 1) {
      setRetailCarton((p * multiplierNum).toFixed(2))
    }
  }

  const handleRetailCartonChange = (val: string) => {
    setRetailCarton(val)
    const c = parseFloat(val)
    if (!isNaN(c) && hasCartons && multiplierNum > 1) {
      setRetailPack((c / multiplierNum).toFixed(2))
    }
  }

  // Wholesale Rate
  const handleWholesalePackChange = (val: string) => {
    setWholesalePack(val)
    const p = parseFloat(val)
    if (!isNaN(p) && hasCartons && multiplierNum > 1) {
      setWholesaleCarton((p * multiplierNum).toFixed(2))
    }
  }

  const handleWholesaleCartonChange = (val: string) => {
    setWholesaleCarton(val)
    const c = parseFloat(val)
    if (!isNaN(c) && hasCartons && multiplierNum > 1) {
      setWholesalePack((c / multiplierNum).toFixed(2))
    }
  }

  // Buying Cost
  const handleBuyingPackChange = (val: string) => {
    setBuyingPack(val)
    const p = parseFloat(val)
    if (!isNaN(p) && hasCartons && multiplierNum > 1) {
      setBuyingCarton((p * multiplierNum).toFixed(2))
    }
  }

  const handleBuyingCartonChange = (val: string) => {
    setBuyingCarton(val)
    const c = parseFloat(val)
    if (!isNaN(c) && hasCartons && multiplierNum > 1) {
      setBuyingPack((c / multiplierNum).toFixed(2))
    }
  }

  // Margin Calculations for Senior UI Economics
  const retailNum = parseFloat(retailPack) || 0
  const buyingNum = parseFloat(buyingPack) || 0
  const wholesaleNum = parseFloat(wholesalePack) || 0

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

  // Compute Total Initial Stock
  const totalCalculatedStock = hasCartons
    ? ((parseFloat(stockCartons) || 0) * multiplierNum) + (parseFloat(stockLoose) || 0)
    : (parseFloat(stockSingle) || 0)

  // ─── Reset Form ───────────────────────────────────────────────────
  const resetForm = () => {
    setNewProdName("")
    setNewProdCategory("Insecticide")
    setNewProdBaseUnit("Bottle")
    setNewProdUnitSize("")
    setHasCartons(true)
    setCartonMultiplier("20")
    setRetailPack("")
    setRetailCarton("")
    setWholesalePack("")
    setWholesaleCarton("")
    setBuyingPack("")
    setBuyingCarton("")
    setStockCartons("")
    setStockLoose("")
    setStockSingle("")
    setNewProdCode("")
    setNewProdMinStock("5")
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleAutoGenerateCode = () => {
    const clean = newProdName.trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6) || "PRD"
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    setNewProdCode(`SYN-${clean}-${randomSuffix}`)
  }

  // ─── Submit Handler ───────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProdName.trim()) {
      showWarning("Product name is required")
      return
    }
    if (!newProdCode.trim()) {
      showWarning("Product Code / SKU is required")
      return
    }

    try {
      setIsSavingProd(true)
      const cleanName = newProdName.trim()
      const code = newProdCode.trim()

      const retail = Math.max(0, parseFloat(retailPack) || 0)
      const buying = Math.max(0, parseFloat(buyingPack) || 0)
      const wholesale = Math.max(
        0,
        parseFloat(wholesalePack) || (retail > 0 ? Math.round(retail * 0.95 * 100) / 100 : 0),
      )

      const ctnWholesale = hasCartons ? (parseFloat(wholesaleCarton) || (wholesale * multiplierNum)) : undefined
      const ctnBuying = hasCartons ? (parseFloat(buyingCarton) || (buying * multiplierNum)) : undefined
      const minStock = Math.max(0, parseInt(newProdMinStock) || 5)
      const unitSizeClean = newProdUnitSize.trim() || undefined

      const payload: any = {
        productCode: code,
        nameEn: cleanName,
        nameBn: cleanName,
        companyName: "Syngenta Bangladesh Limited",
        category: newProdCategory,
        baseUnit: newProdBaseUnit,
        packSize: unitSizeClean,
        unitSize: unitSizeClean,
        cartonMultiplier: multiplierNum,
        standardRetailPrice: retail,
        standardWholesalePrice: wholesale,
        buyingPrice: buying,
        cartonWholesalePrice: ctnWholesale,
        cartonBuyingPrice: ctnBuying,
        minStockAlert: minStock,
        defaultBarcode: `${code}-DEF`,
      }

      // Atomic Option B: include initial stock in the single createProduct call
      if (totalCalculatedStock > 0) {
        payload.initialStock = {
          quantity: totalCalculatedStock,
          cartons: hasCartons ? (parseFloat(stockCartons) || 0) : 0,
          looseUnits: hasCartons ? (parseFloat(stockLoose) || 0) : totalCalculatedStock,
          lotNumber: "LOT-01",
          barcode: `${code}-01`,
          purchaseCost: buying,
          lotRetailPrice: retail,
          lotWholesalePrice: wholesale || retail,
          supplierName: "Syngenta Bangladesh Limited",
          challanNo: `CH-INIT-${Date.now().toString().slice(-6)}`,
        }
      }

      const created = await createProduct(payload)

      if (totalCalculatedStock > 0) {
        const netStr = parsedPack ? ` (${parsedPack.formatTotal(totalCalculatedStock).shortText} net)` : ""
        showSuccess(
          `"${cleanName}" added with ${totalCalculatedStock} ${newProdBaseUnit}s${netStr} stock in LOT-01`,
          undefined,
          created.initialLot && onPrintSticker
            ? {
                actions: [
                  {
                    label: "Print Stickers",
                    onClick: () => onPrintSticker(created.initialLot),
                  },
                ],
              }
            : undefined,
        )
      } else {
        showSuccess(`"${cleanName}" added to catalog successfully`)
      }

      resetForm()
      onSuccess()
      onClose()
    } catch (err) {
      showError(err, "Failed to create product")
    } finally {
      setIsSavingProd(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl mb-6 animate-in fade-in slide-in-from-top-3 duration-200">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 shadow-2xs">
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Add New Product
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quick product catalog entry with packaging breakdown and pricing matrix
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg p-2 transition-colors cursor-pointer"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ─── 1. Basic Product Information ─── */}
        <div className="bg-slate-50/70 border border-slate-200/80 dark:bg-slate-800/40 dark:border-slate-800 rounded-xl p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              1. Product Details
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              * Required fields
            </span>
          </div>

          {/* Row 1: Name, Code, and Category */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-5">
              <Input
                label="Product Name *"
                required
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="e.g. Virtako 40WG or Grozin"
                autoFocus
              />
            </div>

            <div className="sm:col-span-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Product Code / SKU *
                </label>
                <button
                  type="button"
                  onClick={handleAutoGenerateCode}
                  className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline cursor-pointer"
                  title="Generate a unique system SKU"
                >
                  Auto-gen SKU
                </button>
              </div>
              <Input
                required
                value={newProdCode}
                onChange={(e) => setNewProdCode(e.target.value)}
                placeholder="e.g. 35440 or SYN-VIRT-01"
                isMonospace
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Category *
              </label>
              <Select
                value={newProdCategory}
                onValueChange={(val) => handleCategoryChange(val)}
              >
                <SelectTrigger className="w-full bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 font-medium text-xs h-9 rounded-lg">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Insecticide">Insecticide</SelectItem>
                  <SelectItem value="Fungicide">Fungicide</SelectItem>
                  <SelectItem value="Herbicide">Herbicide</SelectItem>
                  <SelectItem value="Bio-stimulant">Bio-stimulant</SelectItem>
                  <SelectItem value="Seed">Seed</SelectItem>
                  <SelectItem value="Equipment">Equipment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Unified Unit, Pack Size, and Packaging Type */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 pt-0.5 items-start">
            {/* Discrete Container / Selling Unit Selector */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Container / Selling Unit *
              </label>
              <Select
                value={newProdBaseUnit}
                onValueChange={(val) => setNewProdBaseUnit(val)}
              >
                <SelectTrigger className="w-full bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 font-medium text-xs h-9 rounded-lg">
                  <SelectValue placeholder="Select container unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bottle">Bottle (বোতল - Liquids)</SelectItem>
                  <SelectItem value="Packet">Packet (প্যাকেট - Powders/Granules)</SelectItem>
                  <SelectItem value="Piece">Piece / Unit (পিস - Equipment)</SelectItem>
                  <SelectItem value="Bag">Bag (ব্যাগ - Bulk Seed/Fertilizer)</SelectItem>
                  <SelectItem value="Can">Can / Drum (ক্যান - Bulk Containers)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pack Size / Net Content */}
            <div className="sm:col-span-5">
              <Input
                label="Pack Size / Net Content"
                value={newProdUnitSize}
                onChange={(e) => {
                  const val = e.target.value
                  setNewProdUnitSize(val)
                  const vLower = val.toLowerCase()
                  if (vLower.includes("ml") || vLower.includes("liter") || vLower.includes("litre")) {
                    setNewProdBaseUnit("Bottle")
                  } else if (vLower.includes("gm") || vLower.includes("gram") || vLower.includes("kg")) {
                    setNewProdBaseUnit("Packet")
                  }
                }}
                placeholder="e.g. 50 ml, 100 gm, 1 L"
              />
              {/* Quick suggestion chips */}
              <div className="flex items-center gap-1 flex-wrap pt-1.5">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Quick:</span>
                {COMMON_PACK_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setNewProdUnitSize(size)
                      const sLower = size.toLowerCase()
                      if (sLower.includes("ml") || sLower.includes("l")) {
                        setNewProdBaseUnit("Bottle")
                      } else if (sLower.includes("gm") || sLower.includes("kg")) {
                        setNewProdBaseUnit("Packet")
                      }
                    }}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer",
                      newProdUnitSize === size
                        ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-2xs"
                        : "bg-slate-200/70 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Packaging Type Segmented Control */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Packaging Type
              </label>
              <div className="grid grid-cols-2 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700 h-9">
                <button
                  type="button"
                  onClick={() => setHasCartons(false)}
                  className={cn(
                    "rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1",
                    !hasCartons
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setHasCartons(true)}
                  className={cn(
                    "rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1",
                    hasCartons
                      ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <Box className="w-3.5 h-3.5" />
                  Carton
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 2. Packaging Configuration (when Carton Pack) ─── */}
        {hasCartons && (
          <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-850/40 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-emerald-950 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider">
                <Box className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Packs per Carton:</span>
              </div>
              <div className="w-28">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={cartonMultiplier}
                  onChange={(e) => handleMultiplierChange(e.target.value)}
                  placeholder="20"
                  isMonospace
                  inputSize="sm"
                  className="font-bold text-center"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-white/90 dark:bg-slate-900/90 border border-emerald-300 dark:border-emerald-800 px-3 py-1.5 rounded-lg shadow-2xs">
                1 Carton = {multiplierNum} {newProdBaseUnit}s
                {parsedPack && (
                  <span className="text-emerald-700 dark:text-emerald-400 ml-1.5 font-sans font-semibold">
                    · {parsedPack.formatTotal(multiplierNum).combinedText}
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* ─── 3. 2-Way Synchronized Pricing Matrix ─── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
          <div className="bg-slate-50/80 dark:bg-slate-800/50 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-emerald-400" />
              3. Pricing Matrix (2-Way Synchronized)
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              Auto-calculates carton & unit values
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/40 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                <tr>
                  <th className="py-2.5 px-4 text-left font-bold w-48">Pricing Tier</th>
                  <th className="py-2.5 px-4 text-left font-bold w-40">
                    Per {newProdBaseUnit}
                    {newProdUnitSize.trim() && (
                      <span className="block text-[10px] font-normal text-slate-500 dark:text-slate-400 font-sans">
                        ({newProdUnitSize.trim()})
                      </span>
                    )}
                  </th>
                  {hasCartons && (
                    <th className="py-2.5 px-4 text-left font-bold w-48 bg-emerald-50/30 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-300">
                      Per Carton ({multiplierNum} {newProdBaseUnit}s)
                      {parsedPack && (
                        <span className="block text-[10px] font-normal text-emerald-700 dark:text-emerald-400 font-sans">
                          Total {parsedPack.formatTotal(multiplierNum).combinedText}
                        </span>
                      )}
                    </th>
                  )}
                  <th className="py-2.5 px-4 text-left font-bold text-slate-400 dark:text-slate-500">
                    Economics / Margin
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {/* 1. Retail MRP */}
                <tr className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">
                    Retail Price (MRP) *
                  </td>
                  <td className="py-2 px-4">
                    <div className="w-36">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={retailPack}
                        onChange={(e) => handleRetailPackChange(e.target.value)}
                        placeholder="0.00"
                        isMonospace
                        inputSize="sm"
                        leftAdornment={<span className="text-xs font-bold text-slate-400 dark:text-slate-500">৳</span>}
                        className="text-right font-semibold"
                      />
                    </div>
                  </td>
                  {hasCartons && (
                    <td className="py-2 px-4 bg-emerald-50/20 dark:bg-emerald-950/10">
                      <div className="w-36">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={retailCarton}
                          onChange={(e) => handleRetailCartonChange(e.target.value)}
                          placeholder="0.00"
                          isMonospace
                          inputSize="sm"
                          leftAdornment={<span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">৳</span>}
                          className="text-right font-semibold"
                        />
                      </div>
                    </td>
                  )}
                  <td className="py-2 px-4">
                    {retailMargin ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold font-mono",
                          retailMargin.isPositive
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                        )}
                      >
                        <TrendingUp className="w-3 h-3" />
                        {retailMargin.pct} margin (৳{retailMargin.profit}/unit)
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 text-[11px]">—</span>
                    )}
                  </td>
                </tr>

                {/* 2. Wholesale Rate */}
                <tr className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">
                    Wholesale Price
                  </td>
                  <td className="py-2 px-4">
                    <div className="w-36">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={wholesalePack}
                        onChange={(e) => handleWholesalePackChange(e.target.value)}
                        placeholder="0.00"
                        isMonospace
                        inputSize="sm"
                        leftAdornment={<span className="text-xs font-bold text-slate-400 dark:text-slate-500">৳</span>}
                        className="text-right font-semibold"
                      />
                    </div>
                  </td>
                  {hasCartons && (
                    <td className="py-2 px-4 bg-emerald-50/20 dark:bg-emerald-950/10">
                      <div className="w-36">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={wholesaleCarton}
                          onChange={(e) => handleWholesaleCartonChange(e.target.value)}
                          placeholder="0.00"
                          isMonospace
                          inputSize="sm"
                          leftAdornment={<span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">৳</span>}
                          className="text-right font-semibold"
                        />
                      </div>
                    </td>
                  )}
                  <td className="py-2 px-4">
                    {wholesaleNum > 0 && retailNum > 0 ? (
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {(((retailNum - wholesaleNum) / retailNum) * 100).toFixed(1)}% trade discount
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 text-[11px]">—</span>
                    )}
                  </td>
                </tr>

                {/* 3. Buying Cost */}
                <tr className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-200">
                    Purchase Cost *
                  </td>
                  <td className="py-2 px-4">
                    <div className="w-36">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={buyingPack}
                        onChange={(e) => handleBuyingPackChange(e.target.value)}
                        placeholder="0.00"
                        isMonospace
                        inputSize="sm"
                        leftAdornment={<span className="text-xs font-bold text-slate-400 dark:text-slate-500">৳</span>}
                        className="text-right font-semibold"
                      />
                    </div>
                  </td>
                  {hasCartons && (
                    <td className="py-2 px-4 bg-emerald-50/20 dark:bg-emerald-950/10">
                      <div className="w-36">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={buyingCarton}
                          onChange={(e) => handleBuyingCartonChange(e.target.value)}
                          placeholder="0.00"
                          isMonospace
                          inputSize="sm"
                          leftAdornment={<span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">৳</span>}
                          className="text-right font-semibold"
                        />
                      </div>
                    </td>
                  )}
                  <td className="py-2 px-4">
                    <span className="text-slate-400 dark:text-slate-500 text-[11px]">Inwarding inventory cost</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── 4. Initial Stock on Hand (Proportional & Compact) ─── */}
        {/* ─── 4. Initial Stock on Hand (Proportional & Compact) ─── */}
        <div className="bg-slate-50/70 border border-slate-200/80 dark:bg-slate-800/40 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              4. Initial Stock on Hand (Optional)
            </span>
            {totalCalculatedStock > 0 && (
              <span className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                Total: {totalCalculatedStock} {newProdBaseUnit}s
                {parsedPack && (
                  <span className="font-sans font-semibold text-emerald-900 dark:text-emerald-200 ml-1.5">
                    ({parsedPack.formatTotal(totalCalculatedStock).combinedText} net)
                  </span>
                )}
              </span>
            )}
          </div>

          {hasCartons ? (
            <div className="flex flex-wrap items-center gap-3 pt-0.5">
              <div className="w-36">
                <Input
                  label="Cartons"
                  type="number"
                  min="0"
                  step="any"
                  value={stockCartons}
                  onChange={(e) => setStockCartons(e.target.value)}
                  placeholder="0"
                  isMonospace
                  inputSize="sm"
                  rightAdornment={<span className="text-xs text-slate-400 dark:text-slate-500 font-medium">ctn</span>}
                />
              </div>
              <span className="text-slate-400 dark:text-slate-500 font-bold text-base pt-5">+</span>
              <div className="w-36">
                <Input
                  label="Loose Units"
                  type="number"
                  min="0"
                  step="any"
                  value={stockLoose}
                  onChange={(e) => setStockLoose(e.target.value)}
                  placeholder="0"
                  isMonospace
                  inputSize="sm"
                  rightAdornment={<span className="text-xs text-slate-400 dark:text-slate-500 font-medium">units</span>}
                />
              </div>
              <span className="text-slate-400 dark:text-slate-500 font-bold text-base pt-5">=</span>
              <div className="pt-5">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">LOT-01:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {totalCalculatedStock} {newProdBaseUnit}s
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-44 pt-0.5">
              <Input
                label="Stock Quantity"
                type="number"
                min="0"
                step="any"
                value={stockSingle}
                onChange={(e) => setStockSingle(e.target.value)}
                placeholder="0"
                isMonospace
                inputSize="sm"
                rightAdornment={<span className="text-xs text-slate-400 dark:text-slate-500 font-medium">units</span>}
              />
            </div>
          )}
        </div>

        {/* ─── 5. Safety Stock & Reorder Alerts ─── */}
        <div className="bg-slate-50/70 border border-slate-200/80 dark:bg-slate-800/40 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Hash className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>5. Inventory Alerts & Safety Stock</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-0.5">
            <div className="w-48">
              <Input
                label="Min Stock Alert"
                type="number"
                min="0"
                value={newProdMinStock}
                onChange={(e) => setNewProdMinStock(e.target.value)}
                placeholder="5"
                isMonospace
                inputSize="sm"
                rightAdornment={<span className="text-xs text-slate-400 dark:text-slate-500 font-medium">units</span>}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md pt-3">
              Low-stock alerts will trigger in the POS counter when counter inventory reaches or drops below this count.
            </p>
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
            isLoading={isSavingProd}
            className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold px-6 shadow-sm cursor-pointer"
          >
            Save Product
          </Button>
        </div>
      </form>
    </div>
  )
}
