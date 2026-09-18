import { useState, useEffect, useMemo, useCallback } from "react"
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  ClipboardEdit,
  Receipt,
  Banknote,
  ScrollText,
  User,
  Printer,
  Loader2,
} from "lucide-react"
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
// BUSINESS DECISION: When 'isDamaged' is selected, goods are flagged for quarantine and
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
      setErrorMessage(err?.message || "Failed to load data.")
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
      setInvoiceSearchError("Please enter a memo / invoice number.")
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
      setInvoiceSearchError("This invoice number was not found. You can still process a direct return without a receipt.")
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
      setFormError("Please select the product being returned.")
      return
    }

    const qtyNum = parseFloat(quantity)
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setFormError("Enter a valid return quantity.")
      return
    }

    const priceNum = parseFloat(refundPrice)
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError("Enter a valid refund price.")
      return
    }

    if (refundType === "DUE_ADJUSTMENT" && !selectedCustomerId) {
      setFormError("A customer must be selected to process a due adjustment.")
      return
    }

    try {
      setIsSubmitting(true)
      setFormError(null)

      const payload: SaleReturnRequest = {
        originalSaleId: foundSale?.id ?? null,
        customerId: selectedCustomerId,
        refundType,
        reason: reason.trim() || (isDamaged ? "Damaged chemical" : "Customer return"),
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
      setSuccessMessage(`Return voucher #${res.returnNo} was created successfully!`)

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
      setFormError(err?.message || "An error occurred while processing the return.")
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            <span>Sales Return Counter</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Accept chemical returns with or without a receipt, quarantine damaged bottles, and adjust customer dues
          </p>
        </div>
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="cursor-pointer text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="cursor-pointer text-red-600 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Left Return Form, Right Recent Returns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Return Form (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <ClipboardEdit className="w-5 h-5 text-slate-500" />
              <h2 className="font-bold text-slate-900 text-base sm:text-lg">
                New Return Form (Direct Return)
              </h2>
            </div>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
              Receipt not required
            </span>
          </div>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitReturn} className="space-y-4">
            {/* 1. Optional Invoice Search Box */}
            <div className="bg-slate-50/40 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4" />
                  <span>Original sale memo / invoice no. (optional)</span>
                </label>
                {foundSale && (
                  <button
                    type="button"
                    onClick={handleClearInvoice}
                    className="text-[11px] text-red-600 hover:underline cursor-pointer"
                  >
                    Clear receipt info
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
                  placeholder="e.g. INV-20260917-1042 (returns are still accepted without a receipt)"
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white font-mono"
                />
                <button
                  type="button"
                  onClick={handleSearchInvoice}
                  disabled={isSearchingInvoice || !invoiceInput.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isSearchingInvoice ? "Searching..." : "Find Receipt"}
                </button>
              </div>

              {invoiceSearchError && (
                <p className="text-xs text-amber-700 font-medium mt-1.5">
                  {invoiceSearchError}
                </p>
              )}

              {foundSale && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-xs bg-emerald-50/50 p-2 rounded-lg text-emerald-900">
                  <div className="flex justify-between font-bold">
                    <span>Memo No: {foundSale.invoiceNo}</span>
                    <span>Total Bill: {tk(foundSale.totalAmount)}</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Date: {new Date(foundSale.saleDate).toLocaleDateString("en-US")} | Customer:{" "}
                    {foundSale.customerName || "Walk-in customer"}
                  </p>
                </div>
              )}
            </div>

            {/* 2. Customer Selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-900">
                  Select Customer {refundType === "DUE_ADJUSTMENT" ? "*" : "(optional for cash refund)"}
                </label>
                {selectedCustomerId && (
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerId(null)}
                    className="text-[11px] text-slate-500 hover:text-red-600 cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
              <select
                value={selectedCustomerId || ""}
                onChange={(e) =>
                  setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white"
              >
                <option value="">-- Walk-in / general customer (cash refund) --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.businessName ? `(${c.businessName})` : ""} - Due: {tk(c.currentDue)}
                  </option>
                ))}
              </select>
              {refundType === "DUE_ADJUSTMENT" && !selectedCustomerId && (
                <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Selecting a customer is required for a due adjustment.</span>
                </p>
              )}
            </div>

            {/* 3. Product & Lot Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1">
                Select returnable pesticide or product and lot *
              </label>

              {/* Quick search input */}
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Filter by product name, code, or lot number..."
                className="w-full px-3 py-1.5 mb-2 border border-slate-200 rounded-lg text-xs bg-slate-50/30"
              />

              <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-200/60">
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
                          : "hover:bg-slate-50/60"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">
                          {item.nameBn || item.productNameBn} ({item.nameEn || item.productNameEn})
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-900">
                            Lot: {item.lotNumber}
                          </span>
                          <span>•</span>
                          <span>Expiry: {item.expiryDate}</span>
                          <span>•</span>
                          <span>Unit: {item.baseUnit}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-slate-900 tabular-nums">
                          {tk(item.lotRetailPrice)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Stock: {item.totalQuantity} {item.baseUnit}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {selectedStockItem && (
                <div className="mt-2 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex justify-between items-center">
                  <div>
                    <span className="font-bold">Selected:</span> {selectedStockItem.nameBn} (Lot: {selectedStockItem.lotNumber})
                  </div>
                  <span className="font-semibold text-[11px]">
                    Current stock: {selectedStockItem.quantity} {selectedStockItem.baseUnit}
                  </span>
                </div>
              )}
            </div>

            {/* 4. Quantity & Refund Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">
                  Return quantity ({selectedStockItem?.baseUnit || "unit"}) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums font-bold focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">
                  Refund price per unit (৳) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={refundPrice}
                  onChange={(e) => setRefundPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums font-bold focus:border-emerald-600 focus:outline-hidden"
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
                  <span className="text-xs font-bold text-amber-900">
                    Damaged Chemical (Quarantine)
                  </span>
                  <p className="text-[11px] text-amber-800/80 mt-0.5">
                    Leaking, unsealed, or expired chemicals will not be added back to sellable stock; they will be placed into a separate quarantine.
                  </p>
                </div>
              </label>
            </div>

            {/* 6. Refund Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1">
                Refund Method *
              </label>
              <select
                value={refundType}
                onChange={(e) => setRefundType(e.target.value as RefundType)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white"
              >
                <option value="CASH_REFUND">Cash Refund (from Till)</option>
                <option value="DUE_ADJUSTMENT">Due Adjustment (Customer Due)</option>
              </select>
            </div>

            {/* 7. Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1">
                Reason for Return
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Bottle unsold after spraying / farmer's need is over"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm"
              />
            </div>

            {/* 8. Total Summary & Submit Button */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-500">Total refund payable:</span>
                <div className="text-2xl font-bold text-slate-900 tabular-nums">
                  {tk(calculatedTotalRefund)}
                </div>
                <span className="text-[11px] text-emerald-700 font-medium">
                  {refundType === "CASH_REFUND" ? "Will be paid in cash from the till" : "Will be deducted from the customer's due balance"}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedLotId}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Return & Generate Voucher</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Recent Returns History (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-slate-500" />
              <h2 className="font-bold text-slate-900 text-base">
                Recent Returns
              </h2>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              {recentReturns.length}
            </span>
          </div>

          {/* Search Box */}
          <div>
            <input
              type="text"
              value={returnsSearch}
              onChange={(e) => setReturnsSearch(e.target.value)}
              placeholder="Search by voucher no. or customer name..."
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin inline-block mb-1" />
              <p className="text-xs">Loading...</p>
            </div>
          ) : filteredRecentReturns.length === 0 ? (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
              <p className="text-xs font-semibold">No returns found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/60 max-h-[520px] overflow-y-auto">
              {filteredRecentReturns.map((ret) => (
                <div key={ret.id} className="py-3 px-1 hover:bg-slate-50/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {ret.returnNo}
                      </span>
                      <p className="text-xs font-semibold text-slate-900 mt-0.5 flex items-center gap-1">
                        {ret.customerName ? (
                          <>
                            <User className="w-3.5 h-3.5" />
                            <span>{ret.customerName}</span>
                          </>
                        ) : (
                          "Walk-in cash return"
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Date: {new Date(ret.returnDate).toLocaleDateString("en-US")}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold tabular-nums text-emerald-800">
                        {tk(ret.totalRefundAmount)}
                      </div>
                      <span
                        className={`inline-block mt-0.5 px-2 py-0.2 rounded text-[10px] font-bold ${
                          ret.refundType === "DUE_ADJUSTMENT"
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {ret.refundType === "DUE_ADJUSTMENT" ? "Due Adjustment" : "Cash Refund"}
                      </span>
                    </div>
                  </div>

                  {ret.reason && (
                    <p className="text-[11px] text-slate-500 italic mt-1.5">
                      Reason: {ret.reason}
                    </p>
                  )}

                  {/* View Voucher Action */}
                  <div className="mt-2 text-right">
                    <button
                      onClick={() => setViewingReturn(ret)}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>View & Print Voucher</span>
                      <Printer className="w-3.5 h-3.5" />
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
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 print:m-0 print:p-0 print:border-none print:shadow-none print-area">
                {/* Actions Header (hidden on print) */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 no-print">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-900 text-base">
                      Return Voucher
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setCompletedReturn(null)
                      setViewingReturn(null)
                    }}
                    className="text-slate-500 hover:text-slate-900 leading-none cursor-pointer p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Printable Slip Content */}
                <div className="py-3 text-center border-b border-dashed border-slate-200">
                  <h2 className="text-lg font-bold text-slate-900">
                    Al-Amin Traders
                  </h2>
                  <p className="text-xs text-slate-500">
                    Authorized Agro Dealer · Uttar Bazar, Belabo, Narsingdi
                  </p>
                  <div className="inline-block mt-1 px-2.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900">
                    Sales Return Voucher (Credit Note)
                  </div>
                </div>

                {/* Voucher Meta */}
                <div className="py-2.5 text-xs space-y-1 border-b border-slate-200/60">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Voucher No:</span>
                    <span className="font-mono font-bold">{voucher.returnNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date & Time:</span>
                    <span className="tabular-nums">
                      {new Date(voucher.returnDate).toLocaleString("en-US")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer:</span>
                    <span className="font-semibold">
                      {voucher.customerName || "Walk-in general customer"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Refund Method:</span>
                    <span className="font-bold text-emerald-800">
                      {voucher.refundType === "DUE_ADJUSTMENT" ? "Due Adjustment" : "Cash Refund"}
                    </span>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="py-3 text-xs">
                  <p className="font-semibold text-slate-900 mb-1.5">Returned Items:</p>
                  {voucher.items && voucher.items.length > 0 ? (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="pb-1">Product</th>
                          <th className="pb-1 text-center">Qty</th>
                          <th className="pb-1 text-right">Rate</th>
                          <th className="pb-1 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/40">
                        {voucher.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="py-1">
                              {it.productNameBn || it.productNameEn || `Lot #${it.lotId}`}
                              {it.isDamaged && (
                                <span className="block text-[10px] text-red-600 font-bold">
                                  [Damaged / Quarantined]
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
                    <p className="text-slate-500 italic">Item details preserved</p>
                  )}
                </div>

                {/* Total */}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                  <span>Total Refund Amount:</span>
                  <span className="text-base text-emerald-800 tabular-nums">
                    {tk(voucher.totalRefundAmount)}
                  </span>
                </div>

                {voucher.reason && (
                  <p className="text-[11px] text-slate-500 mt-2">
                    Note: {voucher.reason}
                  </p>
                )}

                {/* Print Buttons (no-print) */}
                <div className="mt-5 pt-3 border-t border-slate-200 flex gap-2 no-print">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-black transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Voucher</span>
                  </button>
                  <button
                    onClick={() => {
                      setCompletedReturn(null)
                      setViewingReturn(null)
                    }}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer text-slate-900"
                  >
                    Close
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
