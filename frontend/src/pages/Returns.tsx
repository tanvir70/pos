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
  Search,
  FileText,
  RotateCcw,
  Package,
  ShieldAlert,
  ArrowRight,
  Phone,
  Eye,
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
import ProductSearch from "../components/pos/ProductSearch"
import Pagination from "../components/ui/Pagination"
import DateRangeFilter, { type DateRange, defaultDateRange } from "../components/ui/DateRangeFilter"
import { formatLotNumber } from "../utils/lotNumber"

// BUSINESS DECISION: Direct chemical returns support receipt-less processing without an original invoice number
// because rural farmers frequently misplace paper receipts over 15-30 day spraying seasons.
// BUSINESS DECISION: When 'isDamaged' is selected, goods are flagged for quarantine and
// excluded from sellable counter stock to prevent accidental dispensing of compromised chemicals.
// BUSINESS DECISION: Due adjustment refunds strictly require customer profile association to guarantee correct
// credit reduction in the customer ledger.

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Returns() {
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
  const [detailModalReturn, setDetailModalReturn] = useState<SaleReturnResponse | null>(null)

  // Returns List Search & Date Filter & Pagination
  const [returnsSearch, setReturnsSearch] = useState<string>("")
  const [returnsDateRange, setReturnsDateRange] = useState<DateRange>(defaultDateRange)
  const [returnsPage, setReturnsPage] = useState<number>(0)
  const [returnsPageSize, setReturnsPageSize] = useState<number>(6)

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

  // POS-grade product search selection handler
  const handleSelectStock = (item: StockItem) => {
    setSelectedLotId(item.lotId)
    if (item.lotRetailPrice) {
      setRefundPrice(item.lotRetailPrice.toString())
    }
  }

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

  // ─── Filtered & Paginated Recent Returns ─────────────────────────
  useEffect(() => {
    setReturnsPage(0)
  }, [returnsSearch, returnsDateRange])

  const filteredRecentReturns = useMemo(() => {
    const q = returnsSearch.trim().toLowerCase()
    return recentReturns.filter((r) => {
      // Date filter
      if (returnsDateRange.startDate || returnsDateRange.endDate) {
        const d = new Date(r.returnDate).toISOString().slice(0, 10)
        if (returnsDateRange.startDate && d < returnsDateRange.startDate) return false
        if (returnsDateRange.endDate && d > returnsDateRange.endDate) return false
      }
      if (!q) return true
      const matchNo = r.returnNo?.toLowerCase().includes(q)
      const matchCust = r.customerName?.toLowerCase().includes(q)
      const matchReason = r.reason?.toLowerCase().includes(q)
      return matchNo || matchCust || matchReason
    })
  }, [recentReturns, returnsSearch, returnsDateRange])

  const paginatedRecentReturns = useMemo(() => {
    const start = returnsPage * returnsPageSize
    return filteredRecentReturns.slice(start, start + returnsPageSize)
  }, [filteredRecentReturns, returnsPage, returnsPageSize])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-emerald-700" />
            <span>Sales Return Counter</span>
          </h1>
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
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ClipboardEdit className="w-5 h-5 text-emerald-700" />
              <h2 className="font-bold text-slate-900 text-base sm:text-lg">
                Return Form
              </h2>
            </div>
          </div>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitReturn} className="space-y-4">
            {/* 1. Memo / Invoice Lookup (Optional) */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-slate-500" />
                  <span>Original Memo / Invoice No. (Optional)</span>
                </label>
                {foundSale && (
                  <button
                    type="button"
                    onClick={handleClearInvoice}
                    className="text-[11px] text-rose-600 font-semibold hover:underline cursor-pointer"
                  >
                    Clear memo
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void handleSearchInvoice()
                    }
                  }}
                  placeholder="e.g. INV-20260917-1042"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white font-mono placeholder:font-sans focus:border-emerald-600 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleSearchInvoice}
                  disabled={isSearchingInvoice || !invoiceInput.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {isSearchingInvoice ? "Searching..." : "Find Memo"}
                </button>
              </div>

              {invoiceSearchError && (
                <p className="text-xs text-amber-700 font-medium mt-1.5">
                  {invoiceSearchError}
                </p>
              )}

              {foundSale && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/80 text-xs bg-emerald-50/70 p-2.5 rounded-xl text-emerald-900 flex items-center justify-between">
                  <div>
                    <div className="font-bold">Memo #{foundSale.invoiceNo}</div>
                    <div className="text-[11px] text-emerald-800">
                      Customer: {foundSale.customerName || "Walk-in Retail"} · Date: {new Date(foundSale.saleDate).toLocaleDateString("en-US")}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Bill</span>
                    <span className="font-mono font-black">{tk(foundSale.totalAmount)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Customer Ledger Profile */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-900">
                  Customer Ledger Account {refundType === "DUE_ADJUSTMENT" ? "*" : "(Optional for Cash Refund)"}
                </label>
                {selectedCustomerId && (
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerId(null)}
                    className="text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    Clear Customer
                  </button>
                )}
              </div>
              <select
                value={selectedCustomerId || ""}
                onChange={(e) =>
                  setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)
                }
                className={`w-full px-3 py-2 border rounded-xl text-xs sm:text-sm bg-white transition-colors focus:border-emerald-600 focus:outline-hidden ${
                  refundType === "DUE_ADJUSTMENT" && !selectedCustomerId
                    ? "border-rose-300 bg-rose-50/30"
                    : "border-slate-200"
                }`}
              >
                <option value="">Walk-in / Cash Buyer (No Ledger Profile)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.businessName ? `(${c.businessName})` : ""}
                    {Number(c.currentDue || 0) > 0 ? ` — Due: ${tk(c.currentDue)}` : ""}
                  </option>
                ))}
              </select>
              {refundType === "DUE_ADJUSTMENT" && !selectedCustomerId && (
                <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Due adjustment requires a customer ledger profile to deduct from.</span>
                </p>
              )}
            </div>

            {/* 3. Product & Lot Selection using POS-grade ProductSearch */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-900">
                  Select Product & Lot to Return *
                </label>
                <span className="text-[11px] text-slate-500 font-mono hidden sm:inline-block">
                  Barcode ready · Press <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-300 font-bold">F2</kbd>
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                <ProductSearch
                  stocks={stocks}
                  onSelect={handleSelectStock}
                  allowZeroStock={true}
                  placeholder="Scan barcode (F2) or search product name / code / lot..."
                  className="border-none px-3 py-2 bg-slate-50/40"
                />
              </div>

              {selectedStockItem ? (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {selectedStockItem.nameBn || selectedStockItem.productNameBn} ({selectedStockItem.nameEn || selectedStockItem.productNameEn})
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                          Lot #{formatLotNumber(selectedStockItem.lotNumber)}
                        </span>
                        <span>·</span>
                        <span>Barcode: {selectedStockItem.lotBarcode || selectedStockItem.barcode || "N/A"}</span>
                        <span>·</span>
                        <span>Exp: {selectedStockItem.expiryDate || "N/A"}</span>
                        <span>·</span>
                        <span>Unit: {selectedStockItem.baseUnit}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-slate-900 font-mono tabular-nums">
                      Rate: {tk(selectedStockItem.lotRetailPrice)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Current Stock: {selectedStockItem.quantity ?? (selectedStockItem as any).totalQuantity ?? 0} {selectedStockItem.baseUnit}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Use search box above to select return item (out-of-stock items permitted for return).</span>
                </div>
              )}
            </div>

            {/* 4. Return Quantity & Refund Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Return Quantity ({selectedStockItem?.baseUnit || "unit"}) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Refund Rate per Unit (৳) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={refundPrice}
                  onChange={(e) => setRefundPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* 5. Refund Method */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Refund Method *
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setRefundType("CASH_REFUND")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    refundType === "CASH_REFUND"
                      ? "bg-white text-slate-950 shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>Cash Refund (Till)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRefundType("DUE_ADJUSTMENT")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    refundType === "DUE_ADJUSTMENT"
                      ? "bg-white text-indigo-950 shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <User className="w-4 h-4 text-indigo-600" />
                  <span>Due Adjustment (Ledger)</span>
                </button>
              </div>
            </div>

            {/* 6. Damaged Chemical / Quarantine Toggle */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3">
              <label className="flex items-center justify-between cursor-pointer gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-950 block">
                      Quarantine Damaged Chemical
                    </span>
                    <span className="text-[11px] text-amber-800">
                      Quarantine damaged/unsealed goods — do not restore to sellable stock
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isDamaged}
                  onChange={(e) => setIsDamaged(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>

            {/* 7. Return Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Return
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Unopened leftover after spraying season"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            {/* 8. Total Summary & Submit Action */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Total Refund Payable</span>
                <div className="text-2xl font-black font-mono text-slate-900 tabular-nums">
                  {tk(calculatedTotalRefund)}
                </div>
                <span className="text-[11px] font-semibold text-emerald-700">
                  {refundType === "CASH_REFUND"
                    ? "Cash paid directly from till"
                    : "Credited to customer ledger due"}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedLotId}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-white bg-slate-950 hover:bg-slate-800 transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Process Return & Print Voucher</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Recent Returns History (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-emerald-700" />
                <h2 className="font-bold text-slate-900 text-base">
                  Recent Returns
                </h2>
              </div>
              <span className="text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full tabular-nums">
                {filteredRecentReturns.length} records
              </span>
            </div>

            {/* Search Box & Date Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={returnsSearch}
                  onChange={(e) => setReturnsSearch(e.target.value)}
                  placeholder="Search voucher #, customer, or reason..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/40 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
              <DateRangeFilter
                value={returnsDateRange}
                onChange={(r) => {
                  setReturnsDateRange(r)
                  setReturnsPage(0)
                }}
                compact={true}
              />
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin inline-block mb-1 text-emerald-700" />
                <p className="text-xs">Loading returns...</p>
              </div>
            ) : filteredRecentReturns.length === 0 ? (
              <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                <p className="text-xs font-semibold">No returns found.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting date range or search query.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {paginatedRecentReturns.map((ret) => (
                  <div
                    key={ret.id}
                    onClick={() => setDetailModalReturn(ret)}
                    className="p-3 bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-emerald-300 rounded-xl transition-all cursor-pointer shadow-2xs group relative"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1 group-hover:text-emerald-700 transition-colors">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            {ret.returnNo}
                          </span>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              ret.refundType === "DUE_ADJUSTMENT"
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {ret.refundType === "DUE_ADJUSTMENT" ? "Due Adjusted" : "Cash Refund"}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 mt-1 flex items-center gap-1 truncate">
                          {ret.customerName ? (
                            <>
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{ret.customerName}</span>
                            </>
                          ) : (
                            <span className="text-slate-500 italic">Walk-in Cash Return</span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(ret.returnDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold font-mono tabular-nums text-slate-900 group-hover:text-emerald-800 transition-colors">
                          {tk(ret.totalRefundAmount)}
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-1.5">
                          <span className="text-[10px] font-semibold text-slate-400 group-hover:text-emerald-600 flex items-center gap-0.5">
                            <Eye className="w-3 h-3" />
                            <span>Details</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setViewingReturn(ret)
                            }}
                            title="Print 80mm Voucher"
                            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {ret.reason && (
                      <p className="text-[11px] text-slate-500 italic mt-2 bg-slate-50 group-hover:bg-white p-1.5 rounded-lg border border-slate-100 truncate">
                        Note: {ret.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="pt-3 border-t border-slate-100">
            <Pagination
              page={returnsPage}
              pageSize={returnsPageSize}
              totalElements={filteredRecentReturns.length}
              onPageChange={setReturnsPage}
              onPageSizeChange={(newSize) => {
                setReturnsPageSize(newSize)
                setReturnsPage(0)
              }}
              pageSizeOptions={[4, 6, 10, 20]}
              itemLabel="returns"
            />
          </div>
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
                    Rajib Enterprise
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

      {/* ─── Detailed Return Information Modal ───────────────────────── */}
      {detailModalReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">
                      Sales Return Voucher #{detailModalReturn.returnNo}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        detailModalReturn.refundType === "DUE_ADJUSTMENT"
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {detailModalReturn.refundType === "DUE_ADJUSTMENT"
                        ? "Due Adjustment (বাকি সমন্বয়)"
                        : "Cash Refund (ক্যাশ ফেরত)"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Processed on {new Date(detailModalReturn.returnDate).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalReturn(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Meta Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Customer
                </span>
                <p className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{detailModalReturn.customerName || "Walk-in Cash Customer"}</span>
                </p>
                {detailModalReturn.customerPhone && (
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{detailModalReturn.customerPhone}</span>
                  </p>
                )}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Original Invoice
                </span>
                <p className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    {detailModalReturn.originalSaleId
                      ? `Sale #${detailModalReturn.originalSaleId}`
                      : "Direct Return (No memo)"}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {detailModalReturn.originalSaleId ? "Receipt matched" : "Counter receipt-less return"}
                </p>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                  Total Refund
                </span>
                <p className="text-lg font-black font-mono text-emerald-900 mt-0.5">
                  {tk(detailModalReturn.totalRefundAmount)}
                </p>
                <span className="text-[10px] font-semibold text-emerald-700">
                  {detailModalReturn.refundType === "DUE_ADJUSTMENT"
                    ? "Deducted from customer due"
                    : "Cash paid out at counter"}
                </span>
              </div>
            </div>

            {/* Return Reason if present */}
            {detailModalReturn.reason && (
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900">
                <span className="font-bold">Return Reason / Notes: </span>
                <span>{detailModalReturn.reason}</span>
              </div>
            )}

            {/* Itemized Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Returned Products ({detailModalReturn.items?.length || 0})
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Product & Lot</th>
                      <th className="py-2.5 px-3 text-center">Status / Inventory</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Refund Rate</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailModalReturn.items && detailModalReturn.items.length > 0 ? (
                      detailModalReturn.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3">
                            <p className="font-bold text-slate-900">
                              {it.productNameBn || it.productNameEn || `Lot #${it.lotId}`}
                            </p>
                            {it.productNameEn && it.productNameBn && (
                              <p className="text-[11px] text-slate-500">{it.productNameEn}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 text-slate-700">
                                {formatLotNumber(it.lotNumber)}
                              </span>
                              {it.barcode && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {it.barcode}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {it.isDamaged ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <ShieldAlert className="w-3 h-3" />
                                Damaged / Quarantined
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Package className="w-3 h-3" />
                                Restocked to Dokan
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono tabular-nums text-slate-800">
                            {it.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                            {tk(it.refundPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold font-mono tabular-nums text-slate-900">
                            {tk(it.subtotal || it.quantity * it.refundPrice)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                          No items listed for this return
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-right text-slate-700">
                        Total Refund Amount:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-sm text-emerald-800 tabular-nums">
                        {tk(detailModalReturn.totalRefundAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setViewingReturn(detailModalReturn)
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-black transition-all cursor-pointer shadow-xs flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print 80mm Thermal Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailModalReturn(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
