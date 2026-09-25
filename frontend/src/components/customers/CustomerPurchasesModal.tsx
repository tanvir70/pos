import React, { useState, useEffect, useMemo } from "react"
import {
  X,
  Phone,
  Building2,
  MapPin,
  Banknote,
  ClipboardList,
  ShoppingCart,
  Search,
  Loader2,
  Calendar,
  Printer,
  Check,
} from "lucide-react"
import type { Customer, SaleResponse } from "../../types"
import { getCustomerPurchases } from "../../api/endpoints"

export interface CustomerPurchasesModalProps {
  customer: Customer | null
  onClose: () => void
  onOpenRepayModal: (customer: Customer) => void
  onOpenLedger: (customer: Customer) => void
  onPrintInvoice: (sale: SaleResponse) => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function CustomerPurchasesModal({
  customer,
  onClose,
  onOpenRepayModal,
  onOpenLedger,
  onPrintInvoice,
}: CustomerPurchasesModalProps) {
  const [purchasesList, setPurchasesList] = useState<SaleResponse[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [search, setSearch] = useState<string>("")

  useEffect(() => {
    if (customer) {
      setIsLoading(true)
      setSearch("")
      getCustomerPurchases(customer.id)
        .then((data) => setPurchasesList(data))
        .catch((err) => {
          console.error("Error loading customer purchases:", err)
          setPurchasesList([])
        })
        .finally(() => setIsLoading(false))
    }
  }, [customer])

  const filteredPurchases = useMemo(() => {
    const q = search.trim().toLowerCase()
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
  }, [purchasesList, search])

  if (!customer) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-5 sm:p-6 my-6 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-lg shrink-0">
              {customer.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {customer.name}
                </h2>
                {customer.customerType === "WHOLESALE" ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    Wholesale Customer
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Retail Farmer
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                {customer.businessName && (
                  <span className="flex items-center gap-1 font-semibold text-emerald-800">
                    <Building2 className="w-3.5 h-3.5" /> {customer.businessName}
                  </span>
                )}
                {customer.fatherName && (
                  <span>Father: {customer.fatherName}</span>
                )}
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {customer.phone}
                </span>
                {customer.villageAddress && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {customer.villageAddress}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons & Close */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const c = customer
                onClose()
                onOpenRepayModal(c)
              }}
              disabled={(customer.currentDue || 0) <= 0}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Collect Due</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const c = customer
                onClose()
                onOpenLedger(c)
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Ledger</span>
            </button>
            <button
              type="button"
              data-testid="close-purchases-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick KPI Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 shrink-0">
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-emerald-800 block">Total Buy (Lifetime)</span>
            <span className="text-base sm:text-lg font-bold text-emerald-900 tabular-nums">
              {tk(customer.totalPurchases || 0)}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-600 block">Total Invoices</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">
              {purchasesList.length} Orders
            </span>
          </div>
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-blue-800 block">Total Cash/Paid</span>
            <span className="text-base sm:text-lg font-bold text-blue-900 tabular-nums">
              {tk(purchasesList.reduce((acc, s) => acc + (s.cashPaid || 0) + (s.digitalPaid || 0), 0))}
            </span>
          </div>
          <div className="bg-red-50/70 border border-red-200 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-red-700 block">Outstanding Due</span>
            <span className="text-base sm:text-lg font-bold text-red-600 tabular-nums">
              {tk(customer.currentDue || 0)}
            </span>
          </div>
        </div>

        {/* Search & Header */}
        <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4 text-emerald-700" />
            <span>All Purchase Invoices ({filteredPurchases.length})</span>
          </h3>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter invoice or product..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:border-emerald-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Invoices List (Scrollable) */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin inline-block mb-1" />
              <p className="text-xs">Loading purchase records...</p>
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
              <ShoppingCart className="w-8 h-8 mx-auto text-slate-300 mb-1" />
              <p className="text-sm font-semibold text-slate-700">No purchase records found</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {search ? "No matches for this search query." : "This customer has not made any invoice purchases yet."}
              </p>
            </div>
          ) : (
            filteredPurchases.map((sale) => {
              const isPaid = (sale.dueAmount || 0) <= 0
              const isPartial = (sale.dueAmount || 0) > 0 && ((sale.cashPaid || 0) + (sale.digitalPaid || 0) > 0)
              const saleDateStr = sale.saleDate
                ? new Date(sale.saleDate).toLocaleString("en-GB", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"

              return (
                <div
                  key={sale.id}
                  className="border border-slate-200 rounded-xl bg-slate-50/30 overflow-hidden transition-all hover:border-slate-300"
                >
                  {/* Invoice Top Header */}
                  <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm">
                        #{sale.invoiceNo}
                      </span>
                      {isPaid && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3 h-3" /> PAID
                        </span>
                      )}
                      {isPartial && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          PARTIAL DUE
                        </span>
                      )}
                      {!isPaid && !isPartial && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                          FULL DUE
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {saleDateStr}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-medium">
                        {sale.saleMode === "WHOLESALE" ? "Wholesale" : "Retail"} • Cashier: {sale.cashierName || "Rajib"}
                      </span>
                      <button
                        type="button"
                        onClick={() => onPrintInvoice(sale)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                        title="Print thermal memo for this invoice"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                        <span>Print Memo</span>
                      </button>
                    </div>
                  </div>

                  {/* Items Purchased Table */}
                  <div className="p-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-200/80 text-[11px]">
                            <th className="pb-1.5 font-semibold">Product Description</th>
                            <th className="pb-1.5 font-semibold">Lot Number</th>
                            <th className="pb-1.5 font-semibold text-right">Quantity</th>
                            <th className="pb-1.5 font-semibold text-right">Unit Rate</th>
                            <th className="pb-1.5 font-semibold text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(sale.items || []).map((it) => (
                            <tr key={it.id}>
                              <td className="py-1.5 font-medium text-slate-900">
                                <span>{it.productNameEn || "Product"}</span>
                                {it.productNameBn && (
                                  <span className="text-slate-500 ml-1 text-[11px]">
                                    ({it.productNameBn})
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 font-mono text-[11px] text-slate-500">
                                {it.lotNumber || "—"}
                              </td>
                              <td className="py-1.5 text-right font-medium tabular-nums text-slate-700">
                                {it.totalQuantity}
                              </td>
                              <td className="py-1.5 text-right tabular-nums text-slate-700">
                                {tk(it.unitPrice)}
                              </td>
                              <td className="py-1.5 text-right font-semibold tabular-nums text-slate-900">
                                {tk(it.subtotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Invoice Financial Summary Bar */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs bg-slate-50/80 p-2.5 rounded-lg">
                      <div className="flex items-center gap-3 text-slate-600">
                        <span>Subtotal: <strong className="text-slate-800">{tk(sale.subtotal)}</strong></span>
                        {(sale.discount || 0) > 0 && (
                          <span className="text-emerald-700 font-semibold">
                            Discount: -{tk(sale.discount)}
                          </span>
                        )}
                        {(sale.roundOff || 0) !== 0 && (
                          <span className="text-slate-500">
                            Round off: {tk(sale.roundOff)}
                          </span>
                        )}
                        <span className="text-slate-500 font-medium">
                          Via: {sale.paymentMethod || "CASH"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">
                          Total: {tk(sale.totalAmount)}
                        </span>
                        <span className="font-semibold text-emerald-700">
                          Paid: {tk((sale.cashPaid || 0) + (sale.digitalPaid || 0))}
                        </span>
                        {(sale.dueAmount || 0) > 0 ? (
                          <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            Due: {tk(sale.dueAmount)}
                          </span>
                        ) : (
                          <span className="font-medium text-emerald-700">
                            Due: ৳0.00
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
