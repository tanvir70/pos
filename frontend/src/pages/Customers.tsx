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
  Package,
  Calendar,
  Eye,
  ArrowUpRight,
  Receipt,
} from "lucide-react"
import type { Customer, CustomerRequest, CustomerLedger, CustomerPaymentRequest, CustomerType, PaymentMethod, SaleResponse } from "../types"
import { getCustomers, createCustomer, getCustomerLedger, recordPayment, getCustomerPurchases, getNextDueInvoiceNo } from "../api/endpoints"
import DueCollectionReceipt, { type DueReceiptData } from "../components/DueCollectionReceipt"
import ThermalReceipt from "../components/ThermalReceipt"
import GotposStatCard from "../components/dashboard/GotposStatCard"

// BUSINESS DECISION: Direct WhatsApp messaging automatically formats Bangladesh mobile numbers to +880
// international format and generates a pre-composed polite balance reminder message.
// BUSINESS DECISION: Money Receipt (MR No.) auto-suggests 'MR-<timestamp>' if no manual
// serial from the physical paper memo book, ensuring unbroken voucher traceability for rural debt collections.
// BUSINESS DECISION: Customer credit limit tracks utilization percentage and renders an amber/red warning
// badge when due balance reaches or exceeds the agreed ceiling to prevent uncollateralized credit defaults.

