import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Plus,
  MessageCircle,
  MapPin,
  AlertTriangle,
  Check,
  Smartphone,
  X,
  Users,
  ClipboardList,
  Phone,
  Building2,
  Sprout,
  User,
  Landmark,
  Save,
  BookOpen,
  Search,
  ShoppingCart,
  Store,
  Banknote,
  CheckCircle2,
  Printer,
  RefreshCw,
  Loader2,
} from "lucide-react"
import type { Customer, CustomerRequest, CustomerLedger, CustomerPaymentRequest, CustomerType, PaymentMethod } from "../types"
import { getCustomers, createCustomer, getCustomerLedger, recordPayment } from "../api/endpoints"

// BUSINESS DECISION: Direct WhatsApp messaging automatically formats Bangladesh mobile numbers to +880
// international format and generates a pre-composed polite balance reminder message.
// BUSINESS DECISION: Money Receipt (MR No.) auto-suggests 'MR-<timestamp>' if cashier doesn't enter a manual
// serial from the physical paper memo book, ensuring unbroken voucher traceability for rural debt collections.
// BUSINESS DECISION: Customer credit limit tracks utilization percentage and renders an amber/red warning
// badge when due balance reaches or exceeds the agreed ceiling to prevent uncollateralized credit defaults.

export interface CustomersProps {
  isOwner: boolean
}

