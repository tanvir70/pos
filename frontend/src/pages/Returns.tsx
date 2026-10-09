import { useState, useEffect, useMemo, useCallback } from "react"
import RefreshButton from "../components/ui/RefreshButton"
import {
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
  SaleItemResponse,
  RefundType,
  ReturnDraftItem,
} from "../types"
import {
  getStock,
  getCustomers,
  createReturn,
  getRecentReturns,
  getSaleByInvoice,
} from "../api/endpoints"
import { defaultDateRange, type DateRange } from "../components/ui/DateRangeFilter"
import { isDiscreteUnit, formatQuantityByUnit } from "../utils/unit"
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
  const [isSearchingInvoice, setIsSearchingInvoice] = useState<boolean>(false)
  const [invoiceSearchError, setInvoiceSearchError] = useState<string | null>(null)
  const [foundSale, setFoundSale] = useState<SaleResponse | null>(null)

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null)
  const [returnItems, setReturnItems] = useState<ReturnDraftItem[]>([])

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

  // ─── Invoice Lookup & Selection Actions ─────────────────────────
  const handleSelectFoundSale = (sale: SaleResponse) => {
    setFoundSale(sale)
    setInvoiceSearchError(null)

    // Auto-select customer if sale had one
    if (sale.customerId) {
      setSelectedCustomerId(sale.customerId)
      const cust = customers.find((c) => c.id === sale.customerId)
      if (cust && cust.currentDue > 0) {
        setRefundType("DUE_ADJUSTMENT")
      } else {
        setRefundType("CASH_REFUND")
      }
    } else {
      setSelectedCustomerId(null)
      setRefundType("CASH_REFUND")
    }

    // Reset return items so cashier chooses which product(s) to return from the invoice
    setReturnItems([])
  }

  const handleSearchInvoice = async (invoiceNo: string) => {
    const trimmed = invoiceNo.trim()
    if (!trimmed) {
      setInvoiceSearchError("Please enter a memo / invoice number or customer phone number.")
      return
    }

    try {
      setIsSearchingInvoice(true)
      setInvoiceSearchError(null)
      const sale = await getSaleByInvoice(trimmed)
      handleSelectFoundSale(sale)
    } catch (err: any) {
      setFoundSale(null)
      setInvoiceSearchError("Invoice not found. Please verify the memo number or search by customer mobile number (017...).")
    } finally {
      setIsSearchingInvoice(false)
    }
  }

  const handleClearInvoice = () => {
    setFoundSale(null)
    setInvoiceSearchError(null)
    setReturnItems([])
    setSelectedStockItem(null)
    setSelectedCustomerId(null)
    setRefundType("CASH_REFUND")
  }

  // ─── Multi-Item Return Actions ──────────────────────────────────
  const handleToggleInvoiceItem = (saleItem: SaleItemResponse, _stockItem: StockItem) => {
    setReturnItems((prev) => {
      const exists = prev.some((i) => i.lotId === saleItem.lotId)
      if (exists) {
        return prev.filter((i) => i.lotId !== saleItem.lotId)
      } else {
        const retQty = saleItem.returnedQuantity ?? 0
        const remQty = saleItem.remainingQuantity != null ? saleItem.remainingQuantity : Math.max(0, saleItem.totalQuantity - retQty)
        if (remQty <= 0) return prev

        const newItem: ReturnDraftItem = {
          lotId: saleItem.lotId,
          productName: saleItem.productNameBn || saleItem.productNameEn,
          productNameBn: saleItem.productNameBn,
          productNameEn: saleItem.productNameEn,
          lotNumber: saleItem.lotNumber,
          barcode: saleItem.barcode,
          baseUnit: saleItem.baseUnit || "unit",
          purchasedQuantity: remQty,
          returnedQuantity: retQty,
          remainingQuantity: remQty,
          quantity: formatQuantityByUnit(remQty, saleItem.baseUnit),
          refundPrice: saleItem.unitPrice.toString(),
          isDamaged: false,
        }
        return [...prev, newItem]
      }
    })

    if (foundSale?.customerId) {
      setSelectedCustomerId(foundSale.customerId)
    }
  }

  const handleSelectAllInvoiceItems = () => {
    if (!foundSale?.items) return
    const drafts: ReturnDraftItem[] = foundSale.items
      .filter((it) => {
        const retQty = it.returnedQuantity ?? 0
        const remQty = it.remainingQuantity != null ? it.remainingQuantity : Math.max(0, it.totalQuantity - retQty)
        return remQty > 0
      })
      .map((it) => {
        const retQty = it.returnedQuantity ?? 0
        const remQty = it.remainingQuantity != null ? it.remainingQuantity : Math.max(0, it.totalQuantity - retQty)
        return {
          lotId: it.lotId,
          productName: it.productNameBn || it.productNameEn,
          productNameBn: it.productNameBn,
          productNameEn: it.productNameEn,
          lotNumber: it.lotNumber,
          barcode: it.barcode,
          baseUnit: it.baseUnit || "unit",
          purchasedQuantity: remQty,
          returnedQuantity: retQty,
          remainingQuantity: remQty,
          quantity: formatQuantityByUnit(remQty, it.baseUnit),
          refundPrice: it.unitPrice.toString(),
          isDamaged: false,
        }
      })
    setReturnItems(drafts)
  }

  const handleDeselectAllInvoiceItems = () => {
    setReturnItems([])
  }

  // Stock selection helpers (deprecated / legacy compat)
  const handleSelectStock = (_item: StockItem) => {}

  const handleClearSelectedStock = () => {
    setSelectedStockItem(null)
  }

  const handleUpdateReturnItem = (lotId: number, field: keyof ReturnDraftItem, val: any) => {
    setReturnItems((prev) =>
      prev.map((i) => (i.lotId === lotId ? { ...i, [field]: val } : i))
    )
  }

  const handleRemoveReturnItem = (lotId: number) => {
    setReturnItems((prev) => prev.filter((i) => i.lotId !== lotId))
  }

  const handleClearAllReturnItems = () => {
    setReturnItems([])
    setSelectedStockItem(null)
  }

  // ─── Total Refund Math ──────────────────────────────────────────
  const calculatedTotalRefund = useMemo(() => {
    return returnItems.reduce((acc, item) => {
      const q = parseFloat(item.quantity) || 0
      const r = parseFloat(item.refundPrice) || 0
      return acc + q * r
    }, 0)
  }, [returnItems])

  // ─── Return Submission ──────────────────────────────────────────
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!foundSale) {
      setFormError("An original sales invoice must be verified before processing a return.")
      return
    }

    if (returnItems.length === 0) {
      setFormError("Please select at least one product from the verified invoice to return.")
      return
    }

    for (const it of returnItems) {
      const qtyNum = parseFloat(it.quantity)
      if (isNaN(qtyNum) || qtyNum <= 0) {
        setFormError(`Enter a valid return quantity for ${it.productName}.`)
        return
      }

      if (isDiscreteUnit(it.baseUnit) && !Number.isInteger(qtyNum)) {
        setFormError(
          `Return quantity for ${it.productName} must be a whole number (unit: ${it.baseUnit}).`
        )
        return
      }

      if (it.purchasedQuantity != null && qtyNum > it.purchasedQuantity) {
        setFormError(
          `Return quantity (${formatQuantityByUnit(qtyNum, it.baseUnit)}) for ${it.productName} cannot exceed available returnable quantity (${formatQuantityByUnit(it.purchasedQuantity, it.baseUnit)}) on invoice.`
        )
        return
      }

      const priceNum = parseFloat(it.refundPrice)
      if (isNaN(priceNum) || priceNum < 0) {
        setFormError(`Enter a valid refund price for ${it.productName}.`)
        return
      }
    }

    if (refundType === "DUE_ADJUSTMENT" && !selectedCustomerId) {
      setFormError("A customer must be selected to process a due adjustment.")
      return
    }

    try {
      setIsSubmitting(true)
      setFormError(null)

      const payload: SaleReturnRequest = {
        originalSaleId: foundSale.id,
        customerId: selectedCustomerId,
        refundType,
        reason: reason.trim() || "Customer return",
        items: returnItems.map((it) => ({
          lotId: it.lotId,
          quantity: parseFloat(it.quantity),
          refundPrice: parseFloat(it.refundPrice),
          isDamaged: it.isDamaged,
        })),
      }

      const res = await createReturn(payload)
      setCompletedReturn(res)
      setSuccessMessage(`Return voucher #${res.returnNo} was created successfully!`)

      // Reset form
      setReturnItems([])
      setSelectedStockItem(null)
      setReason("")
      setFoundSale(null)

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <span>Sales Return Counter</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Process customer returns, multi-item restocking, and invoice refunds or due credit adjustments
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <RefreshButton
            onClick={loadData}
            isLoading={isLoading}
            title="Refresh returns data"
          />
        </div>
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="cursor-pointer text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 dark:bg-rose-950/40 border border-red-300 dark:border-rose-800 rounded-xl text-red-800 dark:text-rose-300 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="cursor-pointer text-red-600 dark:text-rose-400 hover:text-red-900 dark:hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Left Return Form, Right Recent Returns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <ReturnProcessingForm
          onSearchInvoice={handleSearchInvoice}
          onClearInvoice={handleClearInvoice}
          isSearchingInvoice={isSearchingInvoice}
          invoiceSearchError={invoiceSearchError}
          foundSale={foundSale}
          onSelectFoundSale={handleSelectFoundSale}
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onSelectCustomerId={setSelectedCustomerId}
          stocks={stocks}
          selectedStockItem={selectedStockItem}
          onSelectStock={handleSelectStock}
          onClearSelectedStock={handleClearSelectedStock}
          returnItems={returnItems}
          onUpdateReturnItem={handleUpdateReturnItem}
          onRemoveReturnItem={handleRemoveReturnItem}
          onClearAllReturnItems={handleClearAllReturnItems}
          onToggleInvoiceItem={handleToggleInvoiceItem}
          onSelectAllInvoiceItems={handleSelectAllInvoiceItems}
          onDeselectAllInvoiceItems={handleDeselectAllInvoiceItems}
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
          setDetailModalReturn(null)
          setViewingReturn(ret)
        }}
      />
    </div>
  )
}