type FilterType = "ALL" | "WHOLESALE" | "RETAIL" | "HAS_DUE"

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Customers() {
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
  const [dueReceiptToPrint, setDueReceiptToPrint] = useState<DueReceiptData | null>(null)
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedger[]>([])
  const [isLedgerLoading, setIsLedgerLoading] = useState<boolean>(false)
  const [statementViewMode, setStatementViewMode] = useState<"table" | "thermal">("table")

  // Customer Purchases Drilldown Modal
  const [purchasesCustomer, setPurchasesCustomer] = useState<Customer | null>(null)
  const [purchasesList, setPurchasesList] = useState<SaleResponse[]>([])
  const [isPurchasesLoading, setIsPurchasesLoading] = useState<boolean>(false)
  const [purchasesSearch, setPurchasesSearch] = useState<string>("")
  const [invoiceToPrint, setInvoiceToPrint] = useState<SaleResponse | null>(null)

  // Add Customer Form
  const [newCustomerForm, setNewCustomerForm] = useState<CustomerRequest>({
    name: "",
    fatherName: "",
    businessName: "",
    phone: "",
    whatsappNumber: "",
    villageAddress: "",
    customerType: "RETAIL",
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

  const filteredPurchases = useMemo(() => {
    if (!purchasesSearch.trim()) return purchasesList
    const q = purchasesSearch.trim().toLowerCase()
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
  }, [purchasesList, purchasesSearch])

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
    const message = `Assalamu Alaikum ${name || "valued customer"}, this is Rajib Enterprise (authorized agrochemical dealer). Your current outstanding due balance is: ${tk(due || 0)}. Please contact the shop for details. Thank you.`
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
  }

  // Auto-generate suggested Due Invoice No starting with DUE-
  const generateSuggestedMrNo = () => {
    const d = new Date()
    const dateCode =
      d.getFullYear().toString() +
      (d.getMonth() + 1).toString().padStart(2, "0") +
      d.getDate().toString().padStart(2, "0")
    const timeCode =
      d.getHours().toString().padStart(2, "0") +
      d.getMinutes().toString().padStart(2, "0") +
      d.getSeconds().toString().padStart(2, "0")
    return `DUE-${dateCode}-${timeCode}`
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

  // ─── Customer Purchases Drilldown Action ────────────────────────────
  const handleOpenPurchases = async (customer: Customer) => {
    setPurchasesCustomer(customer)
    setIsPurchasesLoading(true)
    setPurchasesSearch("")
    try {
      const data = await getCustomerPurchases(customer.id)
      setPurchasesList(data)
    } catch (err: any) {
      console.error("Error loading customer purchases:", err)
      setPurchasesList([])
    } finally {
      setIsPurchasesLoading(false)
    }
  }

  // ─── Repayment Action ───────────────────────────────────────────────
  const handleOpenRepayModal = async (customer: Customer) => {
    setRepayCustomer(customer)
    setRepayAmount("")
    setRepayMethod("CASH")
    setRepayNotes("")
    setRepayError(null)
    try {
      const res = await getNextDueInvoiceNo()
      setRepayMrNo(res.dueInvoiceNo)
    } catch {
      setRepayMrNo(generateSuggestedMrNo())
    }
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
      const trimmed = repayMrNo.trim()
      const rawReceiptNo = trimmed || generateSuggestedMrNo()
      const finalReceiptNo = rawReceiptNo.toUpperCase().startsWith("DUE-")
        ? rawReceiptNo
        : rawReceiptNo.toUpperCase().startsWith("#DUE-")
          ? rawReceiptNo.slice(1)
          : `DUE-${rawReceiptNo}`

      const payload: CustomerPaymentRequest = {
        amount: amountNum,
        paymentMethod: repayMethod,
        moneyReceiptNo: finalReceiptNo,
        notes: repayNotes.trim() || undefined,
      }

      const previousDue = repayCustomer.currentDue
      const remainingDue = Math.max(0, previousDue - amountNum)

      await recordPayment(repayCustomer.id, payload)

      const receiptData: DueReceiptData = {
        receiptNo: finalReceiptNo,
        customer: {
          id: repayCustomer.id,
          name: repayCustomer.name,
          phone: repayCustomer.phone,
          fatherName: repayCustomer.fatherName,
          businessName: repayCustomer.businessName,
          villageAddress: repayCustomer.villageAddress,
          address: repayCustomer.address,
          customerType: repayCustomer.customerType,
        },
        amountPaid: amountNum,
        previousDue,
        remainingDue,
        paymentMethod: repayMethod,
        notes: repayNotes.trim() || undefined,
        date: new Date().toISOString(),
        cashierName: "Rajib",
      }

      setSuccessMessage(`Due payment of ${tk(amountNum)} recorded successfully! Receipt #${finalReceiptNo} ready.`)
      setRepayCustomer(null)
      setDueReceiptToPrint(receiptData)
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
                  <th className="px-4 py-3 text-right">Total Buy</th>
                  <th className="px-4 py-3 text-right">Current Due</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {filteredCustomers.map((c) => {
                  const due = Number(c.currentDue) || 0
                  const waUrl = formatWhatsAppUrl(c.whatsappNumber || c.phone, c.name, due)

                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenPurchases(c)}
                      className={`hover:bg-emerald-50/40 cursor-pointer transition-colors ${
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
                              handleOpenPurchases(c)
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
                              handleOpenRepayModal(c)
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
                              handleOpenLedger(c)
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
                type="button"
                data-testid="close-add-modal"
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
                type="button"
                data-testid="close-repay-modal"
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

              {/* Due Invoice */}
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">
                  Due Invoice
                </label>
                <input
                  type="text"
                  value={repayMrNo}
                  disabled
                  readOnly
                  placeholder="DUE-YYYYMMDD-XXXXXX"
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-700 font-mono rounded-lg text-sm cursor-not-allowed select-none"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Sequential auto-incremented due receipt voucher number.
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  maxLength={200}
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                  placeholder="e.g. Paid from paddy sale proceeds"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden resize-none h-14 leading-tight"
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

      {/* ─── Customer Purchases Drilldown Modal ────────────────────── */}
      {purchasesCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-5 sm:p-6 my-6 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 shrink-0">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-lg shrink-0">
                  {purchasesCustomer.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                      {purchasesCustomer.name}
                    </h2>
                    {purchasesCustomer.customerType === "WHOLESALE" ? (
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
                    {purchasesCustomer.businessName && (
                      <span className="flex items-center gap-1 font-semibold text-emerald-800">
                        <Building2 className="w-3.5 h-3.5" /> {purchasesCustomer.businessName}
                      </span>
                    )}
                    {purchasesCustomer.fatherName && (
                      <span>Father: {purchasesCustomer.fatherName}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {purchasesCustomer.phone}
                    </span>
                    {purchasesCustomer.villageAddress && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {purchasesCustomer.villageAddress}
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
                    const c = purchasesCustomer
                    setPurchasesCustomer(null)
                    handleOpenRepayModal(c)
                  }}
                  disabled={(purchasesCustomer.currentDue || 0) <= 0}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Collect Due</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const c = purchasesCustomer
                    setPurchasesCustomer(null)
                    handleOpenLedger(c)
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Ledger</span>
                </button>
                <button
                  type="button"
                  data-testid="close-purchases-modal"
                  onClick={() => setPurchasesCustomer(null)}
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
                  {tk(purchasesCustomer.totalPurchases || 0)}
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
                  {tk(purchasesCustomer.currentDue || 0)}
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
                  value={purchasesSearch}
                  onChange={(e) => setPurchasesSearch(e.target.value)}
                  placeholder="Filter invoice or product..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Invoices List (Scrollable) */}
            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {isPurchasesLoading ? (
                <div className="py-16 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin inline-block mb-1" />
                  <p className="text-xs">Loading purchase records...</p>
                </div>
              ) : filteredPurchases.length === 0 ? (
                <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                  <ShoppingCart className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                  <p className="text-sm font-semibold text-slate-700">No purchase records found</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {purchasesSearch ? "No matches for this search query." : "This customer has not made any invoice purchases yet."}
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
                            onClick={() => setInvoiceToPrint(sale)}
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
      )}

      {/* ─── Customer Ledger Statement Drawer / Modal ──────────────── */}
      {ledgerCustomer && (
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
                  onClick={handlePrintLedger}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-black transition-colors cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print 80mm</span>
                </button>
                <button
                  type="button"
                  data-testid="close-ledger-modal"
                  onClick={() => setLedgerCustomer(null)}
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
                    <span className="text-slate-500 block">Total Buy (Lifetime):</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {tk(ledgerCustomer.totalPurchases || 0)}
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
                      <span className="font-bold">{ledgerCustomer.name}</span>
                    </div>
                    {ledgerCustomer.businessName && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">Business:</span>
                        <span>{ledgerCustomer.businessName}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-600">Mobile:</span>
                      <span>{ledgerCustomer.phone}</span>
                    </div>
                    {ledgerCustomer.villageAddress && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600">Village:</span>
                        <span>{ledgerCustomer.villageAddress}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-dotted border-gray-300">
                      <span className="font-medium text-gray-700">Total Buy (Lifetime):</span>
                      <span className="font-bold">{tk(ledgerCustomer.totalPurchases || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-red-600">Outstanding Due:</span>
                      <span className="font-bold text-red-600">{tk(ledgerCustomer.currentDue || 0)}</span>
                    </div>
                  </div>

                  {/* Transactions 80mm List */}
                  <div className="pb-2 mb-2 border-b border-dashed border-gray-500">
                    <div className="text-[10px] font-bold uppercase pb-1 mb-1.5 border-b border-dotted border-gray-400 flex justify-between">
                      <span>Transaction Records</span>
                      <span>{ledgerEntries.length} Items</span>
                    </div>
                    <div className="space-y-2">
                      {ledgerEntries.map((item) => (
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
                      <span className="text-red-600 font-bold">{tk(ledgerCustomer.currentDue)}</span>
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
                <span className="font-bold">{ledgerCustomer.name}</span>
              </div>
              {ledgerCustomer.businessName && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-600">Business:</span>
                  <span>{ledgerCustomer.businessName}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-600">Mobile:</span>
                <span>{ledgerCustomer.phone}</span>
              </div>
              {ledgerCustomer.villageAddress && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-600">Village:</span>
                  <span>{ledgerCustomer.villageAddress}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-dotted border-gray-300">
                <span className="font-medium text-gray-700">Total Buy (Lifetime):</span>
                <span className="font-bold">{tk(ledgerCustomer.totalPurchases || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-red-600">Outstanding Due:</span>
                <span className="font-bold text-red-600">{tk(ledgerCustomer.currentDue || 0)}</span>
              </div>
            </div>

            {/* Transactions 80mm List */}
            <div className="pb-2 mb-2 border-b border-dashed border-gray-500">
              <div className="text-[10px] font-bold uppercase pb-1 mb-1.5 border-b border-dotted border-gray-400 flex justify-between">
                <span>Transaction Records</span>
                <span>{ledgerEntries.length} Items</span>
              </div>
              <div className="space-y-2">
                {ledgerEntries.map((item) => (
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
                <span className="text-red-600 font-bold">{tk(ledgerCustomer.currentDue)}</span>
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

      {/* ─── Invoice Thermal Reprint Modal ─────────────────────────── */}
      {invoiceToPrint && (
        <ThermalReceipt
          sale={invoiceToPrint}
          autoPrint={false}
          onClose={() => setInvoiceToPrint(null)}
        />
      )}

      {/* ─── Due Collection Thermal Receipt Modal ──────────────────── */}
      {dueReceiptToPrint && (
        <DueCollectionReceipt
          data={dueReceiptToPrint}
          autoPrint={true}
          onClose={() => setDueReceiptToPrint(null)}
        />
      )}
    </div>
  )
}
