import { useState, useId } from "react"
import type { Product, LotEntryRequest } from "../types"
import { createLot } from "../api/endpoints"
import { calcWholesalePrice, getWholesaleSettings } from "../utils/wholesaleSettings"
import { Package, X, AlertTriangle, Loader2, Check } from "lucide-react"

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
  const [purchaseCost, setPurchaseCost] = useState<string>("")
  const [lotRetailPrice, setLotRetailPrice] = useState<string>("")
  const [barcode, setBarcode] = useState<string>("")

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  // Auto-fill prices and generate a suggested lot number when product changes
  const handleProductChange = (productIdStr: string) => {
    const id = productIdStr ? Number(productIdStr) : ""
    setSelectedProductId(id)
    const prod = products.find((p) => p.id === id)
    if (prod) {
      setLotRetailPrice(String(prod.standardRetailPrice || ""))
      if (prod.buyingPrice) {
        setPurchaseCost(String(prod.buyingPrice))
      } else if (prod.standardWholesalePrice) {
        setPurchaseCost(String(Math.round(prod.standardWholesalePrice * 0.88)))
      }
      if (!lotNumber) {
        const year = new Date().getFullYear()
        setLotNumber(`LOT-${year}-${prod.productCode.replace("SYN-", "")}`)
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
      const request: LotEntryRequest = {
        productId: Number(selectedProductId),
        lotNumber: lotNumber.trim(),
        entryDate: entryDate || undefined,
        expiryDate,
        purchaseCost: cost,
        lotRetailPrice: retail,
        lotWholesalePrice: wholesale,
        barcode: barcode.trim() || undefined,
        supplierName: supplierName.trim() || "Agro Chemical Ltd.",
        challanNo: challanNo.trim() || undefined,
        quantityBaseUnits: parsedQty,
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full my-auto overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Package className="w-6 h-6" />
            <div>
              <h2 className="font-bold text-lg leading-tight">New Lot Entry</h2>
              <p className="text-xs text-emerald-100 mt-0.5">
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
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Row 1: Product Selection */}
          <div>
            <label
              htmlFor={selectedProductIdId}
              className="block text-xs font-bold text-slate-900 mb-1.5"
            >
              Select Product *
            </label>
            <select
              id={selectedProductIdId}
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              required
              className="w-full bg-white border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden transition-all cursor-pointer"
            >
              <option value="">-- Choose a product --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameEn} ({p.nameBn}) — {p.category} ({p.baseUnit})
                </option>
              ))}
            </select>
          </div>

          {/* Row 2: Lot Number & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor={lotNumberId}
                className="block text-xs font-bold text-slate-900 mb-1.5"
              >
                Lot Number *
              </label>
              <input
                id={lotNumberId}
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="e.g. LOT-2026-05"
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor={entryDateId}
                className="block text-xs font-bold text-slate-900 mb-1.5"
              >
                Entry Date
              </label>
              <input
                id={entryDateId}
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor={expiryDateId}
                className="block text-xs font-bold text-slate-900 mb-1.5"
              >
                Expiry Date *
              </label>
              <input
                id={expiryDateId}
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
                className="w-full bg-white border-2 border-emerald-500/50 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />
            </div>
          </div>

          {/* Row 3: Challan & Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={challanNoId}
                className="block text-xs font-bold text-slate-900 mb-1.5"
              >
                Challan Number
              </label>
              <input
                id={challanNoId}
                type="text"
                value={challanNo}
                onChange={(e) => setChallanNo(e.target.value)}
                placeholder="e.g. CH-SYNG-1044"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor={supplierNameId}
                className="block text-xs font-bold text-slate-900 mb-1.5"
              >
                Supplier
              </label>
              <input
                id={supplierNameId}
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Agro Chemical Ltd."
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Row 4: Quantity Entry */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor={quantityId}
                className="text-xs font-bold text-emerald-900 flex items-center gap-1.5"
              >
                <Package className="w-4 h-4 text-emerald-700" />
                <span>Quantity to Receive *</span>
              </label>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                Packaging: {selectedProduct?.baseUnit || "Unit"}
              </span>
            </div>

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
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />
              <span className="absolute right-3.5 top-3 text-xs font-semibold text-slate-500">
                {selectedProduct?.baseUnit || "units"}
              </span>
            </div>
          </div>

          {/* Row 5: Pricing (Buying Price & Retail Price) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={purchaseCostId}
                className="block text-xs font-bold text-slate-900 mb-1.5"
              >
                Buying Price (কেনা দাম) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-slate-500">৳</span>
                <input
                  id={purchaseCostId}
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-emerald-800 focus:border-emerald-600 focus:outline-hidden tabular-nums"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Supplier purchase rate per unit</p>
            </div>

            <div>
              <label
                htmlFor={lotRetailPriceId}
                className="block text-xs font-bold text-slate-900 mb-1.5"
              >
                Retail Price (বিক্রয় মূল্য) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-slate-500">৳</span>
                <input
                  id={lotRetailPriceId}
                  type="number"
                  min="0"
                  step="0.01"
                  value={lotRetailPrice}
                  onChange={(e) => setLotRetailPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-hidden tabular-nums"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Counter selling rate (Wholesale derived via settings)</p>
            </div>
          </div>

          {/* Row 6: Custom Barcode (Optional) */}
          <div>
            <label
              htmlFor={barcodeId}
              className="block text-xs font-bold text-slate-900 mb-1"
            >
              Custom Barcode (optional)
            </label>
            <input
              id={barcodeId}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Leave blank to auto-generate SYN-<CODE>-<LOT>"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden font-mono"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
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
