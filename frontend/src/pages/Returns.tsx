import { useState, useEffect, useMemo, useCallback } from "react"
import type {
  StockItem,
  Customer,
  SaleReturnRequest,
  SaleReturnResponse,
  SaleResponse,
  RefundType,
} from "../types"
import {
  getStock,
  getCustomers,
  createReturn,
  getRecentReturns,
  getSaleByInvoice,
} from "../api/endpoints"

// BUSINESS DECISION: Direct chemical returns support receipt-less processing without an original invoice number
// because rural farmers frequently misplace paper receipts over 15-30 day spraying seasons.
// BUSINESS DECISION: When 'isDamaged' (নষ্ট / ক্ষতিগ্রস্ত) is selected, goods are flagged for quarantine and
// excluded from sellable counter stock to prevent accidental dispensing of compromised chemicals.
// BUSINESS DECISION: Due adjustment refunds strictly require customer profile association to guarantee correct
// credit reduction in the customer ledger.

export interface ReturnsProps {
  isOwner: boolean
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Returns({ isOwner }: ReturnsProps) {
  // ─── Remote Data State ──────────────────────────────────────────
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [recentReturns, setRecentReturns] = useState<SaleReturnResponse[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // ─── Form State ─────────────────────────────────────────────────
  const [invoiceInput, setInvoiceInput] = useState<string>("")
  const [isSearchingInvoice, setIsSearchingInvoice] = useState<boolean>(false)
  const [invoiceSearchError, setInvoiceSearchError] = useState<string | null>(null)
  const [foundSale, setFoundSale] = useState<SaleResponse | null>(null)

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null)
  const [productSearch, setProductSearch] = useState<string>("")
  const [quantity, setQuantity] = useState<string>("1")
  const [refundPrice, setRefundPrice] = useState<string>("")
  const [isDamaged, setIsDamaged] = useState<boolean>(false)
  const [refundType, setRefundType] = useState<RefundType>("CASH_REFUND")
  const [reason, setReason] = useState<string>("")

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Voucher / Confirmation Modal
  const [completedReturn, setCompletedReturn] = useState<SaleReturnResponse | null>(null)
  const [viewingReturn, setViewingReturn] = useState<SaleReturnResponse | null>(null)

  // Returns List Search
  const [returnsSearch, setReturnsSearch] = useState<string>("")

  // ─── Data Loading ───────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const [stockData, customerData, returnsData] = await Promise.all([
        getStock(),
        getCustomers(),
        getRecentReturns(50),
      ])
      setStocks(stockData)
      setCustomers(customerData)
      setRecentReturns(returnsData)
    } catch (err: any) {
      setErrorMessage(err?.message || "ডেটা লোড করতে ব্যর্থ হয়েছে।")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Clear success notification
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Selected Stock Item details
  const selectedStockItem = useMemo(() => {
    if (!selectedLotId) return null
    return stocks.find((s) => s.lotId === selectedLotId) || null
  }, [stocks, selectedLotId])

  // When selectedStockItem changes, auto-fill refundPrice if empty
  const handleSelectLot = (lotId: number) => {
    setSelectedLotId(lotId)
    const item = stocks.find((s) => s.lotId === lotId)
    if (item) {
      // Auto-set refund rate to lot retail price by default
      setRefundPrice(item.lotRetailPrice.toString())
    }
  }

  // Filtered stock items for selector
  const filteredStockOptions = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return stocks.slice(0, 15)
    return stocks
      .filter((s) => {
        const matchNameEn = (s.nameEn || s.productNameEn || "").toLowerCase().includes(q)
        const matchNameBn = (s.nameBn || s.productNameBn || "").toLowerCase().includes(q)
        const matchCode = (s.productCode || "").toLowerCase().includes(q)
        const matchLot = (s.lotNumber || "").toLowerCase().includes(q)
        const matchBarcode = (s.lotBarcode || s.barcode || "").toLowerCase().includes(q)
        return matchNameEn || matchNameBn || matchCode || matchLot || matchBarcode
      })
      .slice(0, 20)
  }, [stocks, productSearch])

  // ─── Invoice Lookup Action ──────────────────────────────────────
  const handleSearchInvoice = async () => {
    const trimmed = invoiceInput.trim()
    if (!trimmed) {
      setInvoiceSearchError("অনুগ্রহ করে মেমো / ইনভয়েস নম্বর লিখুন।")
      return
    }

    try {
      setIsSearchingInvoice(true)
      setInvoiceSearchError(null)
      const sale = await getSaleByInvoice(trimmed)
      setFoundSale(sale)

      // Auto-select customer if sale had one
      if (sale.customerId) {
        setSelectedCustomerId(sale.customerId)
      }

      // If sale had items, select the first item's lot
      if (sale.items && sale.items.length > 0) {
        const first = sale.items[0]
        setSelectedLotId(first.lotId)
        setRefundPrice(first.unitPrice.toString())
        setQuantity("1")
      }
    } catch (err: any) {
      setFoundSale(null)
      setInvoiceSearchError("এই ইনভয়েস নম্বরটি পাওয়া যায়নি। আপনি বিনা রশিদে সরাসরি রিটার্ন করতে পারেন।")
    } finally {
      setIsSearchingInvoice(false)
    }
  }

  const handleClearInvoice = () => {
    setInvoiceInput("")
    setFoundSale(null)
    setInvoiceSearchError(null)
  }

  // ─── Return Submission ──────────────────────────────────────────
  const calculatedTotalRefund = useMemo(() => {
    const q = parseFloat(quantity) || 0
    const r = parseFloat(refundPrice) || 0
    return q * r
  }, [quantity, refundPrice])

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedLotId) {
      setFormError("অনুগ্রহ করে যে পণ্যটি ফেরত নেওয়া হচ্ছে তা নির্বাচন করুন।")
      return
    }

    const qtyNum = parseFloat(quantity)
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setFormError("সঠিক ফেরত পরিমাণ লিখুন।")
      return
    }

    const priceNum = parseFloat(refundPrice)
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError("সঠিক ফেরত মূল্য নির্ধারণ করুন।")
      return
    }

    if (refundType === "DUE_ADJUSTMENT" && !selectedCustomerId) {
      setFormError("বাকি সমন্বয় করতে অবশ্যই একজন গ্রাহক নির্বাচন করতে হবে।")
      return
    }

    try {
      setIsSubmitting(true)
      setFormError(null)

      const payload: SaleReturnRequest = {
        originalSaleId: foundSale?.id ?? null,
        customerId: selectedCustomerId,
        refundType,
        reason: reason.trim() || (isDamaged ? "নষ্ট / ক্ষতিগ্রস্ত কেমিক্যাল" : "গ্রাহক ফেরত"),
        items: [
          {
            lotId: selectedLotId,
            quantity: qtyNum,
            refundPrice: priceNum,
            isDamaged,
          },
        ],
      }

      const res = await createReturn(payload)
      setCompletedReturn(res)
      setSuccessMessage(`ফেরত ভাউচার নং ${res.returnNo} সফলভাবে তৈরি হয়েছে!`)

      // Reset form
      setSelectedLotId(null)
      setQuantity("1")
      setRefundPrice("")
      setIsDamaged(false)
      setReason("")
      setFoundSale(null)
      setInvoiceInput("")

      // Refresh list & stock
      await loadData()
    } catch (err: any) {
      setFormError(err?.message || "পণ্য ফেরত প্রক্রিয়ায় ত্রুটি হয়েছে।")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Filtered Recent Returns ────────────────────────────────────
  const filteredRecentReturns = useMemo(() => {
    const q = returnsSearch.trim().toLowerCase()
    if (!q) return recentReturns
    return recentReturns.filter((r) => {
      const matchNo = r.returnNo?.toLowerCase().includes(q)
      const matchCust = r.customerName?.toLowerCase().includes(q)
      const matchReason = r.reason?.toLowerCase().includes(q)
      return matchNo || matchCust || matchReason
    })
  }, [recentReturns, returnsSearch])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-frost-dark bn-text flex items-center gap-2">
            <span>🔄</span>
            <span>পণ্য ফেরত কাউন্টার (Sales Return Counter)</span>
          </h1>
          <p className="text-xs sm:text-sm text-frost-muted bn-text mt-0.5">
            বিনা রশিদে বা মেমো নম্বরে রাসায়নিক ফেরত গ্রহণ, ক্ষতিগ্রস্ত বোতল কোয়ারেন্টাইন ও বাকি সমন্বয়
          </p>
        </div>
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs sm:text-sm font-semibold bn-text flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="cursor-pointer text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs sm:text-sm font-semibold bn-text flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="cursor-pointer text-red-600 hover:text-red-900">✕</button>
        </div>
      )}

      {/* Main Grid: Left Return Form, Right Recent Returns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Return Form (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-frost-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-frost-border">
            <div className="flex items-center gap-2">
              <span className="text-lg">📝</span>
              <h2 className="font-bold text-frost-dark bn-text text-base sm:text-lg">
                নতুন পণ্য ফেরত ফরম (Direct Return)
              </h2>
            </div>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full bn-text">
              বিনা রশিদে গ্রহণযোগ্য
            </span>
          </div>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs font-semibold bn-text flex items-center gap-2">
              <span>⚠️</span>
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitReturn} className="space-y-4">
            {/* 1. Optional Invoice Search Box */}
            <div className="bg-frost-surface/40 p-3 rounded-xl border border-frost-border">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-frost-dark bn-text flex items-center gap-1.5">
                  <span>🧾</span>
                  <span>মূল বিক্রয় মেমো / ইনভয়েস নং (ঐচ্ছিক)</span>
                </label>
                {foundSale && (
                  <button
                    type="button"
                    onClick={handleClearInvoice}
                    className="text-[11px] text-red-600 hover:underline cursor-pointer bn-text"
                  >
                    রসিদ তথ্য মুছুন
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={invoiceInput}
                  onChange={(e) => {
                    setInvoiceInput(e.target.value)
                    setInvoiceSearchError(null)
                  }}
                  placeholder="যেমন: INV-20260917-1042 (রসিদ না থাকলেও ফেরত নেওয়া যাবে)"
                  className="flex-1 px-3 py-1.5 border border-frost-border rounded-lg text-xs sm:text-sm bg-white font-mono"
                />
                <button
                  type="button"
                  onClick={handleSearchInvoice}
                  disabled={isSearchingInvoice || !invoiceInput.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-frost-surface hover:bg-frost-hover border border-frost-border text-frost-dark transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bn-text whitespace-nowrap"
                >
                  {isSearchingInvoice ? "খোঁজা হচ্ছে..." : "রসিদ খুঁজুন"}
                </button>
              </div>

              {invoiceSearchError && (
                <p className="text-xs text-amber-700 font-medium bn-text mt-1.5">
                  {invoiceSearchError}
                </p>
              )}

              {foundSale && (
                <div className="mt-2.5 pt-2 border-t border-frost-border/60 text-xs bg-emerald-50/50 p-2 rounded-lg text-emerald-900 bn-text">
                  <div className="flex justify-between font-bold">
                    <span>মেমো নং: {foundSale.invoiceNo}</span>
                    <span>মোট বিল: {tk(foundSale.totalAmount)}</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    তারিখ: {new Date(foundSale.saleDate).toLocaleDateString("bn-BD")} | গ্রাহক:{" "}
                    {foundSale.customerName || "খুচরা ক্রেতা"}
                  </p>
                </div>
              )}
            </div>

            {/* 2. Customer Selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-frost-dark bn-text">
                  গ্রাহক নির্বাচন {refundType === "DUE_ADJUSTMENT" ? "*" : "(নগদ ফেরতের জন্য ঐচ্ছিক)"}
                </label>
                {selectedCustomerId && (
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerId(null)}
                    className="text-[11px] text-frost-muted hover:text-red-600 cursor-pointer bn-text"
                  >
                    বাদ দিন
                  </button>
                )}
              </div>
              <select
                value={selectedCustomerId || ""}
                onChange={(e) =>
                  setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full px-3 py-2 border border-frost-border rounded-lg text-xs sm:text-sm bn-text bg-white"
              >
                <option value="">-- সাধারণ গ্রাহক / ওয়াক-ইন ক্রেতা (নগদ ফেরত) --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.businessName ? `(${c.businessName})` : ""} - বাকি: {tk(c.currentDue)}
                  </option>
                ))}
              </select>
              {refundType === "DUE_ADJUSTMENT" && !selectedCustomerId && (
                <p className="text-[11px] text-red-600 font-medium bn-text mt-1">
                  ⚠️ বাকি সমন্বয় করতে গ্রাহক নির্বাচন করা বাধ্যতামূলক।
                </p>
              )}
            </div>

            {/* 3. Product & Lot Selection */}
            <div>
              <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                ফেরতযোগ্য কীটনাশক বা পণ্য ও লট নির্বাচন *
              </label>

              {/* Quick search input */}
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="পণ্যের নাম, কোড বা লট নম্বর দিয়ে ফিল্টার করুন..."
                className="w-full px-3 py-1.5 mb-2 border border-frost-border rounded-lg text-xs bg-frost-surface/30 bn-text"
              />

              <div className="border border-frost-border rounded-xl max-h-48 overflow-y-auto divide-y divide-frost-border/60">
                {filteredStockOptions.map((item) => {
                  const isSelected = selectedLotId === item.lotId
                  return (
                    <button
                      key={item.lotId}
                      type="button"
                      onClick={() => handleSelectLot(item.lotId)}
                      className={`w-full text-left p-2.5 transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-emerald-50 border-l-4 border-emerald-600"
                          : "hover:bg-frost-surface/60"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-frost-dark bn-text text-xs sm:text-sm">
                          {item.nameBn || item.productNameBn} ({item.nameEn || item.productNameEn})
                        </div>
                        <div className="text-[11px] text-frost-muted mt-0.5 flex items-center gap-2">
                          <span className="font-mono font-semibold text-frost-dark">
                            লট: {item.lotNumber}
                          </span>
                          <span>•</span>
                          <span>মেয়াদ: {item.expiryDate}</span>
                          <span>•</span>
                          <span>একক: {item.baseUnit}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-frost-dark tabular-nums">
                          {tk(item.lotRetailPrice)}
                        </div>
                        <div className="text-[10px] text-frost-muted">
                          মজুদ: {item.totalQuantity} {item.baseUnit}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {selectedStockItem && (
                <div className="mt-2 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex justify-between items-center bn-text">
                  <div>
                    <span className="font-bold">নির্বাচিত:</span> {selectedStockItem.nameBn} (লট: {selectedStockItem.lotNumber})
                  </div>
                  <span className="font-semibold text-[11px]">
                    বর্তমান মজুদ: {selectedStockItem.quantity} {selectedStockItem.baseUnit}
                  </span>
                </div>
              )}
            </div>

            {/* 4. Quantity & Refund Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                  ফেরত পরিমাণ ({selectedStockItem?.baseUnit || "একক"}) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="১"
                  className="w-full px-3 py-2 border border-frost-border rounded-lg text-sm tabular-nums font-bold focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                  প্রতি একক ফেরত মূল্য (৳) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={refundPrice}
                  onChange={(e) => setRefundPrice(e.target.value)}
                  placeholder="০.০০"
                  className="w-full px-3 py-2 border border-frost-border rounded-lg text-sm tabular-nums font-bold focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* 5. Damaged Chemical Checkbox */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDamaged}
                  onChange={(e) => setIsDamaged(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-amber-900 bn-text">
                    নষ্ট / ক্ষতিগ্রস্ত কেমিক্যাল (Damaged - Quarantine)
                  </span>
                  <p className="text-[11px] text-amber-800/80 bn-text mt-0.5">
                    বোতল ফুটো, সীল খোলা বা মেয়াদোত্তীর্ণ রাসায়নিক বিক্রির স্টকে যোগ হবে না; আলাদা কোয়ারেন্টাইনে জমা থাকবে।
                  </p>
                </div>
              </label>
            </div>

            {/* 6. Refund Type */}
            <div>
              <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                ফেরত প্রদানের ধরণ *
              </label>
              <select
                value={refundType}
                onChange={(e) => setRefundType(e.target.value as RefundType)}
                className="w-full px-3 py-2 border border-frost-border rounded-lg text-xs sm:text-sm bn-text bg-white"
              >
                <option value="CASH_REFUND">💵 নগদ ফেরত (Cash Refund from Till)</option>
                <option value="DUE_ADJUSTMENT">📒 বাকি সমন্বয় (Customer Due Adjustment)</option>
              </select>
            </div>

            {/* 7. Reason */}
            <div>
              <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                ফেরতের কারণ
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="যেমন: কীটনাশক প্রয়োগের পর বোতল অবিক্রীত / চাষীর প্রয়োজন শেষ"
                className="w-full px-3 py-2 border border-frost-border rounded-lg text-xs sm:text-sm bn-text"
              />
            </div>

            {/* 8. Total Summary & Submit Button */}
            <div className="pt-3 border-t border-frost-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs text-frost-muted bn-text">মোট প্রদেয় ফেরত:</span>
                <div className="text-2xl font-bold text-frost-dark tabular-nums">
                  {tk(calculatedTotalRefund)}
                </div>
                <span className="text-[11px] text-emerald-700 font-medium bn-text">
                  {refundType === "CASH_REFUND" ? "ক্যাশ ড্রয়ার থেকে নগদ পরিশোধ হবে" : "গ্রাহকের বাকি খাতা থেকে বিয়োগ হবে"}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedLotId}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bn-text text-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>প্রসেসিং হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <span>✅</span>
                    <span>ফেরত সম্পন্ন করুন ও ভাউচার তৈরি করুন</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Recent Returns History (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-frost-border rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-frost-border">
            <div className="flex items-center gap-2">
              <span className="text-lg">📜</span>
              <h2 className="font-bold text-frost-dark bn-text text-base">
                সাম্প্রতিক ফেরত তালিকা (Recent Returns)
              </h2>
            </div>
            <span className="text-xs text-frost-muted tabular-nums">
              {recentReturns.length} টি
            </span>
          </div>

          {/* Search Box */}
          <div>
            <input
              type="text"
              value={returnsSearch}
              onChange={(e) => setReturnsSearch(e.target.value)}
              placeholder="ভাউচার নং বা গ্রাহক নাম দিয়ে খুঁজুন..."
              className="w-full px-3 py-1.5 border border-frost-border rounded-lg text-xs bn-text"
            />
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-frost-muted bn-text">
              <span className="text-2xl animate-spin inline-block mb-1">⏳</span>
              <p className="text-xs">লোড হচ্ছে...</p>
            </div>
          ) : filteredRecentReturns.length === 0 ? (
            <div className="py-12 text-center text-frost-muted bn-text border border-dashed border-frost-border rounded-xl">
              <p className="text-xs font-semibold">কোনো ফেরত পাওয়া যায়নি।</p>
            </div>
          ) : (
            <div className="divide-y divide-frost-border/60 max-h-[520px] overflow-y-auto">
              {filteredRecentReturns.map((ret) => (
                <div key={ret.id} className="py-3 px-1 hover:bg-frost-surface/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-frost-dark">
                        {ret.returnNo}
                      </span>
                      <p className="text-xs font-semibold text-frost-dark bn-text mt-0.5">
                        {ret.customerName ? `👤 ${ret.customerName}` : "ওয়াক-ইন নগদ ফেরত"}
                      </p>
                      <p className="text-[11px] text-frost-muted mt-0.5">
                        তারিখ: {new Date(ret.returnDate).toLocaleDateString("bn-BD")}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold tabular-nums text-emerald-800">
                        {tk(ret.totalRefundAmount)}
                      </div>
                      <span
                        className={`inline-block mt-0.5 px-2 py-0.2 rounded text-[10px] font-bold bn-text ${
                          ret.refundType === "DUE_ADJUSTMENT"
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {ret.refundType === "DUE_ADJUSTMENT" ? "বাকি সমন্বয়" : "নগদ ফেরত"}
                      </span>
                    </div>
                  </div>

                  {ret.reason && (
                    <p className="text-[11px] text-frost-muted italic bn-text mt-1.5">
                      কারণ: {ret.reason}
                    </p>
                  )}

                  {/* View Voucher Action */}
                  <div className="mt-2 text-right">
                    <button
                      onClick={() => setViewingReturn(ret)}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer bn-text"
                    >
                      ভাউচার দেখুন ও প্রিন্ট করুন 🖨️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Completed / View Return Voucher Modal ───────────────────── */}
      {(completedReturn || viewingReturn) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          {(() => {
            const voucher = completedReturn || viewingReturn!
            return (
              <div className="bg-white rounded-2xl shadow-2xl border border-frost-border max-w-md w-full p-6 print:m-0 print:p-0 print:border-none print:shadow-none print-area">
                {/* Actions Header (hidden on print) */}
                <div className="flex items-center justify-between pb-3 border-b border-frost-border no-print">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl">✅</span>
                    <h3 className="font-bold text-frost-dark bn-text text-base">
                      ফেরত ভাউচার (Return Voucher)
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setCompletedReturn(null)
                      setViewingReturn(null)
                    }}
                    className="text-frost-muted hover:text-frost-dark text-lg leading-none cursor-pointer p-1"
                  >
                    ✕
                  </button>
                </div>

                {/* Printable Slip Content */}
                <div className="py-3 text-center border-b border-dashed border-frost-border">
                  <h2 className="text-lg font-bold text-frost-dark bn-text">
                    আল-আমিন ট্রেডার্স
                  </h2>
                  <p className="text-xs text-frost-muted bn-text">
                    সিনজেনটা ডিলার · উত্তর বাজার, বেলাবো, নরসিংদী
                  </p>
                  <div className="inline-block mt-1 px-2.5 py-0.5 rounded bg-frost-surface border border-frost-border text-xs font-bold text-frost-dark bn-text">
                    বিক্রয় ফেরত ভাউচার (Credit Note)
                  </div>
                </div>

                {/* Voucher Meta */}
                <div className="py-2.5 text-xs space-y-1 border-b border-frost-border/60">
                  <div className="flex justify-between">
                    <span className="text-frost-muted bn-text">ভাউচার নম্বর:</span>
                    <span className="font-mono font-bold">{voucher.returnNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-frost-muted bn-text">তারিখ ও সময়:</span>
                    <span className="tabular-nums">
                      {new Date(voucher.returnDate).toLocaleString("bn-BD")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-frost-muted bn-text">গ্রাহক:</span>
                    <span className="font-semibold bn-text">
                      {voucher.customerName || "ওয়াক-ইন সাধারণ ক্রেতা"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-frost-muted bn-text">ফেরত ধরণ:</span>
                    <span className="font-bold bn-text text-emerald-800">
                      {voucher.refundType === "DUE_ADJUSTMENT" ? "বাকি সমন্বয়" : "নগদ ফেরত"}
                    </span>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="py-3 text-xs">
                  <p className="font-semibold text-frost-dark bn-text mb-1.5">ফেরত পণ্য তালিকা:</p>
                  {voucher.items && voucher.items.length > 0 ? (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-frost-border text-frost-muted">
                          <th className="pb-1 bn-text">পণ্য</th>
                          <th className="pb-1 text-center bn-text">পরিমাণ</th>
                          <th className="pb-1 text-right bn-text">দর</th>
                          <th className="pb-1 text-right bn-text">মোট</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-frost-border/40">
                        {voucher.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="py-1 bn-text">
                              {it.productNameBn || it.productNameEn || `লট #${it.lotId}`}
                              {it.isDamaged && (
                                <span className="block text-[10px] text-red-600 font-bold">
                                  [ক্ষতিগ্রস্ত/কোয়ারেন্টাইন]
                                </span>
                              )}
                            </td>
                            <td className="py-1 text-center tabular-nums">{it.quantity}</td>
                            <td className="py-1 text-right tabular-nums">{tk(it.refundPrice)}</td>
                            <td className="py-1 text-right tabular-nums font-bold">
                              {tk(it.subtotal || it.quantity * it.refundPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-frost-muted italic bn-text">পণ্য বিবরণ সংরক্ষিত</p>
                  )}
                </div>

                {/* Total */}
                <div className="pt-2 border-t border-frost-border flex justify-between items-center text-sm font-bold text-frost-dark">
                  <span className="bn-text">মোট ফেরত মূল্য:</span>
                  <span className="text-base text-emerald-800 tabular-nums">
                    {tk(voucher.totalRefundAmount)}
                  </span>
                </div>

                {voucher.reason && (
                  <p className="text-[11px] text-frost-muted bn-text mt-2">
                    মন্তব্য: {voucher.reason}
                  </p>
                )}

                {/* Print Buttons (no-print) */}
                <div className="mt-5 pt-3 border-t border-frost-border flex gap-2 no-print">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-frost-dark text-white hover:bg-black transition-all cursor-pointer shadow-xs bn-text"
                  >
                    🖨️ ভাউচার প্রিন্ট করুন
                  </button>
                  <button
                    onClick={() => {
                      setCompletedReturn(null)
                      setViewingReturn(null)
                    }}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border border-frost-border hover:bg-frost-surface transition-all cursor-pointer bn-text text-frost-dark"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
