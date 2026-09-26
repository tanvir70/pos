import React, { useState, useMemo, useEffect } from "react"
import type { Customer } from "../../types"
import Pagination from "../ui/Pagination"
import GotposStatCard from "../dashboard/GotposStatCard"
import RefreshButton from "../ui/RefreshButton"
import { BadgeAlert, Users, Store, UserCheck } from "lucide-react"
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
  onOpenDetail: (customer: Customer) => void
  onOpenEdit: (customer: Customer) => void
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
  onOpenDetail,
  onOpenEdit,
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
      const landMatch = c.landArea?.toLowerCase().includes(q)
      return nameMatch || bizMatch || phoneMatch || villageMatch || landMatch
    })
  }, [customers, filterType, search])

  // Reset page on search or filter change
  useEffect(() => {
    setCustomerPage(0)
  }, [search, filterType])

  const paginatedCustomers = useMemo(() => {
    const start = customerPage * customerPageSize
    return filteredCustomers.slice(start, start + customerPageSize)
  }, [filteredCustomers, customerPage, customerPageSize])

  // Metrics
  const totalMarketDue = useMemo(() => {
    return customers.reduce((sum, c) => sum + Math.max(0, Number(c.currentDue) || 0), 0)
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

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Customer Directory & Ledgers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage customer accounts, purchase history, land records, and ledger balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="btn-add-customer"
            onClick={onOpenAddCustomer}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white transition-colors"
          >
            Add Customer
          </button>
          <RefreshButton
            onClick={onRefresh}
            isLoading={isLoading}
            title="Refresh customer accounts"
          />
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <GotposStatCard
          title="Total Outstanding Due"
          value={tk(totalMarketDue)}
          subtitle={`${customersWithDueCount} customer(s) with dues`}
          theme="rose"
          icon={<BadgeAlert className="w-5 h-5" />}
          valueColor="text-rose-600"
          onClick={() => setFilterType("HAS_DUE")}
          className={`cursor-pointer transition-all ${
            filterType === "HAS_DUE" ? "ring-2 ring-rose-500 shadow-sm" : ""
          }`}
        />

        <GotposStatCard
          title="Total Customers"
          value={customers.length}
          subtitle="Active customer accounts"
          theme="navy"
          icon={<Users className="w-5 h-5" />}
          onClick={() => setFilterType("ALL")}
          className={`cursor-pointer transition-all ${
            filterType === "ALL" ? "ring-2 ring-slate-800 shadow-sm" : ""
          }`}
        />

        <GotposStatCard
          title="Wholesale Customers"
          value={wholesaleCount}
          subtitle="Dealers & sub-stockists"
          theme="blue"
          icon={<Store className="w-5 h-5" />}
          onClick={() => setFilterType("WHOLESALE")}
          className={`cursor-pointer transition-all ${
            filterType === "WHOLESALE" ? "ring-2 ring-blue-500 shadow-sm" : ""
          }`}
        />

        <GotposStatCard
          title="Retail Farmers"
          value={retailCount}
          subtitle="Local growers & farmers"
          theme="teal"
          icon={<UserCheck className="w-5 h-5" />}
          onClick={() => setFilterType("RETAIL")}
          className={`cursor-pointer transition-all ${
            filterType === "RETAIL" ? "ring-2 ring-teal-500 shadow-sm" : ""
          }`}
        />
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={onClearSuccessMessage}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs font-medium flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={onClearErrorMessage}
            className="text-xs text-red-700 hover:text-red-900 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs">
        <div className="relative flex-1">
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
            placeholder="Search by name, phone, village, land area, or business..."
            className="w-full h-9 px-3 border border-slate-200 rounded-md text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-700"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              filterType === "ALL"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All ({customers.length})
          </button>
          <button
            onClick={() => setFilterType("HAS_DUE")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              filterType === "HAS_DUE"
                ? "bg-red-600 text-white shadow-xs"
                : "text-red-600 hover:bg-red-50"
            }`}
          >
            Has Due ({customersWithDueCount})
          </button>
          <button
            onClick={() => setFilterType("WHOLESALE")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              filterType === "WHOLESALE"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Wholesale ({wholesaleCount})
          </button>
          <button
            onClick={() => setFilterType("RETAIL")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              filterType === "RETAIL"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Retail ({retailCount})
          </button>
        </div>
      </div>

      {/* Main Customers Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-500">
            Loading customer accounts...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">
            No customers found matching the selected criteria.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-medium">
                  <tr>
                    <th className="px-4 py-2.5">Customer & Profile</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Land Area</th>
                    <th className="px-3 py-2.5">Village / Address</th>
                    <th className="px-3 py-2.5">Phone</th>
                    <th className="px-4 py-2.5 text-right">Lifetime Buy</th>
                    <th className="px-4 py-2.5 text-right">Current Due</th>
                    <th className="px-4 py-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCustomers.map((c) => {
                    const due = Math.max(0, Number(c.currentDue) || 0)

                    return (
                      <tr
                        key={c.id}
                        tabIndex={0}
                        data-nav-row="true"
                        onClick={() => onOpenDetail(c)}
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
                            onOpenDetail(c)
                          }
                        }}
                        className={`hover:bg-slate-50/80 cursor-pointer transition-colors focus:outline-none focus:bg-slate-100 ${
                          due > 0 ? "bg-red-50/20" : ""
                        }`}
                      >
                        {/* Name & Subtitle */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 text-sm">
                            {c.name}
                          </div>
                          {c.businessName && (
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              {c.businessName}
                            </div>
                          )}
                        </td>

                        {/* Customer Type Badge */}
                        <td className="px-3 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 bg-slate-100 text-slate-800">
                            {c.customerType === "WHOLESALE" ? "Wholesale" : "Retail"}
                          </span>
                        </td>

                        {/* Land Area */}
                        <td className="px-3 py-3">
                          {c.landArea ? (
                            <span className="font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                              {c.landArea}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Address */}
                        <td className="px-3 py-3 text-slate-600">
                          {c.villageAddress || c.address || <span className="text-slate-400">—</span>}
                        </td>

                        {/* Phone */}
                        <td className="px-3 py-3">
                          <div className="tabular-nums font-medium text-slate-900">
                            {c.phone}
                          </div>
                        </td>

                        {/* Lifetime Purchases */}
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                          {tk(c.totalPurchases || 0)}
                        </td>

                        {/* Current Due */}
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`tabular-nums font-semibold ${
                              due > 0 ? "text-red-600" : "text-emerald-700"
                            }`}
                          >
                            {tk(due)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View & Ledger Details */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenDetail(c)
                              }}
                              className="px-2.5 py-1 rounded text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 transition-colors"
                            >
                              Ledger & Details
                            </button>

                            {/* Quick Edit */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenEdit(c)
                              }}
                              className="px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            >
                              Edit
                            </button>

                            {/* Collect Due */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenRepayModal(c)
                              }}
                              disabled={due <= 0}
                              className="px-2.5 py-1 rounded text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              Collect Due
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
