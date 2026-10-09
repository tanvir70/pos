import React, { useState, useMemo, useEffect } from "react"
import type { Customer } from "../../types"
import Pagination from "../ui/Pagination"
import GotposStatCard from "../dashboard/GotposStatCard"
import RefreshButton from "../ui/RefreshButton"
import Button from "../ui/Button"
import {
  BadgeAlert,
  Users,
  Store,
  UserCheck,
  Plus,
  Edit,
  BookOpen,
  Wallet,
} from "lucide-react"
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Customer Directory & Ledgers
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage customer accounts, purchase history, land records, and ledger balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            data-testid="btn-add-customer"
            onClick={onOpenAddCustomer}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Customer
          </Button>
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
          valueColor="text-rose-600 dark:text-rose-400"
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
            filterType === "ALL" ? "ring-2 ring-slate-800 dark:ring-emerald-500 shadow-sm" : ""
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
        <div className="p-3 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 rounded-lg text-emerald-800 text-xs font-medium flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={onClearSuccessMessage}
            className="text-xs text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100 font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 dark:bg-rose-950/60 dark:border-rose-900/80 dark:text-rose-300 rounded-lg text-red-800 text-xs font-medium flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={onClearErrorMessage}
            className="text-xs text-red-700 hover:text-red-900 dark:text-rose-300 dark:hover:text-rose-100 font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl p-3 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs">
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
            className="w-full h-9 px-3 border border-slate-200 dark:border-slate-800 rounded-md text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 bg-white dark:bg-slate-950 dark:text-slate-100"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              filterType === "ALL"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            All ({customers.length})
          </button>
          <button
            onClick={() => setFilterType("HAS_DUE")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              filterType === "HAS_DUE"
                ? "bg-red-600 text-white shadow-xs"
                : "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            }`}
          >
            Has Due ({customersWithDueCount})
          </button>
          <button
            onClick={() => setFilterType("WHOLESALE")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              filterType === "WHOLESALE"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Wholesale ({wholesaleCount})
          </button>
          <button
            onClick={() => setFilterType("RETAIL")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              filterType === "RETAIL"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Retail ({retailCount})
          </button>
        </div>
      </div>

      {/* Main Customers Table */}
      <div className="bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400">
            Loading customer accounts...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400">
            No customers found matching the selected criteria.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium">
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
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedCustomers.map((c) => {
                    const due = Number(c.currentDue) || 0

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
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer transition-colors focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800 ${
                          due > 0 ? "bg-red-50/20 dark:bg-red-950/20" : due < 0 ? "bg-emerald-50/20 dark:bg-emerald-950/20" : ""
                        }`}
                      >
                        {/* Name & Subtitle */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                            {c.name}
                          </div>
                          {c.businessName && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                              {c.businessName}
                            </div>
                          )}
                        </td>

                        {/* Customer Type Badge */}
                        <td className="px-3 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300">
                            {c.customerType === "WHOLESALE" ? "Wholesale" : "Retail"}
                          </span>
                        </td>

                        {/* Land Area */}
                        <td className="px-3 py-3">
                          {c.landArea ? (
                            <span className="font-medium text-slate-900 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700">
                              {c.landArea}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>

                        {/* Address */}
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                          {c.villageAddress || c.address || <span className="text-slate-400 dark:text-slate-500">—</span>}
                        </td>

                        {/* Phone */}
                        <td className="px-3 py-3">
                          <div className="tabular-nums font-medium text-slate-900 dark:text-slate-200">
                            {c.phone}
                          </div>
                        </td>

                        {/* Lifetime Purchases */}
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-200">
                          {tk(c.totalPurchases || 0)}
                        </td>

                        {/* Current Due */}
                        <td className="px-4 py-3 text-right">
                          {due > 0 ? (
                            <span className="tabular-nums font-semibold text-red-600 dark:text-red-400">
                              {tk(due)}
                            </span>
                          ) : due < 0 ? (
                            <span
                              className="tabular-nums font-semibold text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 text-[11px]"
                              title="Customer store credit / advance balance from returns or overpayment"
                            >
                              +{tk(Math.abs(due))} (Cr)
                            </span>
                          ) : (
                            <span className="tabular-nums font-medium text-slate-500 dark:text-slate-400">
                              {tk(0)}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* View & Ledger Details */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenDetail(c)
                              }}
                              title={`View ledger and purchase details for ${c.name}`}
                              leftIcon={<BookOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
                              className="text-xs px-2 py-1 border-slate-200 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-teal-950/60 text-slate-700 dark:text-slate-300 hover:text-teal-900 dark:hover:text-teal-300"
                            >
                              Ledger & Details
                            </Button>

                            {/* Quick Edit */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenEdit(c)
                              }}
                              title={`Edit profile and details for ${c.name}`}
                              leftIcon={<Edit className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />}
                              className="text-xs px-2 py-1 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                            >
                              Edit
                            </Button>

                            {/* Collect Due */}
                            {due > 0 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onOpenRepayModal(c)
                                }}
                                title={`Collect outstanding due (${tk(due)}) for ${c.name}`}
                                leftIcon={<Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                                className="text-xs px-2 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-semibold"
                              >
                                Collect Due
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                title={`Customer ${c.name} has settled all dues (৳0.00)`}
                                leftIcon={<Wallet className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />}
                                className="text-xs px-2 py-1 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed"
                              >
                                Collect Due
                              </Button>
                            )}
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
