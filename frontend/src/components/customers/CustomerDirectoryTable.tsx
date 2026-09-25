import React, { useState, useMemo, useEffect } from "react"
import {
  BookOpen,
  Plus,
  RefreshCw,
  Users,
  Store,
  Sprout,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Loader2,
  Building2,
  MapPin,
  Phone,
  MessageCircle,
  Check,
  ShoppingCart,
  Banknote,
  ClipboardList,
  Eye,
} from "lucide-react"
import type { Customer } from "../../types"
import GotposStatCard from "../dashboard/GotposStatCard"
import Pagination from "../ui/Pagination"
import { focusSidebarMenu, focusFirstTableRow, focusPrimarySearch } from "../../utils/keyboard"

export type FilterType = "ALL" | "WHOLESALE" | "RETAIL" | "HAS_DUE"

export interface CustomerDirectoryTableProps {
  customers: Customer[]
  isLoading: boolean
  successMessage: string | null
  errorMessage: string | null
  onClearSuccessMessage: () => void
  onClearErrorMessage: () => void
  onRefresh: () => void
  onOpenAddCustomer: () => void
  onOpenRepayModal: (customer: Customer) => void
  onOpenLedger: (customer: Customer) => void
  onOpenPurchases: (customer: Customer) => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function CustomerDirectoryTable({
  customers,
  isLoading,
  successMessage,
  errorMessage,
  onClearSuccessMessage,
  onClearErrorMessage,
  onRefresh,
  onOpenAddCustomer,
  onOpenRepayModal,
  onOpenLedger,
  onOpenPurchases,
}: CustomerDirectoryTableProps) {
  const [search, setSearch] = useState<string>("")
  const [filterType, setFilterType] = useState<FilterType>("ALL")
  const [customerPage, setCustomerPage] = useState<number>(0)
  const [customerPageSize, setCustomerPageSize] = useState<number>(15)

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter((c) => {
      // Type Filter
      if (filterType === "WHOLESALE" && c.customerType !== "WHOLESALE") return false
      if (filterType === "RETAIL" && c.customerType !== "RETAIL") return false
      if (filterType === "HAS_DUE" && (Number(c.currentDue) || 0) <= 0) return false

      // Search
      if (!q) return true
      const nameMatch = c.name?.toLowerCase().includes(q)
      const bizMatch = c.businessName?.toLowerCase().includes(q)
      const phoneMatch = c.phone?.toLowerCase().includes(q)
      const villageMatch = c.villageAddress?.toLowerCase().includes(q)
      return nameMatch || bizMatch || phoneMatch || villageMatch
    })
  }, [customers, filterType, search])

  // Reset directory page on filter change
  useEffect(() => {
    setCustomerPage(0)
  }, [search, filterType])

  const paginatedCustomers = useMemo(() => {
    const start = customerPage * customerPageSize
    return filteredCustomers.slice(start, start + customerPageSize)
  }, [filteredCustomers, customerPage, customerPageSize])

  // Summary Metrics
  const totalMarketDue = useMemo(() => {
    return customers.reduce((sum, c) => sum + (Number(c.currentDue) || 0), 0)
  }, [customers])

  const wholesaleCount = useMemo(() => {
    return customers.filter((c) => c.customerType === "WHOLESALE").length
  }, [customers])

  const retailCount = useMemo(() => {
    return customers.filter((c) => c.customerType === "RETAIL").length
  }, [customers])

  const customersWithDueCount = useMemo(() => {
    return customers.filter((c) => (Number(c.currentDue) || 0) > 0).length
  }, [customers])

  const formatWhatsAppUrl = (phone?: string | null, name?: string, due?: number) => {
    if (!phone) return null
    let clean = phone.replace(/[^0-9]/g, "")
    if (clean.startsWith("0")) clean = "88" + clean
    if (!clean.startsWith("880")) return null
    const text = encodeURIComponent(
      `আসসালামু আলাইকুম ${name || "সম্মানিত গ্রাহক"}, রাজিব এন্টারপ্রাইজ থেকে আপনার বর্তমান বাকি বকেয়া ৳${(due || 0).toLocaleString("en-IN")} টাকা। অনুগ্রহ করে বকেয়া পরিশোধ করার জন্য বিনীত অনুরোধ করা হচ্ছে। ধন্যবাদ!`
    )
    return `https://wa.me/${clean}?text=${text}`
  }

  return (
    <div className="space-y-5">
      {/* Top Header & Quick Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-700" />
            <span>Customer Due Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Wholesale and retail customer accounts, money receipt collections, and audit statements
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenAddCustomer}
            className="flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-2 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Customer</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 cursor-pointer transition-colors text-xs"
            title="Refresh customer data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metrics Cards matching Dashboard Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding Due */}
        <GotposStatCard
          title="Total Outstanding Due"
          value={tk(totalMarketDue)}
          valueColor="text-rose-700"
          subtitle={
            customersWithDueCount > 0 ? (
              <span className="text-rose-600 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {customersWithDueCount} customer(s) with dues
              </span>
            ) : (
              <span className="text-emerald-600 font-medium">Zero outstanding market due</span>
            )
          }
          theme="rose"
          icon={<span className="text-xl font-bold">৳</span>}
          onClick={() => setFilterType("HAS_DUE")}
          className="cursor-pointer"
        />

        {/* Total Customers */}
        <GotposStatCard
          title="Total Customers"
          value={customers.length}
          subtitle="Active customer directory"
          theme="navy"
          icon={<Users className="w-5 h-5" />}
          onClick={() => setFilterType("ALL")}
          className="cursor-pointer"
        />

        {/* Wholesale Customers */}
        <GotposStatCard
          title="Wholesale Customers"
          value={wholesaleCount}
          subtitle="Wholesale accounts & dealers"
          theme="emerald"
          icon={<Store className="w-5 h-5" />}
          onClick={() => setFilterType("WHOLESALE")}
          className="cursor-pointer"
        />

        {/* Retail Farmers */}
        <GotposStatCard
          title="Retail Farmers"
          value={retailCount}
          subtitle="Local farmers & growers"
          theme="orange"
          icon={<Sprout className="w-5 h-5" />}
          onClick={() => setFilterType("RETAIL")}
          className="cursor-pointer"
        />
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs sm:text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
          <button onClick={onClearSuccessMessage} className="cursor-pointer text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs sm:text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={onClearErrorMessage} className="cursor-pointer text-red-600 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            data-primary-search="true"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                focusFirstTableRow()
              } else if (
                e.key === "ArrowLeft" &&
                e.currentTarget.selectionStart === 0 &&
                e.currentTarget.selectionEnd === 0
              ) {
                e.preventDefault()
                focusSidebarMenu()
              }
            }}
            placeholder="Search by name, business, phone, or village..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-50 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
              filterType === "ALL"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            All ({customers.length})
          </button>
          <button
            onClick={() => setFilterType("HAS_DUE")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
              filterType === "HAS_DUE"
                ? "bg-red-600 text-white shadow-xs"
                : "text-red-600 hover:bg-red-50"
            }`}
          >
            Has Due ({customersWithDueCount})
          </button>
          <button
            onClick={() => setFilterType("WHOLESALE")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
              filterType === "WHOLESALE"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Wholesale Customers ({wholesaleCount})
          </button>
          <button
            onClick={() => setFilterType("RETAIL")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
              filterType === "RETAIL"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Retail Farmers ({retailCount})
          </button>
        </div>
      </div>

      {/* Customers List Table / Cards */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin inline-block mb-2" />
            <p className="text-sm">Loading customer data...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <Search className="w-10 h-10 inline-block mb-2" />
            <p className="text-base font-semibold text-slate-900">No customers found!</p>
            <p className="text-xs mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold">
                  <tr>
                    <th className="px-4 py-3">Customer Profile</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Address / Village</th>
                    <th className="px-3 py-3">Contact & WhatsApp</th>
                    <th className="px-4 py-3 text-right">Total Buy</th>
                    <th className="px-4 py-3 text-right">Current Due</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60">
                  {paginatedCustomers.map((c) => {
                    const due = Number(c.currentDue) || 0
                    const waUrl = formatWhatsAppUrl(c.whatsappNumber || c.phone, c.name, due)

                    return (
                      <tr
                        key={c.id}
                        tabIndex={0}
                        data-nav-row="true"
                        onClick={() => onOpenPurchases(c)}
                        onKeyDown={(e) => {
                          const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-nav-row="true"]'))
                          const currentIndex = rows.indexOf(e.currentTarget)
                          if (e.key === "ArrowDown" && currentIndex < rows.length - 1) {
                            e.preventDefault()
                            rows[currentIndex + 1]?.focus()
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault()
                            if (currentIndex > 0) {
                              rows[currentIndex - 1]?.focus()
                            } else {
                              focusPrimarySearch()
                            }
                          } else if (e.key === "ArrowLeft") {
                            e.preventDefault()
                            focusSidebarMenu()
                          } else if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            onOpenPurchases(c)
                          }
                        }}
                        className={`hover:bg-emerald-50/40 cursor-pointer transition-colors focus:outline-none focus:bg-emerald-50 focus:ring-2 focus:ring-emerald-600 ${
                          due > 0 ? "bg-red-50/15" : ""
                        }`}
                        title="Click row to view all invoice purchases and items"
                      >
                        {/* Name and Business */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                            <span>{c.name}</span>
                            <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-700" />
                          </div>
                          {c.businessName && (
                            <div className="text-xs font-semibold text-emerald-800 mt-0.5 flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5" /> {c.businessName}
                            </div>
                          )}
                          {c.fatherName && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Father: {c.fatherName}
                            </div>
                          )}
                        </td>

                        {/* Type Badge */}
                        <td className="px-3 py-3">
                          {c.customerType === "WHOLESALE" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              Wholesale Customer
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Retail Farmer
                            </span>
                          )}
                        </td>

                        {/* Village */}
                        <td className="px-3 py-3 text-slate-500">
                          {c.villageAddress ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{c.villageAddress}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Contact & WhatsApp */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 tabular-nums text-slate-900 font-medium">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{c.phone}</span>
                          </div>
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                              title="Send a WhatsApp payment reminder for the current due"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp Reminder</span>
                            </a>
                          )}
                        </td>

                        {/* Total Buy (Lifetime Purchases) */}
                        <td className="px-4 py-3 text-right">
                          <div className="tabular-nums font-bold text-slate-900 text-sm">
                            {tk(c.totalPurchases || 0)}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Lifetime Purchases
                          </div>
                        </td>

                        {/* Current Due */}
                        <td className="px-4 py-3 text-right">
                          <div
                            className={`tabular-nums font-bold text-base ${
                              due > 0 ? "text-red-600" : "text-emerald-700"
                            }`}
                          >
                            {tk(due)}
                          </div>
                          {due === 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                              Settled <Check className="w-3 h-3" />
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Invoices Drilldown Button */}
                            <button
                              type="button"
                              data-testid={`btn-purchases-${c.id}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenPurchases(c)
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer shadow-xs"
                              title="View all purchases, invoices, and purchased items"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" /> Invoices
                            </button>

                            {/* Payment Button */}
                            <button
                              type="button"
                              data-testid={`btn-collect-due-${c.id}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenRepayModal(c)
                              }}
                              disabled={due <= 0}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-emerald-700 hover:bg-emerald-800 text-white"
                              title="Record a due repayment with a Money Receipt (MR No.)"
                            >
                              <Banknote className="w-3.5 h-3.5" /> Collect Due
                            </button>

                            {/* Ledger Drawer Button */}
                            <button
                              type="button"
                              data-testid={`btn-ledger-${c.id}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenLedger(c)
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 transition-all cursor-pointer"
                              title="View the customer's full ledger and audit statement"
                            >
                              <ClipboardList className="w-3.5 h-3.5" /> Ledger
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={customerPage}
              pageSize={customerPageSize}
              totalElements={filteredCustomers.length}
              onPageChange={setCustomerPage}
              onPageSizeChange={(newSize) => {
                setCustomerPageSize(newSize)
                setCustomerPage(0)
              }}
              pageSizeOptions={[10, 15, 25, 50]}
              itemLabel="customers"
            />
          </>
        )}
      </div>
    </div>
  )
}
