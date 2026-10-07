import { useState, useId } from "react"
import type { Product, LotEntryRequest } from "../types"
import { createLot } from "../api/endpoints"
import { calcWholesalePrice, getWholesaleSettings } from "../utils/wholesaleSettings"
import { getNextLotNumber } from "../utils/lotNumber"
import { Package, X, AlertTriangle, Loader2, Check } from "lucide-react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select"

export interface LotEntryModalProps {
  products: Product[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function LotEntryModal({
  products,
  isOpen,
  onClose,
  onSuccess,
}: LotEntryModalProps) {
  const selectedProductIdId = useId()
  const lotNumberId = useId()
  const entryDateId = useId()
  const expiryDateId = useId()
  const challanNoId = useId()
  const supplierNameId = useId()
  const quantityId = useId()
  const purchaseCostId = useId()
  const lotRetailPriceId = useId()
  const barcodeId = useId()

  const [selectedProductId, setSelectedProductId] = useState<number | "">("")
  const [lotNumber, setLotNumber] = useState<string>("")
  const [entryDate, setEntryDate] = useState<string>(
    () => new Date().toISOString().split("T")[0],
  )
  const [expiryDate, setExpiryDate] = useState<string>("")
  const [challanNo, setChallanNo] = useState<string>("")
  const [supplierName, setSupplierName] = useState<string>(
    "Agro Chemical Ltd.",
  )
  const [quantity, setQuantity] = useState<string>("")
  const [cartons, setCartons] = useState<string>("")
  const [loosePacks, setLoosePacks] = useState<string>("")
  const [purchaseCost, setPurchaseCost] = useState<string>("")
  const [lotRetailPrice, setLotRetailPrice] = useState<string>("")
  const [barcode, setBarcode] = useState<string>("")

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  const handleCartonsChange = (ctnStr: string) => {
    setCartons(ctnStr)
    const m = selectedProduct?.cartonMultiplier || 1
    const ctn = parseFloat(ctnStr) || 0
    const loose = parseFloat(loosePacks) || 0
    const total = (ctn * m) + loose
    setQuantity(total > 0 ? String(total) : "")
  }

  const handleLoosePacksChange = (looseStr: string) => {
    setLoosePacks(looseStr)
    const m = selectedProduct?.cartonMultiplier || 1
    const ctn = parseFloat(cartons) || 0
    const loose = parseFloat(looseStr) || 0
    const total = (ctn * m) + loose
    setQuantity(total > 0 ? String(total) : "")
  }

  const handleQuantityChange = (qtyStr: string) => {
    setQuantity(qtyStr)
    const m = selectedProduct?.cartonMultiplier || 1
    const total = parseFloat(qtyStr) || 0
    if (m > 1) {
      const ctn = Math.floor(total / m)
      const loose = Math.round((total % m) * 1000) / 1000
      setCartons(ctn > 0 ? String(ctn) : "")
      setLoosePacks(loose > 0 ? String(loose) : "")
    }
  }

  // Auto-fill prices and generate a suggested lot number when product changes
  const handleProductChange = (productIdStr: string) => {
    const id = productIdStr ? Number(productIdStr) : ""
    setSelectedProductId(id)
    setCartons("")
    setLoosePacks("")
    setQuantity("")
    const prod = products.find((p) => p.id === id)
    if (prod) {
      if (prod.companyName) {
        setSupplierName(prod.companyName)
      }
      setLotRetailPrice(String(prod.standardRetailPrice || ""))
      if (prod.buyingPrice) {
        setPurchaseCost(String(prod.buyingPrice))
      } else if (prod.standardWholesalePrice) {
        setPurchaseCost(String(Math.round(prod.standardWholesalePrice * 0.88)))
      }
      if (!lotNumber) {
        setLotNumber(getNextLotNumber((prod as any).lots || []))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!selectedProductId) {
      setErrorMessage("Please select a product")
      return
    }
    if (!lotNumber.trim()) {
      setErrorMessage("Lot number is required")
      return
    }
    if (!expiryDate) {
      setErrorMessage("Expiry date is required")
      return
    }
    const parsedQty = parseFloat(quantity)
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setErrorMessage("Quantity must be greater than 0")
      return
    }
    const cost = parseFloat(purchaseCost)
    const retail = parseFloat(lotRetailPrice)

    if (isNaN(cost) || cost <= 0) {
      setErrorMessage("Enter a valid purchase cost / buying price")
      return
    }
    if (isNaN(retail) || retail <= 0) {
      setErrorMessage("Enter a valid retail price")
      return
    }

    const wholesaleSettings = getWholesaleSettings()
    const wholesale = calcWholesalePrice(retail, wholesaleSettings)

    try {
      setIsSubmitting(true)
      const selectedProd = products.find((p) => p.id === Number(selectedProductId))
      const cleanCode = (selectedProd?.productCode || "").replace(/[^A-Za-z0-9]/g, "") || String(selectedProductId)
      const cleanLot = lotNumber.trim().replace(/^LOT-?/i, "") || "01"
      const resolvedBarcode = barcode.trim() || `${cleanCode}-${cleanLot}`

      const request: LotEntryRequest = {
        productId: Number(selectedProductId),
        lotNumber: lotNumber.trim(),
        entryDate: entryDate || undefined,
        expiryDate,
        purchaseCost: cost,
        lotRetailPrice: retail,
        lotWholesalePrice: wholesale,
        barcode: resolvedBarcode,
        supplierName: supplierName.trim() || "Syngenta Bangladesh Limited",
        challanNo: challanNo.trim() || undefined,
        quantity: parsedQty,
        location: "DOKAN",
      }

      await createLot(request)
      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Failed to save lot entry. Please try again.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full my-auto overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 dark:from-emerald-950 dark:to-emerald-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Package className="w-6 h-6" />
            <div>
              <h2 className="font-bold text-lg leading-tight">New Lot Entry</h2>
              <p className="text-xs text-emerald-100 dark:text-emerald-200 mt-0.5">
                Record the arrival and stock of a new lot from a supplier challan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/80 hover:text-white text-xl leading-none cursor-pointer p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-rose-950/60 border border-red-200 dark:border-rose-800 text-red-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Row 1: Product Selection */}
          <div>
            <label
              htmlFor={selectedProductIdId}
              className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1.5"
            >
              Select Product *
            </label>
            <Select
              value={selectedProductId ? String(selectedProductId) : ""}
              onValueChange={(val) => handleProductChange(val)}
            >
              <SelectTrigger id={selectedProductIdId} className="w-full bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 text-sm py-2.5">
                <SelectValue placeholder="-- Choose a product --" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nameEn} ({p.nameBn}) — {p.category} ({p.baseUnit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: Lot Number & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor={lotNumberId}
                className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1.5"
              >
                Lot Number *
              </label>
              <input
                id={lotNumberId}
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="e.g. LOT-01"
                required
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor={entryDateId}
                className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1.5"
              >
                Entry Date
              </label>
              <input
                id={entryDateId}
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor={expiryDateId}
                className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1.5"
              >
                Expiry Date *
              </label>
              <input
                id={expiryDateId}
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
                className="w-full bg-white dark:bg-slate-800 border-2 border-emerald-500/50 dark:border-emerald-500/70 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />
            </div>
          </div>

          {/* Row 3: Challan & Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={challanNoId}
                className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1.5"
              >
                Challan Number
              </label>
              <input
                id={challanNoId}
                type="text"
                value={challanNo}
                onChange={(e) => setChallanNo(e.target.value)}
                placeholder="e.g. CH-SYNG-1044"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor={supplierNameId}
                className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1.5"
              >
                Supplier
              </label>
              <input
                id={supplierNameId}
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Agro Chemical Ltd."
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Row 4: Quantity & Packaging Conversion */}
          <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-850/40 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <label
                htmlFor={quantityId}
                className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5"
              >
                <Package className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Quantity to Receive *</span>
              </label>
              {selectedProduct && (
                <div className="flex items-center gap-2">
                  {selectedProduct.packSize && (
                    <span className="text-[11px] font-medium text-emerald-900 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                      Formula: {selectedProduct.packSize}
                    </span>
                  )}
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    Base: {selectedProduct.baseUnit}
                  </span>
                </div>
              )}
            </div>

            {selectedProduct && (selectedProduct.cartonMultiplier || 1) > 1 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Cartons (কার্টুন) — {selectedProduct.cartonMultiplier} pcs/ctn
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={cartons}
                      onChange={(e) => handleCartonsChange(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Loose Units (খুচরা {selectedProduct.baseUnit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={loosePacks}
                      onChange={(e) => handleLoosePacksChange(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden tabular-nums"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label htmlFor={quantityId} className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Total Base Units (মোট ইউনিট — Inventory Record) *
                  </label>
                  <div className="relative">
                    <input
                      id={quantityId}
                      type="number"
                      min="0.001"
                      step="any"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      placeholder={`e.g. 80 ${selectedProduct.baseUnit}`}
                      required
                      className="w-full bg-white dark:bg-slate-800 border-2 border-emerald-600/60 dark:border-emerald-500/70 rounded-xl px-3.5 py-2 text-sm font-extrabold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden tabular-nums"
                    />
                    <span className="absolute right-3.5 top-2 text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                      {selectedProduct.baseUnit}
                    </span>
                  </div>
                </div>

                {parseFloat(quantity) > 0 && (
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium bg-emerald-100/60 dark:bg-emerald-950/50 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    📦 Breakdown: <strong className="font-bold">{parseFloat(quantity)} {selectedProduct.baseUnit}</strong> (
                    {Math.floor(parseFloat(quantity) / (selectedProduct.cartonMultiplier || 1))} Cartons
                    {parseFloat(quantity) % (selectedProduct.cartonMultiplier || 1) !== 0
                      ? ` + ${(parseFloat(quantity) % (selectedProduct.cartonMultiplier || 1)).toFixed(0)} Loose ${selectedProduct.baseUnit}`
                      : ""}
                    )
                  </p>
                )}
              </div>
            ) : (
              <div className="relative">
                <input
                  id={quantityId}
                  type="number"
                  min="0.001"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={`e.g. 50 ${selectedProduct?.baseUnit || "units"}`}
                  required
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-bold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden tabular-nums"
                />
                <span className="absolute right-3.5 top-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {selectedProduct?.baseUnit || "units"}
                </span>
              </div>
            )}
          </div>

          {/* Row 5: Pricing (Buying Price & Retail Price) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={purchaseCostId}
                className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1.5"
              >
                Buying Price (কেনা দাম) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-slate-500 dark:text-slate-400">৳</span>
                <input
                  id={purchaseCostId}
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-emerald-800 dark:text-emerald-400 focus:border-emerald-600 focus:outline-hidden tabular-nums"
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Supplier purchase rate per unit</p>
            </div>

            <div>
              <label
                htmlFor={lotRetailPriceId}
                className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1.5"
              >
                Retail Price (বিক্রয় মূল্য) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-slate-500 dark:text-slate-400">৳</span>
                <input
                  id={lotRetailPriceId}
                  type="number"
                  min="0"
                  step="0.01"
                  value={lotRetailPrice}
                  onChange={(e) => setLotRetailPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden tabular-nums"
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Counter selling rate (Wholesale derived via settings)</p>
            </div>
          </div>

          {/* Row 6: Custom Barcode (Optional) */}
          <div>
            <label
              htmlFor={barcodeId}
              className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-1"
            >
              Custom Barcode (optional)
            </label>
            <input
              id={barcodeId}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Leave blank to auto-generate scannable Code 128 sticker (e.g. 72598-01)"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden font-mono"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Lot</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