type FilterType = "ALL" | "WHOLESALE" | "RETAIL" | "HAS_DUE"

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Customers({ isOwner }: CustomersProps) {
  // ─── State ──────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filters & Search
  const [search, setSearch] = useState<string>("")
  const [filterType, setFilterType] = useState<FilterType>("ALL")

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false)
  const [repayCustomer, setRepayCustomer] = useState<Customer | null>(null)
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedger[]>([])
  const [isLedgerLoading, setIsLedgerLoading] = useState<boolean>(false)

  // Add Customer Form
  const [newCustomerForm, setNewCustomerForm] = useState<CustomerRequest>({
    name: "",
    fatherName: "",
    businessName: "",
    phone: "",
    whatsappNumber: "",
    villageAddress: "",
    customerType: "RETAIL",
    creditLimit: 20000,
    initialDue: 0,
    mfsType: "",
    mfsNumber: "",
    bankName: "",
    bankBranch: "",
    bankAccountNo: "",
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSavingCustomer, setIsSavingCustomer] = useState<boolean>(false)

  // Repayment Form
  const [repayAmount, setRepayAmount] = useState<string>("")
  const [repayMethod, setRepayMethod] = useState<PaymentMethod>("CASH")
  const [repayMrNo, setRepayMrNo] = useState<string>("")
  const [repayNotes, setRepayNotes] = useState<string>("")
  const [repayError, setRepayError] = useState<string | null>(null)
  const [isSavingRepayment, setIsSavingRepayment] = useState<boolean>(false)

  // ─── Data Fetching ──────────────────────────────────────────────────
  const loadCustomers = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const data = await getCustomers()
      setCustomers(data)
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to load customer list.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  // Clear feedback messages after 4 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // ─── Filtered Customers ─────────────────────────────────────────────
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

  // ─── Helper Functions ───────────────────────────────────────────────
  const formatWhatsAppUrl = (phone?: string | null, name?: string, due?: number) => {
    if (!phone) return null
    // Clean numbers
    let digits = phone.replace(/\D/g, "")
    if (digits.startsWith("0")) {
      digits = "880" + digits.slice(1)
    } else if (!digits.startsWith("880") && digits.length === 10) {
      digits = "880" + digits
    }
    const message = `Assalamu Alaikum ${name || "valued customer"}, this is Al-Amin Traders (authorized agrochemical dealer). Your current outstanding due balance is: ${tk(due || 0)}. Please contact the shop for details. Thank you.`
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
  }

  // Auto-generate suggested MR No
  const generateSuggestedMrNo = () => {
    const d = new Date()
    const timeCode = d.getHours().toString().padStart(2, "0") + d.getMinutes().toString().padStart(2, "0") + d.getSeconds().toString().padStart(2, "0")
    return `MR-${timeCode}`
  }

  // ─── Add Customer Action ────────────────────────────────────────────
  const handleOpenAddModal = () => {
    setNewCustomerForm({
      name: "",
      fatherName: "",
      businessName: "",
      phone: "",
      whatsappNumber: "",
      villageAddress: "",
      customerType: "RETAIL",
      creditLimit: 20000,
      initialDue: 0,
      mfsType: "",
      mfsNumber: "",
      bankName: "",
      bankBranch: "",
      bankAccountNo: "",
    })
    setFormError(null)
    setIsAddModalOpen(true)
  }

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomerForm.name.trim()) {
      setFormError("Customer name is required!")
      return
    }
    if (!newCustomerForm.phone.trim()) {
      setFormError("Mobile number is required!")
      return
    }

    try {
      setIsSavingCustomer(true)
      setFormError(null)
      await createCustomer({
        ...newCustomerForm,
        name: newCustomerForm.name.trim(),
        phone: newCustomerForm.phone.trim(),
        creditLimit: Number(newCustomerForm.creditLimit) || 0,
        initialDue: Number(newCustomerForm.initialDue) || 0,
      })
      setSuccessMessage("New customer added successfully!")
      setIsAddModalOpen(false)
      await loadCustomers()
    } catch (err: any) {
      setFormError(err?.message || "Failed to save customer.")
    } finally {
      setIsSavingCustomer(false)
    }
  }

  // ─── Repayment Action ───────────────────────────────────────────────
  const handleOpenRepayModal = (customer: Customer) => {
    setRepayCustomer(customer)
    setRepayAmount("")
    setRepayMethod("CASH")
    setRepayMrNo(generateSuggestedMrNo())
    setRepayNotes("")
    setRepayError(null)
  }

  const handleSaveRepayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repayCustomer) return

    const amountNum = parseFloat(repayAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setRepayError("Enter a valid repayment amount!")
      return
    }
    if (amountNum > repayCustomer.currentDue) {
      setRepayError(`You can repay up to a maximum of the current due of ${tk(repayCustomer.currentDue)}.`)
      return
    }

    try {
      setIsSavingRepayment(true)
      setRepayError(null)
      const payload: CustomerPaymentRequest = {
        amount: amountNum,
        paymentMethod: repayMethod,
        moneyReceiptNo: repayMrNo.trim() || generateSuggestedMrNo(),
        notes: repayNotes.trim() || undefined,
      }
      await recordPayment(repayCustomer.id, payload)
      setSuccessMessage(`Payment of ${tk(amountNum)} recorded successfully with Money Receipt (${payload.moneyReceiptNo})!`)
      setRepayCustomer(null)
      await loadCustomers()
    } catch (err: any) {
      setRepayError(err?.message || "Failed to save payment.")
    } finally {
      setIsSavingRepayment(false)
    }
  }

  // ─── Ledger Drawer Action ───────────────────────────────────────────
  const handleOpenLedger = async (customer: Customer) => {
    setLedgerCustomer(customer)
    setIsLedgerLoading(true)
    try {
      const data = await getCustomerLedger(customer.id)
      setLedgerEntries(data)
    } catch (err: any) {
      console.error("Error loading ledger:", err)
      setLedgerEntries([])
    } finally {
      setIsLedgerLoading(false)
    }
  }

  const handlePrintLedger = () => {
    window.print()
  }

  return (
    <div className="space-y-5">
      {/* Top Header & Quick Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <span>Customer Due Ledger</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Due balances for wholesale and retail customers, Money Receipt collection, and audit statements
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Customer</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Due */}
        <div className="bg-white border border-red-200 rounded-xl p-4 bg-red-50/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-600">Total Outstanding Due</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-red-700 tabular-nums mt-1.5">
            {tk(totalMarketDue)}
          </p>
          <p className="text-[11px] text-red-500/90 mt-0.5">
            {customersWithDueCount} customers have outstanding dues
          </p>
        </div>

        {/* Total Customers */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Registered Customers</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-1.5">
            {customers.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Active customer directory
          </p>
        </div>

        {/* Wholesale Count */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Wholesale Customers</span>
            <Store className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-1.5">
            {wholesaleCount}
          </p>
          <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
            Wholesale customer accounts
          </p>
        </div>

        {/* Retail Count */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Retail Farmers</span>
            <Sprout className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-1.5">
            {retailCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Local farmers and orchard owners
          </p>
        </div>
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs sm:text-sm font-semibold flex items-center justify-between">
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
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs sm:text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="cursor-pointer text-red-600 hover:text-red-900">
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
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold">
                <tr>
                  <th className="px-4 py-3">Customer Profile</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Address / Village</th>
                  <th className="px-3 py-3">Contact & WhatsApp</th>
                  <th className="px-4 py-3 text-right">Credit Limit</th>
                  <th className="px-4 py-3 text-right">Current Due</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {filteredCustomers.map((c) => {
                  const due = Number(c.currentDue) || 0
                  const limit = Number(c.creditLimit) || 0
                  const isOverLimit = limit > 0 && due > limit
                  const duePercent = limit > 0 ? Math.min(100, Math.round((due / limit) * 100)) : 0
                  const waUrl = formatWhatsAppUrl(c.whatsappNumber || c.phone, c.name, due)

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/40 transition-colors ${
                        due > 0 ? "bg-red-50/15" : ""
                      }`}
                    >
                      {/* Name and Business */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 text-sm sm:text-base">
                          {c.name}
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
                            className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                            title="Send a WhatsApp payment reminder for the current due"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp Reminder</span>
                          </a>
                        )}
                      </td>

                      {/* Credit Limit */}
                      <td className="px-4 py-3 text-right">
                        <div className="tabular-nums font-semibold text-slate-900">
                          {limit > 0 ? tk(limit) : "Unlimited"}
                        </div>
                        {limit > 0 && (
                          <div className="w-24 ml-auto mt-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${
                                isOverLimit
                                  ? "bg-red-600"
                                  : duePercent > 75
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${duePercent}%` }}
                            />
                          </div>
                        )}
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
                        {isOverLimit && (
                          <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold text-red-700 bg-red-100 border border-red-200 rounded px-1.5 py-0.2">
                            <AlertTriangle className="w-3 h-3" /> Over Limit!
                          </span>
                        )}
                        {due === 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            Settled <Check className="w-3 h-3" />
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Payment Button */}
                          <button
                            onClick={() => handleOpenRepayModal(c)}
                            disabled={due <= 0}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-emerald-700 hover:bg-emerald-800 text-white"
                            title="Record a due repayment with a Money Receipt (MR No.)"
                          >
                            <Banknote className="w-3.5 h-3.5" /> Collect Due
                          </button>

                          {/* Ledger Drawer Button */}
                          <button
                            onClick={() => handleOpenLedger(c)}
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
        )}
      </div>

      {/* ─── Add Customer Modal ─────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-5 sm:p-6 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-slate-900" />
                <h3 className="font-bold text-slate-900 text-lg">
                  New Customer Registration Form
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-500 hover:text-slate-900 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-300 rounded-lg text-red-700 text-xs font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {formError}
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomerForm.name}
                    onChange={(e) =>
                      setNewCustomerForm({ ...newCustomerForm, name: e.target.value })
                    }
                    placeholder="e.g. Haji Abdur Rahman"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                {/* Father's Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1">
                    Father's Name
                  </label>
                  <input
                    type="text"
                    value={newCustomerForm.fatherName || ""}
                    onChange={(e) =>
                      setNewCustomerForm({
                        ...newCustomerForm,
                        fatherName: e.target.value,
                      })
                    }
                    placeholder="e.g. Late Kachim Ali"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                {/* Business Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1">
                    Business Name / Shop Name
                  </label>
                  <input
                    type="text"
                    value={newCustomerForm.businessName || ""}
                    onChange={(e) =>
                      setNewCustomerForm({
                        ...newCustomerForm,
                        businessName: e.target.value,
                      })
                    }
                    placeholder="e.g. Rahman Traders / Farm Enterprise"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomerForm.phone}
                    onChange={(e) =>
                      setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })
                    }
                    placeholder="017xxxxxxxx"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden tabular-nums"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={newCustomerForm.whatsappNumber || ""}
                    onChange={(e) =>
                      setNewCustomerForm({
                        ...newCustomerForm,
                        whatsappNumber: e.target.value,
                      })
                    }
                    placeholder="017xxxxxxxx (leave blank to use phone number)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden tabular-nums"
                  />
                </div>

                {/* Village / Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1">
                    Village / Area / Address
                  </label>
                  <input
                    type="text"
                    value={newCustomerForm.villageAddress || ""}
                    onChange={(e) =>
                      setNewCustomerForm({
                        ...newCustomerForm,
                        villageAddress: e.target.value,
                      })
                    }
                    placeholder="e.g. Kandapara, Belabo"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                {/* Customer Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1">
                    Customer Type *
                  </label>
                  <select
                    value={newCustomerForm.customerType}
                    onChange={(e) =>
                      setNewCustomerForm({
                        ...newCustomerForm,
                        customerType: e.target.value as CustomerType,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden bg-white"
                  >
                    <option value="RETAIL">Retail Farmer</option>
                    <option value="WHOLESALE">Wholesale Customer</option>
                  </select>
                </div>

                {/* Credit Limit */}
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1">
                    Maximum Credit Limit (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={newCustomerForm.creditLimit || ""}
                    onChange={(e) =>
                      setNewCustomerForm({
                        ...newCustomerForm,
                        creditLimit: Number(e.target.value) || 0,
                      })
                    }
                    placeholder="20,000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden tabular-nums"
                  />
                </div>

                {/* Initial Due */}
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1">
                    Opening Due Balance (if any, ৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={newCustomerForm.initialDue || ""}
                    onChange={(e) =>
                      setNewCustomerForm({
                        ...newCustomerForm,
                        initialDue: Number(e.target.value) || 0,
                      })
                    }
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden tabular-nums"
                  />
                </div>

                {/* MFS Type & Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1">
                    Mobile Financial Service (bKash/Nagad)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newCustomerForm.mfsType || ""}
                      onChange={(e) =>
                        setNewCustomerForm({
                          ...newCustomerForm,
                          mfsType: e.target.value,
                        })
                      }
                      className="px-2 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="">Not specified</option>
                      <option value="bKash">bKash</option>
                      <option value="Nagad">Nagad</option>
                      <option value="Rocket">Rocket</option>
                      <option value="Upay">Upay</option>
                    </select>
                    <input
                      type="text"
                      value={newCustomerForm.mfsNumber || ""}
                      onChange={(e) =>
                        setNewCustomerForm({
                          ...newCustomerForm,
                          mfsNumber: e.target.value,
                        })
                      }
                      placeholder="MFS number"
                      className="px-2 py-2 border border-slate-200 rounded-lg text-xs tabular-nums"
                    />
                  </div>
                </div>

                {/* Bank Info */}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50/40 p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={newCustomerForm.bankName || ""}
                      onChange={(e) =>
                        setNewCustomerForm({
                          ...newCustomerForm,
                          bankName: e.target.value,
                        })
                      }
                      placeholder="e.g. Sonali Bank"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                      Branch
                    </label>
                    <input
                      type="text"
                      value={newCustomerForm.bankBranch || ""}
                      onChange={(e) =>
                        setNewCustomerForm({
                          ...newCustomerForm,
                          bankBranch: e.target.value,
                        })
                      }
                      placeholder="e.g. Belabo Branch"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                      Account No.
                    </label>
                    <input
                      type="text"
                      value={newCustomerForm.bankAccountNo || ""}
                      onChange={(e) =>
                        setNewCustomerForm({
                          ...newCustomerForm,
                          bankAccountNo: e.target.value,
                        })
                      }
                      placeholder="A/C No."
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingCustomer ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Customer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Due Repayment Modal with MR No ─────────────────────────── */}
      {repayCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-slate-900" />
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                  Collect Due & Money Receipt (MR No.)
                </h3>
              </div>
              <button
                onClick={() => setRepayCustomer(null)}
                className="text-slate-500 hover:text-slate-900 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Info Box */}
            <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <p className="font-bold text-slate-900 text-sm">
                  {repayCustomer.name}
                </p>
                {repayCustomer.businessName && (
                  <p className="text-xs text-emerald-800 font-semibold">
                    {repayCustomer.businessName}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {repayCustomer.phone}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-red-500 font-semibold">Current Due</p>
                <p className="text-xl font-bold text-red-600 tabular-nums">
                  {tk(repayCustomer.currentDue)}
                </p>
              </div>
            </div>

            {repayError && (
              <div className="mt-3 p-2 bg-red-50 border border-red-300 rounded-lg text-red-700 text-xs font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {repayError}
              </div>
            )}

            <form onSubmit={handleSaveRepayment} className="mt-4 space-y-3.5">
              {/* Repay Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">
                  Repayment Amount (৳) *
                </label>
                <input
                  type="number"
                  required
                  step="1"
                  min="1"
                  max={repayCustomer.currentDue}
                  value={repayAmount}
                  onChange={(e) => {
                    setRepayAmount(e.target.value)
                    setRepayError(null)
                  }}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border-2 border-emerald-600/40 rounded-lg text-lg font-bold tabular-nums focus:border-emerald-600 focus:outline-hidden"
                  autoFocus
                />

                {/* Quick Shortcut Buttons (50%, 75%, 100%) */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRepayAmount(Math.round(repayCustomer.currentDue * 0.5).toString())
                      setRepayError(null)
                    }}
                    className="py-1 px-2 border border-slate-200 rounded text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    50% ({tk(Math.round(repayCustomer.currentDue * 0.5))})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRepayAmount(Math.round(repayCustomer.currentDue * 0.75).toString())
                      setRepayError(null)
                    }}
                    className="py-1 px-2 border border-slate-200 rounded text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    75% ({tk(Math.round(repayCustomer.currentDue * 0.75))})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRepayAmount(repayCustomer.currentDue.toString())
                      setRepayError(null)
                    }}
                    className="py-1 px-2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-bold hover:bg-emerald-200 transition-colors"
                  >
                    Full Due (100%)
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">
                  Payment Method *
                </label>
                <select
                  value={repayMethod}
                  onChange={(e) => setRepayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white"
                >
                  <option value="CASH">Cash</option>
                  <option value="BKASH">bKash</option>
                  <option value="NAGAD">Nagad</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              {/* Money Receipt No (MR No.) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-900">
                    Money Receipt No. (MR No. / Receipt Book Serial)
                  </label>
                  <button
                    type="button"
                    onClick={() => setRepayMrNo(generateSuggestedMrNo())}
                    className="flex items-center gap-1 text-[11px] text-emerald-700 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Auto-generate
                  </button>
                </div>
                <input
                  type="text"
                  value={repayMrNo}
                  onChange={(e) => setRepayMrNo(e.target.value)}
                  placeholder="e.g. MR-1042 or receipt no."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Enter the paper Money Receipt book number so records can be reconciled later.
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">
                  Notes / Remarks (optional)
                </label>
                <input
                  type="text"
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                  placeholder="e.g. Paid from paddy sale proceeds"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setRepayCustomer(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRepayment}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingRepayment ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm Payment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Customer Ledger Statement Drawer / Modal ──────────────── */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-5 sm:p-6 my-6 print:m-0 print:p-0 print:border-none print:shadow-none print-area">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 no-print">
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
                <button
                  onClick={handlePrintLedger}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-black transition-colors cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Statement</span>
                </button>
                <button
                  onClick={() => setLedgerCustomer(null)}
                  className="text-slate-500 hover:text-slate-900 cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Shop Banner Header */}
            <div className="text-center py-3 border-b border-dashed border-slate-200 mb-4">
              <h2 className="text-xl font-bold text-slate-900">
                Al-Amin Traders
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
            <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 sm:p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Customer Name:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {ledgerCustomer.name}
                </span>
                {ledgerCustomer.businessName && (
                  <span className="flex items-center gap-1 font-semibold text-emerald-800 text-xs mt-0.5">
                    <Building2 className="w-3 h-3" /> {ledgerCustomer.businessName}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500 block">Contact:</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {ledgerCustomer.phone}
                </span>
                <span className="block text-slate-500 mt-0.5">
                  {ledgerCustomer.villageAddress || "No village listed"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Credit Limit:</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {ledgerCustomer.creditLimit > 0 ? tk(ledgerCustomer.creditLimit) : "Unlimited"}
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  {ledgerCustomer.customerType === "WHOLESALE" ? "Wholesale Customer" : "Retail Farmer"}
                </span>
              </div>
              <div className="text-right sm:text-right">
                <span className="text-red-500 font-semibold block">Latest Due Balance:</span>
                <span className="text-lg font-bold text-red-600 tabular-nums">
                  {tk(ledgerCustomer.currentDue)}
                </span>
              </div>
            </div>

            {/* Ledger Entries Table */}
            {isLedgerLoading ? (
              <div className="py-16 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin inline-block mb-1" />
                <p>Loading ledger audit records...</p>
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                <p className="text-sm font-semibold">No transaction records found.</p>
                <p className="text-xs mt-1">This customer has no previous invoices or payments.</p>
              </div>
            ) : (
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
                    {ledgerEntries.map((item) => {
                      const isPayment = item.transactionType === "CASH_PAYMENT"
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
                                <Banknote className="w-3 h-3" /> Cash Collection
                              </span>
                            )}
                            {isReturn && (
                              <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                <RefreshCw className="w-3 h-3" /> Product Return Adjustment
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
                  Al-Amin Traders
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
