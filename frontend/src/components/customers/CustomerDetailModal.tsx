import React, { useState, useEffect, useMemo } from "react"
import type { Customer, CustomerLedger, SaleResponse } from "../../types"
import { getCustomerLedger, getCustomerPurchases } from "../../api/endpoints"
import DateRangeFilter, { type DateRange, defaultDateRange } from "../ui/DateRangeFilter"
import Pagination from "../ui/Pagination"

export interface CustomerDetailModalProps {
  customer: Customer | null
  isOpen: boolean
  onClose: () => void
  onOpenEdit: (customer: Customer) => void
  onOpenRepay: (customer: Customer) => void
  onPrintInvoice: (sale: SaleResponse) => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function CustomerDetailModal({
  customer,
  isOpen,
  onClose,
  onOpenEdit,
  onOpenRepay,
  onPrintInvoice,
}: CustomerDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"ledger" | "purchases">("ledger")

  // Ledger state
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedger[]>([])
  const [isLedgerLoading, setIsLedgerLoading] = useState<boolean>(false)
  const [statementViewMode, setStatementViewMode] = useState<"table" | "thermal">("table")
  const [statementDateRange, setStatementDateRange] = useState<DateRange>(defaultDateRange)
  const [statementPage, setStatementPage] = useState<number>(0)
  const [statementPageSize, setStatementPageSize] = useState<number>(10)

  // Purchases state
  const [purchasesList, setPurchasesList] = useState<SaleResponse[]>([])
  const [isPurchasesLoading, setIsPurchasesLoading] = useState<boolean>(false)
  const [purchaseSearch, setPurchaseSearch] = useState<string>("")
  const [purchasePage, setPurchasePage] = useState<number>(0)
  const [purchasePageSize, setPurchasePageSize] = useState<number>(5)

  // Load ledger and purchases when customer opens
  useEffect(() => {
    if (customer && isOpen) {
      setIsLedgerLoading(true)
      setIsPurchasesLoading(true)
      setStatementPage(0)
      setPurchasePage(0)
      setStatementDateRange(defaultDateRange)
      setPurchaseSearch("")

      getCustomerLedger(customer.id)
        .then((data) => setLedgerEntries(data))
        .catch((err) => {
          console.error("Error loading ledger:", err)
          setLedgerEntries([])
        })
        .finally(() => setIsLedgerLoading(false))

      getCustomerPurchases(customer.id)
        .then((data) => setPurchasesList(data))
        .catch((err) => {
          console.error("Error loading purchases:", err)
          setPurchasesList([])
        })
        .finally(() => setIsPurchasesLoading(false))
    }
  }, [customer, isOpen])

  // Filtered Ledger
  const filteredLedgerEntries = useMemo(() => {
    if (statementDateRange.preset === "ALL" && !statementDateRange.startDate && !statementDateRange.endDate) {
      return ledgerEntries
    }
    return ledgerEntries.filter((item) => {
      if (!item.transactionDate) return true
      const d = new Date(item.transactionDate).toISOString().slice(0, 10)
      if (statementDateRange.startDate && d < statementDateRange.startDate) return false
      if (statementDateRange.endDate && d > statementDateRange.endDate) return false
      return true
    })
  }, [ledgerEntries, statementDateRange])

  const periodDebit = useMemo(() => {
    return filteredLedgerEntries.reduce((sum, item) => sum + (Number(item.debit) || 0), 0)
  }, [filteredLedgerEntries])

  const periodCredit = useMemo(() => {
    return filteredLedgerEntries.reduce((sum, item) => sum + (Number(item.credit) || 0), 0)
  }, [filteredLedgerEntries])

  const paginatedLedgerEntries = useMemo(() => {
    const start = statementPage * statementPageSize
    return filteredLedgerEntries.slice(start, start + statementPageSize)
  }, [filteredLedgerEntries, statementPage, statementPageSize])

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    const q = purchaseSearch.trim().toLowerCase()
    if (!q) return purchasesList
    return purchasesList.filter((sale) => {
      const invoiceMatch = sale.invoiceNo?.toLowerCase().includes(q)
      const itemMatch = sale.items?.some(
        (it) =>
          it.productNameEn?.toLowerCase().includes(q) ||
          it.productNameBn?.toLowerCase().includes(q) ||
          it.lotNumber?.toLowerCase().includes(q)
      )
      return invoiceMatch || itemMatch
    })
  }, [purchasesList, purchaseSearch])

  const paginatedPurchases = useMemo(() => {
    const start = purchasePage * purchasePageSize
    return filteredPurchases.slice(start, start + purchasePageSize)
  }, [filteredPurchases, purchasePage, purchasePageSize])

  if (!isOpen || !customer) return null

  const due = Number(customer.currentDue) || 0

  const handlePrintStatement = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-4xl w-full p-5 sm:p-6 my-6 max-h-[92vh] flex flex-col no-print">
        {/* Header / Profile Section */}
        <div className="pb-4 border-b border-slate-200 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">
                  {customer.name}
                </h2>
                <span className="px-2 py-0.5 rounded text-xs font-medium border border-slate-200 bg-slate-100 text-slate-800">
                  {customer.customerType === "WHOLESALE" ? "Wholesale Customer" : "Retail Farmer"}
                </span>
                {due > 0 ? (
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                    Due: {tk(due)}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Settled
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Account ID: #{customer.id} · Registered Customer
              </p>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onOpenEdit(customer)}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 transition-colors"
              >
                Edit Customer
              </button>

              <button
                type="button"
                onClick={() => onOpenRepay(customer)}
                disabled={due <= 0}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Collect Due
              </button>

              <button
                type="button"
                onClick={handlePrintStatement}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
              >
                Print Statement
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {/* Customer Metadata Card */}
          <div className="mt-4 bg-slate-50/70 border border-slate-200 rounded-lg p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Mobile Phone</span>
              <span className="font-medium text-slate-900 tabular-nums">
                {customer.phone || "—"}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block">Land Area</span>
              <span className="font-semibold text-slate-900">
                {customer.landArea || "Not specified"}
              </span>
              {customer.fatherName && (
                <span className="text-slate-500 block text-[11px] mt-0.5">
                  Father: {customer.fatherName}
                </span>
              )}
            </div>

            <div>
              <span className="text-slate-500 block">Address / Village</span>
              <span className="font-medium text-slate-900">
                {customer.villageAddress || customer.address || "Not specified"}
              </span>
              {customer.businessName && (
                <span className="text-slate-500 block text-[11px] mt-0.5">
                  Business: {customer.businessName}
                </span>
              )}
            </div>

            <div>
              <span className="text-slate-500 block">Lifetime Purchases</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {tk(customer.totalPurchases || 0)}
              </span>
              <span className="text-slate-500 block text-[11px] mt-0.5">
                {purchasesList.length} Total Orders
              </span>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center justify-between border-b border-slate-200 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab("ledger")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === "ledger"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ledger Statement ({filteredLedgerEntries.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("purchases")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === "purchases"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Invoices & Purchases ({filteredPurchases.length})
            </button>
          </div>

          {activeTab === "ledger" && (
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-xs">
              <button
                type="button"
                onClick={() => setStatementViewMode("table")}
                className={`px-2 py-1 rounded font-medium transition-all ${
                  statementViewMode === "table"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setStatementViewMode("thermal")}
                className={`px-2 py-1 rounded font-medium transition-all ${
                  statementViewMode === "thermal"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Thermal Slip (80mm)
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Ledger Statement */}
        {activeTab === "ledger" && (
          <div className="overflow-y-auto flex-1 mt-3 space-y-3 pr-1">
            {statementViewMode === "table" ? (
              <>
                {/* Date Filter & Metrics */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <DateRangeFilter
                    value={statementDateRange}
                    onChange={(newRange) => {
                      setStatementDateRange(newRange)
                      setStatementPage(0)
                    }}
                  />
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-medium">
                      Billed: {tk(periodDebit)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                      Paid: {tk(periodCredit)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-medium">
                      Net: {tk(periodDebit - periodCredit)}
                    </span>
                  </div>
                </div>

                {/* Ledger Table */}
                {isLedgerLoading ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    Loading ledger statement...
                  </div>
                ) : filteredLedgerEntries.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
                    No ledger transactions recorded for this period.
                  </div>
                ) : (
                  <>
                    <div className="border border-slate-200 rounded-lg overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-medium">
                          <tr>
                            <th className="px-3 py-2 whitespace-nowrap">Date</th>
                            <th className="px-3 py-2 whitespace-nowrap">Type</th>
                            <th className="px-3 py-2 whitespace-nowrap">Ref / Voucher</th>
                            <th className="px-3 py-2 text-right whitespace-nowrap">Debit (+Bill)</th>
                            <th className="px-3 py-2 text-right whitespace-nowrap">Credit (-Paid)</th>
                            <th className="px-3 py-2 text-right whitespace-nowrap">Balance</th>
                            <th className="px-3 py-2">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedLedgerEntries.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-3 py-2 tabular-nums text-slate-700 whitespace-nowrap">
                                {row.transactionDate
                                  ? new Date(row.transactionDate).toLocaleDateString("en-GB")
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className="font-medium text-slate-800">
                                  {row.transactionType === "INVOICE_BILL"
                                    ? "Sales Invoice"
                                    : row.transactionType === "CASH_PAYMENT"
                                    ? "Due Repayment"
                                    : row.transactionType === "RETURN_CREDIT"
                                    ? "Return Credit"
                                    : row.transactionType}
                                </span>
                              </td>
                              <td className="px-3 py-2 tabular-nums text-slate-600 whitespace-nowrap">
                                {row.moneyReceiptNo || (row.saleId ? `INV-${row.saleId}` : "—")}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-red-600 font-medium whitespace-nowrap">
                                {row.debit > 0 ? tk(row.debit) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-medium whitespace-nowrap">
                                {row.credit > 0 ? tk(row.credit) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                                {tk(row.balanceAfter)}
                              </td>
                              <td className="px-3 py-2 text-slate-500 max-w-[180px] truncate">
                                {row.notes || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <Pagination
                      page={statementPage}
                      pageSize={statementPageSize}
                      totalElements={filteredLedgerEntries.length}
                      onPageChange={setStatementPage}
                      onPageSizeChange={(newSize) => {
                        setStatementPageSize(newSize)
                        setStatementPage(0)
                      }}
                      pageSizeOptions={[5, 10, 20]}
                      itemLabel="entries"
                    />
                  </>
                )}
              </>
            ) : (
              /* Thermal Slip Preview */
              <div className="bg-slate-100 p-4 rounded-lg flex justify-center">
                <div className="bg-white border border-slate-300 p-4 w-[340px] text-xs font-mono shadow-sm">
                  <div className="text-center pb-2 border-b border-dashed border-slate-300">
                    <p className="font-bold text-sm">RAJIB ENTERPRISE</p>
                    <p className="text-[10px] text-slate-600">Uttar Bazar, Belabo, Narsingdi</p>
                    <p className="text-[10px] text-slate-600">Tel: 01711-123456</p>
                    <p className="font-semibold text-xs mt-1">CUSTOMER STATEMENT</p>
                  </div>

                  <div className="py-2 border-b border-dashed border-slate-300 space-y-0.5 text-[11px]">
                    <p><strong>Customer:</strong> {customer.name}</p>
                    <p><strong>Phone:</strong> {customer.phone}</p>
                    {customer.landArea && <p><strong>Land Area:</strong> {customer.landArea}</p>}
                    <p><strong>Date:</strong> {new Date().toLocaleDateString("en-GB")}</p>
                  </div>

                  <div className="py-2 space-y-2">
                    {filteredLedgerEntries.slice(0, 15).map((e) => (
                      <div key={e.id} className="text-[10px] border-b border-dotted border-slate-200 pb-1">
                        <div className="flex justify-between">
                          <span>{e.transactionDate ? new Date(e.transactionDate).toLocaleDateString("en-GB") : ""}</span>
                          <span>
                            {e.debit > 0 ? `+${tk(e.debit)}` : `-${tk(e.credit)}`}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>{e.moneyReceiptNo || (e.saleId ? `INV-${e.saleId}` : e.transactionType)}</span>
                          <span>Bal: {tk(e.balanceAfter)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-dashed border-slate-300 text-xs">
                    <div className="flex justify-between font-bold">
                      <span>Current Due:</span>
                      <span className="text-red-600">{tk(customer.currentDue)}</span>
                    </div>
                  </div>

                  <div className="pt-4 text-center">
                    <button
                      type="button"
                      onClick={handlePrintStatement}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-sans font-medium w-full"
                    >
                      Print Slip (80mm)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Invoices & Purchases */}
        {activeTab === "purchases" && (
          <div className="overflow-y-auto flex-1 mt-3 space-y-3 pr-1">
            {/* Search Filter */}
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                value={purchaseSearch}
                onChange={(e) => {
                  setPurchaseSearch(e.target.value)
                  setPurchasePage(0)
                }}
                placeholder="Search invoice number or product name..."
                className="w-full max-w-sm h-8 px-3 border border-slate-200 rounded-md text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <span className="text-xs text-slate-500 whitespace-nowrap">
                Showing {filteredPurchases.length} invoices
              </span>
            </div>

            {/* Invoices List */}
            {isPurchasesLoading ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Loading purchase records...
              </div>
            ) : filteredPurchases.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
                No invoices found matching search.
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedPurchases.map((sale) => {
                  const saleDue = Number(sale.dueAmount) || 0
                  return (
                    <div
                      key={sale.id}
                      className="border border-slate-200 rounded-lg p-3 bg-white hover:border-slate-300 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-100 gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">
                            Invoice #{sale.invoiceNo}
                          </span>
                          <span className="text-slate-500">
                            {sale.saleDate
                              ? new Date(sale.saleDate).toLocaleDateString("en-GB")
                              : "—"}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800">
                            {sale.saleMode || "RETAIL"}
                          </span>
                          {saleDue > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                              Due: {tk(saleDue)}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Paid in Full
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="font-bold text-slate-900 text-sm tabular-nums">
                              {tk(sale.totalAmount)}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              Paid: {tk((sale.cashPaid || 0) + (sale.digitalPaid || 0))}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onPrintInvoice(sale)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                          >
                            Print Memo
                          </button>
                        </div>
                      </div>

                      {/* Items Purchased in Invoice */}
                      <div className="pt-2">
                        <table className="w-full text-[11px] text-left">
                          <thead className="text-slate-500 font-medium">
                            <tr>
                              <th className="py-1">Product</th>
                              <th className="py-1">Lot / Batch</th>
                              <th className="py-1 text-right">Unit Price</th>
                              <th className="py-1 text-right">Qty</th>
                              <th className="py-1 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {sale.items?.map((it, idx) => (
                              <tr key={idx} className="text-slate-800">
                                <td className="py-1 font-medium">
                                  {it.productNameEn || it.productNameBn || "Item"}
                                </td>
                                <td className="py-1 font-mono text-slate-500 text-[10px]">
                                  {it.lotNumber || "LOT-01"}
                                </td>
                                <td className="py-1 text-right tabular-nums">
                                  {tk(it.unitPrice)}
                                </td>
                                <td className="py-1 text-right tabular-nums">
                                  {it.totalQuantity}
                                </td>
                                <td className="py-1 text-right tabular-nums font-medium">
                                  {tk(it.subtotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}

                <Pagination
                  page={purchasePage}
                  pageSize={purchasePageSize}
                  totalElements={filteredPurchases.length}
                  onPageChange={setPurchasePage}
                  onPageSizeChange={(newSize) => {
                    setPurchasePageSize(newSize)
                    setPurchasePage(0)
                  }}
                  pageSizeOptions={[5, 10, 15]}
                  itemLabel="invoices"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden printable area for 80mm slip window.print() */}
      <div className="hidden print:block print:w-[80mm] print:p-2 text-black bg-white font-mono text-[10px]">
        <div className="text-center pb-2 border-b border-black">
          <p className="font-bold text-xs">RAJIB ENTERPRISE</p>
          <p className="text-[9px]">Uttar Bazar, Belabo, Narsingdi</p>
          <p className="text-[9px]">Phone: 01711-123456</p>
          <p className="font-bold text-[10px] mt-1">CUSTOMER STATEMENT</p>
        </div>

        <div className="py-1.5 border-b border-black text-[9px] space-y-0.5">
          <p><strong>Customer:</strong> {customer.name}</p>
          <p><strong>Phone:</strong> {customer.phone}</p>
          {customer.landArea && <p><strong>Land Area:</strong> {customer.landArea}</p>}
          <p><strong>Date:</strong> {new Date().toLocaleDateString("en-GB")}</p>
        </div>

        <div className="py-2 space-y-1">
          {filteredLedgerEntries.map((e) => (
            <div key={e.id} className="border-b border-dotted border-gray-400 pb-1">
              <div className="flex justify-between">
                <span>{e.transactionDate ? new Date(e.transactionDate).toLocaleDateString("en-GB") : ""}</span>
                <span>{e.debit > 0 ? `+${tk(e.debit)}` : `-${tk(e.credit)}`}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{e.moneyReceiptNo || (e.saleId ? `INV-${e.saleId}` : e.transactionType)}</span>
                <span>Bal: {tk(e.balanceAfter)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-black font-bold flex justify-between text-xs">
          <span>Current Due:</span>
          <span>{tk(customer.currentDue)}</span>
        </div>

        <div className="pt-4 text-center text-[8px] text-gray-600">
          <p>Thank you for your business!</p>
          <p>Rajib Enterprise POS</p>
        </div>
      </div>
    </div>
  )
}
