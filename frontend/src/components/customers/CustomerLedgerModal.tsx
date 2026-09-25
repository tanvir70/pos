import React, { useState, useEffect, useMemo } from "react"
import {
  ClipboardList,
  Printer,
  X,
  Building2,
  Loader2,
  Banknote,
  RefreshCw,
  ShoppingCart,
} from "lucide-react"
import type { Customer, CustomerLedger } from "../../types"
import { getCustomerLedger } from "../../api/endpoints"
import DateRangeFilter, { type DateRange, defaultDateRange } from "../ui/DateRangeFilter"
import Pagination from "../ui/Pagination"

export interface CustomerLedgerModalProps {
  customer: Customer | null
  onClose: () => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function CustomerLedgerModal({
  customer,
  onClose,
}: CustomerLedgerModalProps) {
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedger[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [statementViewMode, setStatementViewMode] = useState<"table" | "thermal">("table")
  const [statementDateRange, setStatementDateRange] = useState<DateRange>(defaultDateRange)
  const [statementPage, setStatementPage] = useState<number>(0)
  const [statementPageSize, setStatementPageSize] = useState<number>(10)

  useEffect(() => {
    if (customer) {
      setIsLoading(true)
      setStatementPage(0)
      setStatementDateRange(defaultDateRange)
      getCustomerLedger(customer.id)
        .then((data) => setLedgerEntries(data))
        .catch((err) => {
          console.error("Error loading ledger:", err)
          setLedgerEntries([])
        })
        .finally(() => setIsLoading(false))
    }
  }, [customer])

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

  if (!customer) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto no-print">
      {/* Main on-screen modal (no-print) */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-5 sm:p-6 my-6 no-print max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-slate-900" />
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                Customer Ledger Statement (Audit)
              </h3>
              <p className="text-xs text-slate-500">
                All invoice bills, cash payments, and adjustment audit details
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="bg-slate-100 p-0.5 rounded-lg flex text-xs">
              <button
                type="button"
                onClick={() => setStatementViewMode("table")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  statementViewMode === "table" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Table View
              </button>
              <button
                type="button"
                onClick={() => setStatementViewMode("thermal")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  statementViewMode === "thermal" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                80mm Thermal Slip
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-black transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print 80mm</span>
            </button>
            <button
              type="button"
              data-testid="close-ledger-modal"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900 cursor-pointer p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {statementViewMode === "table" ? (
          <div className="overflow-y-auto flex-1 mt-4 space-y-4 pr-1">
            {/* Printable Shop Banner Header */}
            <div className="text-center py-3 border-b border-dashed border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                Rajib Enterprise
              </h2>
              <p className="text-xs text-emerald-800 font-semibold">
                Authorized Agrochemical Dealer
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Uttar Bazar, Belabo, Narsingdi · Mobile: 01711-123456
              </p>
              <div className="inline-block mt-1 bg-slate-50 px-3 py-0.5 rounded text-xs font-bold text-slate-900 border border-slate-200">
                Customer Ledger & Due Statement
              </div>
            </div>

            {/* Customer Info Card */}
            <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Customer Name:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {customer.name}
                </span>
                {customer.businessName && (
                  <span className="flex items-center gap-1 font-semibold text-emerald-800 text-xs mt-0.5">
                    <Building2 className="w-3 h-3" /> {customer.businessName}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500 block">Contact:</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {customer.phone}
                </span>
                <span className="block text-slate-500 mt-0.5">
                  {customer.villageAddress || "No village listed"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Buy (Lifetime):</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {tk(customer.totalPurchases || 0)}
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  {customer.customerType === "WHOLESALE" ? "Wholesale Customer" : "Retail Farmer"}
                </span>
              </div>
              <div className="text-right sm:text-right">
                <span className="text-red-500 font-semibold block">Latest Due Balance:</span>
                <span className="text-lg font-bold text-red-600 tabular-nums">
                  {tk(customer.currentDue)}
                </span>
              </div>
            </div>

            {/* Statement Date Range Filter & Period Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <DateRangeFilter
                value={statementDateRange}
                onChange={(newRange) => {
                  setStatementDateRange(newRange)
                  setStatementPage(0)
                }}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 font-bold">
                  Period Billed: {tk(periodDebit)}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  Period Paid: {tk(periodCredit)}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 font-bold">
                  Net: {tk(periodDebit - periodCredit)}
                </span>
              </div>
            </div>

            {/* Ledger Entries Table */}
            {isLoading ? (
              <div className="py-16 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin inline-block mb-1" />
                <p>Loading ledger audit records...</p>
              </div>
            ) : filteredLedgerEntries.length === 0 ? (
              <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                <p className="text-sm font-semibold">No transaction records found in selected range.</p>
                <p className="text-xs mt-1">Try resetting the date filter to "All Time".</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold">
                      <tr>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Description / Transaction Type</th>
                        <th className="px-2 py-2.5">MR / Invoice No.</th>
                        <th className="px-3 py-2.5 text-right text-red-600">Debit (Due ৳)</th>
                        <th className="px-3 py-2.5 text-right text-emerald-600">Credit (Paid ৳)</th>
                        <th className="px-3 py-2.5 text-right font-bold">Balance After (৳)</th>
                        <th className="px-3 py-2.5">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60">
                      {paginatedLedgerEntries.map((item) => {
                        const isPayment = item.transactionType === "CASH_PAYMENT" || item.transactionType === "MFS_PAYMENT" || item.transactionType === "BANK_TRANSFER"
                        const isReturn = item.transactionType === "RETURN_CREDIT"
                        const isInvoice = item.transactionType === "INVOICE_BILL"

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/30">
                            <td className="px-3 py-2 whitespace-nowrap text-slate-500 tabular-nums">
                              {item.transactionDate
                                ? new Date(item.transactionDate).toLocaleDateString("en-GB")
                                : "—"}
                            </td>
                            <td className="px-3 py-2 font-semibold">
                              {isPayment && (
                                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <Banknote className="w-3 h-3" /> Due Payment Received
                                </span>
                              )}
                              {isReturn && (
                                <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                  <RefreshCw className="w-3 h-3" /> Return Adjustment
                                </span>
                              )}
                              {isInvoice && (
                                <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  <ShoppingCart className="w-3 h-3" /> Sales Invoice
                                </span>
                              )}
                              {!isPayment && !isReturn && !isInvoice && (
                                <span className="text-slate-900">{item.transactionType}</span>
                              )}
                            </td>
                            <td className="px-2 py-2 font-mono text-[11px] text-slate-900 whitespace-nowrap">
                              {item.moneyReceiptNo || (item.saleId ? `INV-${item.saleId}` : "—")}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-red-600 font-semibold">
                              {item.debit > 0 ? tk(item.debit) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-emerald-600 font-semibold">
                              {item.credit > 0 ? tk(item.credit) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">
                              {tk(item.balanceAfter)}
                            </td>
                            <td className="px-3 py-2 text-slate-500 text-[11px]">
                              {item.notes || "—"}
                            </td>
                          </tr>
                        )
                      })}
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
                  pageSizeOptions={[10, 20, 50]}
                  itemLabel="transactions"
                />
              </div>
            )}

            {/* Printable Signatures */}
            <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 text-center text-xs">
              <div>
                <div className="border-t border-slate-900/40 w-36 mx-auto pt-1 font-semibold text-slate-500">
                  Customer Signature
                </div>
              </div>
              <div>
                <div className="border-t border-slate-900/40 w-36 mx-auto pt-1 font-semibold text-slate-500">
                  Rajib Enterprise
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* On-screen 80mm Slip Preview */
          <div className="overflow-y-auto flex-1 mt-4 p-4 bg-slate-100 flex justify-center rounded-xl">
            <div
              className="bg-white p-5 border border-slate-300 rounded-lg shadow-sm text-black font-mono text-xs leading-snug"
              style={{ width: "80mm", maxWidth: "80mm" }}
            >
              {/* Store Header */}
              <div className="text-center pb-2.5 mb-2 border-b border-dashed border-gray-500">
                <h1 className="text-base font-bold text-black uppercase tracking-wide">Rajib Enterprise</h1>
                <p className="text-[11px] font-semibold text-gray-800">Authorized Agro Dealer</p>
                <p className="text-[10px] text-gray-600">Krishi Market, Uttar Bazar, Belabo</p>
                <p className="text-[10px] text-gray-600">Mobile: 01711-123456</p>
                <div className="mt-1.5 inline-block border border-black px-2 py-0.5 text-[10px] font-bold">
                  CUSTOMER LEDGER STATEMENT
                </div>
                <p className="text-[9px] text-gray-500 mt-1">Printed: {new Date().toLocaleString("en-GB")}</p>
              </div>

              {/* Customer Info */}
              <div className="text-[11px] pb-2 mb-2 border-b border-dashed border-gray-400 space-y-0.5">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Customer:</span>
                  <span className="font-bold">{customer.name}</span>
                </div>
                {customer.businessName && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600">Business:</span>
                    <span>{customer.businessName}</span>
                  </div>
                )}
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-600">Mobile:</span>
                  <span>{customer.phone}</span>
                </div>
                {customer.villageAddress && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600">Village:</span>
                    <span>{customer.villageAddress}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-dotted border-gray-300">
                  <span className="font-medium text-gray-700">Total Buy (Lifetime):</span>
                  <span className="font-bold">{tk(customer.totalPurchases || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-red-600">Outstanding Due:</span>
                  <span className="font-bold text-red-600">{tk(customer.currentDue || 0)}</span>
                </div>
              </div>

              {/* Transactions 80mm List */}
              <div className="pb-2 mb-2 border-b border-dashed border-gray-500">
                <div className="text-[10px] font-bold uppercase pb-1 mb-1.5 border-b border-dotted border-gray-400 flex justify-between">
                  <span>Transaction Records</span>
                  <span>{filteredLedgerEntries.length} Items</span>
                </div>
                <div className="space-y-2">
                  {filteredLedgerEntries.map((item) => (
                    <div key={item.id} className="pb-1.5 border-b border-dotted border-gray-200">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-mono text-gray-600">
                          {item.transactionDate ? new Date(item.transactionDate).toLocaleDateString("en-GB") : "—"}
                        </span>
                        <span className="font-bold">
                          {item.transactionType === "CASH_PAYMENT" ? "Cash Received" :
                           item.transactionType === "INVOICE_BILL" ? "Sales Invoice" :
                           item.transactionType === "RETURN_CREDIT" ? "Return Adjustment" : item.transactionType}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] mt-0.5">
                        <span className="font-mono text-[9px] text-gray-500">
                          Ref: {item.moneyReceiptNo || (item.saleId ? `INV-${item.saleId}` : "—")}
                        </span>
                        <span className="tabular-nums font-semibold">
                          {item.debit > 0 && <span className="text-red-700">+{tk(item.debit)}</span>}
                          {item.credit > 0 && <span className="text-emerald-700">-{tk(item.credit)}</span>}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-gray-600 mt-0.5">
                        <span>Bal: <strong className="text-black">{tk(item.balanceAfter)}</strong></span>
                        {item.notes && <span className="truncate max-w-[120px] italic">({item.notes})</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Box */}
              <div className="bg-gray-100 p-2 rounded border border-gray-300 text-[10px] space-y-1 mb-3">
                <div className="flex justify-between">
                  <span>Total Invoiced (Debit):</span>
                  <span className="font-bold">{tk(ledgerEntries.reduce((s, e) => s + (e.debit || 0), 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Paid (Credit):</span>
                  <span className="font-bold">{tk(ledgerEntries.reduce((s, e) => s + (e.credit || 0), 0))}</span>
                </div>
                <div className="flex justify-between text-xs font-bold pt-1 border-t border-gray-400 text-black">
                  <span>Net Outstanding Due:</span>
                  <span className="text-red-600 font-bold">{tk(customer.currentDue)}</span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-6 pb-2 grid grid-cols-2 gap-4 text-center text-[9px]">
                <div>
                  <div className="border-t border-dashed border-gray-600 pt-1 font-semibold">Customer Sign</div>
                </div>
                <div>
                  <div className="border-t border-dashed border-gray-600 pt-1 font-semibold">Rajib Enterprise</div>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-2 text-[9px] text-gray-500 space-y-0.5">
                <p>Thank you for clearing your ledger dues!</p>
                <p className="font-mono">Rajib Enterprise POS</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dedicated 80mm Printable Statement (Visible ONLY in print media, hidden on screen) */}
      <div
        className="hidden print:block thermal-receipt-print print-area text-black font-mono text-xs leading-tight mx-auto"
        style={{ width: "100%", maxWidth: "80mm" }}
      >
        {/* Store Header */}
        <div className="text-center pb-2.5 mb-2 border-b border-dashed border-gray-600">
          <h1 className="text-base font-bold text-black uppercase tracking-wide">Rajib Enterprise</h1>
          <p className="text-[11px] font-semibold text-gray-800">Authorized Agro Dealer</p>
          <p className="text-[10px] text-gray-600">Krishi Market, Uttar Bazar, Belabo</p>
          <p className="text-[10px] text-gray-600">Mobile: 01711-123456</p>
          <div className="mt-1.5 inline-block border border-black px-2 py-0.5 text-[10px] font-bold">
            CUSTOMER LEDGER STATEMENT
          </div>
          <p className="text-[9px] text-gray-500 mt-1">Printed: {new Date().toLocaleString("en-GB")}</p>
        </div>

        {/* Customer Info */}
        <div className="text-[11px] pb-2 mb-2 border-b border-dashed border-gray-500 space-y-0.5">
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Customer:</span>
            <span className="font-bold">{customer.name}</span>
          </div>
          {customer.businessName && (
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-600">Business:</span>
              <span>{customer.businessName}</span>
            </div>
          )}
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-600">Mobile:</span>
            <span>{customer.phone}</span>
          </div>
          {customer.villageAddress && (
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-600">Village:</span>
              <span>{customer.villageAddress}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t border-dotted border-gray-300">
            <span className="font-medium text-gray-700">Total Buy (Lifetime):</span>
            <span className="font-bold">{tk(customer.totalPurchases || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold text-red-600">Outstanding Due:</span>
            <span className="font-bold text-red-600">{tk(customer.currentDue || 0)}</span>
          </div>
        </div>

        {/* Transactions 80mm List */}
        <div className="pb-2 mb-2 border-b border-dashed border-gray-500">
          <div className="text-[10px] font-bold uppercase pb-1 mb-1.5 border-b border-dotted border-gray-400 flex justify-between">
            <span>Transaction Records</span>
            <span>{filteredLedgerEntries.length} Items</span>
          </div>
          <div className="space-y-2">
            {filteredLedgerEntries.map((item) => (
              <div key={item.id} className="pb-1.5 border-b border-dotted border-gray-300">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-mono text-gray-600">
                    {item.transactionDate ? new Date(item.transactionDate).toLocaleDateString("en-GB") : "—"}
                  </span>
                  <span className="font-bold">
                    {item.transactionType === "CASH_PAYMENT" ? "Cash Received" :
                     item.transactionType === "INVOICE_BILL" ? "Sales Invoice" :
                     item.transactionType === "RETURN_CREDIT" ? "Return Adjustment" : item.transactionType}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] mt-0.5">
                  <span className="font-mono text-[9px] text-gray-500">
                    Ref: {item.moneyReceiptNo || (item.saleId ? `INV-${item.saleId}` : "—")}
                  </span>
                  <span className="tabular-nums font-semibold">
                    {item.debit > 0 && <span className="text-red-700">+{tk(item.debit)}</span>}
                    {item.credit > 0 && <span className="text-emerald-700">-{tk(item.credit)}</span>}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[9px] text-gray-600 mt-0.5">
                  <span>Bal: <strong className="text-black">{tk(item.balanceAfter)}</strong></span>
                  {item.notes && <span className="truncate max-w-[120px] italic">({item.notes})</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals Box */}
        <div className="bg-gray-100 p-2 rounded border border-gray-300 text-[10px] space-y-1 mb-3">
          <div className="flex justify-between">
            <span>Total Invoiced (Debit):</span>
            <span className="font-bold">{tk(ledgerEntries.reduce((s, e) => s + (e.debit || 0), 0))}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Paid (Credit):</span>
            <span className="font-bold">{tk(ledgerEntries.reduce((s, e) => s + (e.credit || 0), 0))}</span>
          </div>
          <div className="flex justify-between text-xs font-bold pt-1 border-t border-gray-400 text-black">
            <span>Net Outstanding Due:</span>
            <span className="text-red-600 font-bold">{tk(customer.currentDue)}</span>
          </div>
        </div>

        {/* Signatures */}
        <div className="pt-6 pb-2 grid grid-cols-2 gap-4 text-center text-[9px]">
          <div>
            <div className="border-t border-dashed border-gray-600 pt-1 font-semibold">Customer Sign</div>
          </div>
          <div>
            <div className="border-t border-dashed border-gray-600 pt-1 font-semibold">Rajib Enterprise</div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2 text-[9px] text-gray-500 space-y-0.5">
          <p>Thank you for clearing your ledger dues!</p>
          <p className="font-mono">Rajib Enterprise POS</p>
        </div>
      </div>
    </div>
  )
}
