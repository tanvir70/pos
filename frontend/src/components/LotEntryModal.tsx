import { useState, useId } from "react"
import type { Product, LotEntryRequest } from "../types"
import { createLot } from "../api/endpoints"

// BUSINESS DECISION: Incoming shipments calculate base units as (cartons * cartonMultiplier) + loose units.
// Shipments enter DOKAN store stock directly. Barcodes are synthesized
// automatically by backend if left blank.

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
  const quantityCartonsId = useId()
  const quantityBaseUnitsId = useId()
  const purchaseCostId = useId()
  const lotRetailPriceId = useId()
  const lotWholesalePriceId = useId()
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
  const [quantityCartons, setQuantityCartons] = useState<string>("")
  const [quantityBaseUnits, setQuantityBaseUnits] = useState<string>("")
  const [purchaseCost, setPurchaseCost] = useState<string>("")
  const [lotRetailPrice, setLotRetailPrice] = useState<string>("")
  const [lotWholesalePrice, setLotWholesalePrice] = useState<string>("")
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
      setLotWholesalePrice(String(prod.standardWholesalePrice || ""))
      // If purchase cost not set, give reasonable default based on wholesale price (~88%)
      if (!purchaseCost && prod.standardWholesalePrice) {
        setPurchaseCost(String(Math.round(prod.standardWholesalePrice * 0.88)))
      }
      if (!lotNumber) {
        const year = new Date().getFullYear()
        setLotNumber(`LOT-${year}-${prod.productCode.replace("SYN-", "")}`)
      }
    }
  }

  // Calculate live total base units
  const multiplier = Number(selectedProduct?.cartonMultiplier) || 1
  const cartons = parseFloat(quantityCartons) || 0
  const loose = parseFloat(quantityBaseUnits) || 0
  const totalBaseUnits = cartons * multiplier + loose

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!selectedProductId) {
      setErrorMessage("অনুগ্রহ করে একটি পণ্য নির্বাচন করুন (Select a Product)")
      return
    }
    if (!lotNumber.trim()) {
      setErrorMessage("লট নম্বর আবশ্যক (Lot Number is required)")
      return
    }
    if (!expiryDate) {
      setErrorMessage("মেয়াদ উত্তীর্ণের তারিখ আবশ্যক (Expiry Date is required)")
      return
    }
    if (totalBaseUnits <= 0) {
      setErrorMessage(
        "মোট পণ্যের পরিমাণ শূন্যের বেশি হতে হবে (Quantity must be > 0)",
      )
      return
    }
    const cost = parseFloat(purchaseCost)
    const retail = parseFloat(lotRetailPrice)
    const wholesale = parseFloat(lotWholesalePrice)

    if (isNaN(cost) || cost <= 0) {
      setErrorMessage("সঠিক কেনা দাম (Purchase Cost) লিখুন")
      return
    }
    if (isNaN(retail) || retail <= 0) {
      setErrorMessage("সঠিক খুচরা বিক্রয়মূল্য (Retail Price) লিখুন")
      return
    }
    if (isNaN(wholesale) || wholesale <= 0) {
      setErrorMessage("সঠিক পাইকারি বিক্রয়মূল্য (Wholesale Price) লিখুন")
      return
    }

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
        quantityCartons: cartons > 0 ? cartons : undefined,
        quantityBaseUnits: loose > 0 ? loose : undefined,
        location: "DOKAN",
      }

      await createLot(request)
      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMessage(
        err?.message || "লট এন্ট্রি সংরক্ষণে ত্রুটি হয়েছে। পুনরায় চেষ্টা করুন।",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-frost-border max-w-2xl w-full my-auto overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📦</span>
            <div>
              <h2 className="font-bold text-lg bn-text leading-tight">
                নতুন চালান / লট এন্ট্রি (New Lot Entry)
              </h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                কোম্পানির চালান থেকে নতুন লটের আগমন ও স্টক রেকর্ড করুন
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

          {/* Row 1: Product Selection */}
          <div>
            <label
              htmlFor={selectedProductIdId}
              className="block text-xs font-bold text-frost-dark bn-text mb-1.5"
            >
              পণ্য নির্বাচন করুন (Product) *
            </label>
            <select
              id={selectedProductIdId}
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              required
              className="w-full bg-white border-2 border-frost-border rounded-xl px-3.5 py-2.5 text-sm font-medium text-frost-dark focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden transition-all bn-text cursor-pointer"
            >
              <option value="">-- পণ্য বেছে নিন --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameBn} ({p.nameEn}) — {p.category} [১ কার্টনে{" "}
                  {p.cartonMultiplier} {p.baseUnit}]
                </option>
              ))}
            </select>
          </div>

          {/* Row 2: Lot Number & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor={lotNumberId}
                className="block text-xs font-bold text-frost-dark bn-text mb-1.5"
              >
                লট নম্বর (Lot No) *
              </label>
              <input
                id={lotNumberId}
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="যেমন: LOT-2026-05"
                required
                className="w-full bg-white border border-frost-border rounded-xl px-3 py-2 text-sm font-semibold text-frost-dark focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor={entryDateId}
                className="block text-xs font-bold text-frost-dark bn-text mb-1.5"
              >
                চালান আসার তারিখ (Entry Date)
              </label>
              <input
                id={entryDateId}
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full bg-white border border-frost-border rounded-xl px-3 py-2 text-sm text-frost-dark focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor={expiryDateId}
                className="block text-xs font-bold text-frost-dark bn-text mb-1.5"
              >
                মেয়াদ উত্তীর্ণ (Expiry Date) *
              </label>
              <input
                id={expiryDateId}
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
                className="w-full bg-white border-2 border-emerald-500/50 rounded-xl px-3 py-2 text-sm font-semibold text-frost-dark focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />
            </div>
          </div>

          {/* Row 3: Challan & Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={challanNoId}
                className="block text-xs font-bold text-frost-dark bn-text mb-1.5"
              >
                চালান নম্বর (Challan No)
              </label>
              <input
                id={challanNoId}
                type="text"
                value={challanNo}
                onChange={(e) => setChallanNo(e.target.value)}
                placeholder="যেমন: CH-SYNG-1044"
                className="w-full bg-white border border-frost-border rounded-xl px-3 py-2 text-sm text-frost-dark focus:border-emerald-600 focus:outline-hidden tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor={supplierNameId}
                className="block text-xs font-bold text-frost-dark bn-text mb-1.5"
              >
                সরবরাহকারী (Supplier)
              </label>
              <input
                id={supplierNameId}
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Agro Chemical Ltd."
                className="w-full bg-white border border-frost-border rounded-xl px-3 py-2 text-sm text-frost-dark focus:border-emerald-600 focus:outline-hidden bn-text"
              />
            </div>
          </div>

          {/* Row 4: Carton Multiplier Quantity & Live Calculation */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 bn-text flex items-center gap-1.5">
                <span>🧮</span>
                <span>পরিমাণ এন্ট্রি ও স্বয়ংক্রিয় বেস ইউনিট হিসাব</span>
              </span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200 bn-text">
                ১ কার্টন = {multiplier} {selectedProduct?.baseUnit || "ইউনিট"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor={quantityCartonsId}
                  className="block text-xs font-semibold text-frost-dark bn-text mb-1"
                >
                  কার্টন সংখ্যা (Cartons)
                </label>
                <div className="relative">
                  <input
                    id={quantityCartonsId}
                    type="number"
                    min="0"
                    step="1"
                    value={quantityCartons}
                    onChange={(e) => setQuantityCartons(e.target.value)}
                    placeholder="০ কার্টন"
                    className="w-full bg-white border border-frost-border rounded-xl px-3 py-2 text-base font-bold text-frost-dark focus:border-emerald-600 focus:outline-hidden tabular-nums"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-frost-muted bn-text">
                    কার্টন
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor={quantityBaseUnitsId}
                  className="block text-xs font-semibold text-frost-dark bn-text mb-1"
                >
                  খুচরা ইউনিট (Loose Units)
                </label>
                <div className="relative">
                  <input
                    id={quantityBaseUnitsId}
                    type="number"
                    min="0"
                    step="1"
                    value={quantityBaseUnits}
                    onChange={(e) => setQuantityBaseUnits(e.target.value)}
                    placeholder="০ বোতল / প্যাকেট"
                    className="w-full bg-white border border-frost-border rounded-xl px-3 py-2 text-base font-bold text-frost-dark focus:border-emerald-600 focus:outline-hidden tabular-nums"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-frost-muted bn-text">
                    {selectedProduct?.baseUnit || "ইউনিট"}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Calculation Formula Badge */}
            <div className="bg-white rounded-lg p-2.5 border border-emerald-200/80 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-emerald-900 bn-text">
                মোট সংরক্ষিত হবে:
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-frost-muted tabular-nums">
                  ({cartons} × {multiplier}) + {loose} =
                </span>
                <span className="text-sm font-black text-emerald-700 tabular-nums bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300">
                  {totalBaseUnits} {selectedProduct?.baseUnit || "বোতল/প্যাকেট"}
                </span>
              </div>
            </div>
          </div>

          {/* Row 5: Pricing (Purchase Cost, Retail Price, Wholesale Price) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor={purchaseCostId}
                className="block text-xs font-bold text-frost-dark bn-text mb-1.5"
              >
                কেনা দাম (Purchase Cost) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-frost-muted">
                  ৳
                </span>
                <input
                  id={purchaseCostId}
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  placeholder="০.০০"
                  required
                  className="w-full bg-white border border-frost-border rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-emerald-800 focus:border-emerald-600 focus:outline-hidden tabular-nums"
                />
              </div>
              <p className="text-[10px] text-frost-muted bn-text mt-0.5">
                প্রতি ইউনিটের কেনা খরচ
              </p>
            </div>

            <div>
              <label
                htmlFor={lotRetailPriceId}
                className="block text-xs font-bold text-frost-dark bn-text mb-1.5"
              >
                খুচরা মূল্য (Retail Price) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-frost-muted">
                  ৳
                </span>
                <input
                  id={lotRetailPriceId}
                  type="number"
                  min="0"
                  step="0.01"
                  value={lotRetailPrice}
                  onChange={(e) => setLotRetailPrice(e.target.value)}
                  placeholder="০.০০"
                  required
                  className="w-full bg-white border border-frost-border rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-frost-dark focus:border-emerald-600 focus:outline-hidden tabular-nums"
                />
              </div>
              <p className="text-[10px] text-frost-muted bn-text mt-0.5">
                কাউন্টারে বিক্রয় মূল্য
              </p>
            </div>

            <div>
              <label
                htmlFor={lotWholesalePriceId}
                className="block text-xs font-bold text-frost-dark bn-text mb-1.5"
              >
                পাইকারি মূল্য (Wholesale Price) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-frost-muted">
                  ৳
                </span>
                <input
                  id={lotWholesalePriceId}
                  type="number"
                  min="0"
                  step="0.01"
                  value={lotWholesalePrice}
                  onChange={(e) => setLotWholesalePrice(e.target.value)}
                  placeholder="০.০০"
                  required
                  className="w-full bg-white border border-frost-border rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-frost-dark focus:border-emerald-600 focus:outline-hidden tabular-nums"
                />
              </div>
              <p className="text-[10px] text-frost-muted bn-text mt-0.5">
                ডিলার / পাইকারি রেট
              </p>
            </div>
          </div>

          {/* Row 6: Custom Barcode (Optional) */}
          <div>
            <label
              htmlFor={barcodeId}
              className="block text-xs font-bold text-frost-dark bn-text mb-1"
            >
              কাস্টম বারকোড (Custom Barcode - ঐচ্ছিক)
            </label>
            <input
              id={barcodeId}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="খালি রাখলে স্বয়ংক্রিয় SYN-<CODE>-<LOT> তৈরি হবে"
              className="w-full bg-white border border-frost-border rounded-xl px-3 py-2 text-xs text-frost-dark focus:border-emerald-600 focus:outline-hidden font-mono"
            />
          </div>

          {/* Footer Actions */}
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
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer bn-text transition-colors shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>লট সংরক্ষণ করুন (Save Lot)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
