import { useState, useEffect, useMemo, useCallback } from "react"
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCcw,
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
import { defaultDateRange, type DateRange } from "../components/ui/DateRangeFilter"
import ReturnProcessingForm from "../components/returns/ReturnProcessingForm"
import ReturnHistoryTable from "../components/returns/ReturnHistoryTable"
import ReturnReceiptModal from "../components/returns/ReturnReceiptModal"
import ReturnDetailModal from "../components/returns/ReturnDetailModal"

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
  const [quantity, setQuantity] = useState<string>("1")
  const [refundPrice, setRefundPrice] = useState<string>("")
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
        reason: reason.trim() || "Customer return",
        items: [
          {
            lotId: selectedLotId,
            quantity: qtyNum,
            refundPrice: priceNum,
            isDamaged: false,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-slate-700" />
            <span>Sales Return Counter</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Process customer returns, instant lot restocking, and invoice refunds or due credit adjustments
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 cursor-pointer transition-colors text-xs"
            title="Refresh returns data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
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
        <ReturnProcessingForm
          invoiceInput={invoiceInput}
          onInvoiceInputChange={(val) => {
            setInvoiceInput(val)
            setInvoiceSearchError(null)
          }}
          onSearchInvoice={handleSearchInvoice}
          onClearInvoice={handleClearInvoice}
          isSearchingInvoice={isSearchingInvoice}
          invoiceSearchError={invoiceSearchError}
          foundSale={foundSale}
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onSelectCustomerId={setSelectedCustomerId}
          stocks={stocks}
          selectedStockItem={selectedStockItem}
          onSelectStock={handleSelectStock}
          quantity={quantity}
          onQuantityChange={setQuantity}
          refundPrice={refundPrice}
          onRefundPriceChange={setRefundPrice}
          refundType={refundType}
          onRefundTypeChange={setRefundType}
          reason={reason}
          onReasonChange={setReason}
          calculatedTotalRefund={calculatedTotalRefund}
          isSubmitting={isSubmitting}
          formError={formError}
          onSubmit={handleSubmitReturn}
        />

        <ReturnHistoryTable
          recentReturns={filteredRecentReturns}
          paginatedReturns={paginatedRecentReturns}
          returnsSearch={returnsSearch}
          onSearchChange={setReturnsSearch}
          returnsDateRange={returnsDateRange}
          onDateRangeChange={(r) => {
            setReturnsDateRange(r)
            setReturnsPage(0)
          }}
          returnsPage={returnsPage}
          returnsPageSize={returnsPageSize}
          onPageChange={setReturnsPage}
          onPageSizeChange={(newSize) => {
            setReturnsPageSize(newSize)
            setReturnsPage(0)
          }}
          isLoading={isLoading}
          onSelectDetail={(ret) => setDetailModalReturn(ret)}
          onPrintVoucher={(ret) => setViewingReturn(ret)}
        />
      </div>

      {/* Completed / View Return Voucher Modal */}
      <ReturnReceiptModal
        voucher={completedReturn || viewingReturn}
        onClose={() => {
          setCompletedReturn(null)
          setViewingReturn(null)
        }}
      />

      {/* Detailed Return Information Modal */}
      <ReturnDetailModal
        returnDetail={detailModalReturn}
        onClose={() => setDetailModalReturn(null)}
        onPrintThermal={(ret) => {
          setViewingReturn(ret)
        }}
      />
    </div>
  )
}
