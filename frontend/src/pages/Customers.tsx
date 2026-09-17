import { useState, useEffect, useMemo, useCallback } from "react"
import type { Customer, CustomerRequest, CustomerLedger, CustomerPaymentRequest, CustomerType, PaymentMethod } from "../types"
import { getCustomers, createCustomer, getCustomerLedger, recordPayment } from "../api/endpoints"

// BUSINESS DECISION: Direct WhatsApp messaging automatically formats Bangladesh mobile numbers to +880
// international format and generates a pre-composed polite Bengali balance reminder message.
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
      setErrorMessage(err?.message || "কাস্টমার তালিকা লোড করতে ব্যর্থ হয়েছে।")
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
    const message = `আসসালামু আলাইকুম ${name || "সম্মানিত গ্রাহক"} ভাই, আল-আমিন ট্রেডার্স (অনুমোদিত কৃষি পরিবেশক) থেকে আপনার বর্তমান বাকি হিসাব: ${tk(due || 0)}। বিস্তারিত জানতে দোকানে যোগাযোগের অনুরোধ রইল। ধন্যবাদ।`
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
      setFormError("কাস্টমারের নাম আবশ্যক!")
      return
    }
    if (!newCustomerForm.phone.trim()) {
      setFormError("মোবাইল নম্বর আবশ্যক!")
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
      setSuccessMessage("নতুন কাস্টমার সফলভাবে যুক্ত হয়েছে!")
      setIsAddModalOpen(false)
      await loadCustomers()
    } catch (err: any) {
      setFormError(err?.message || "কাস্টমার সংরক্ষণে ত্রুটি হয়েছে।")
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
      setRepayError("সঠিক পরিশোধের পরিমাণ লিখুন!")
      return
    }
    if (amountNum > repayCustomer.currentDue) {
      setRepayError(`সর্বোচ্চ বর্তমান বাকি ${tk(repayCustomer.currentDue)} পর্যন্ত পরিশোধ করা যাবে।`)
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
      setSuccessMessage(`মানি রিসিট (${payload.moneyReceiptNo}) সহ ${tk(amountNum)} পরিশোধ সফলভাবে সংরক্ষিত হয়েছে!`)
      setRepayCustomer(null)
      await loadCustomers()
    } catch (err: any) {
      setRepayError(err?.message || "পরিশোধ সংরক্ষণে ত্রুটি হয়েছে।")
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
          <h1 className="text-xl sm:text-2xl font-bold text-frost-dark bn-text flex items-center gap-2">
            <span>📒</span>
            <span>গ্রাহক ও বাকি খাতা (Customer Due Ledger)</span>
          </h1>
          <p className="text-xs sm:text-sm text-frost-muted bn-text mt-0.5">
            পাইকারি ডিলার ও খুচরা কৃষকদের বাকি হিসাব, মানি রিসিট সংগ্রহ ও অডিট স্টেটমেন্ট
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer bn-text text-sm"
        >
          <span>➕</span>
          <span>নতুন কাস্টমার নিবন্ধন</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Due */}
        <div className="bg-white border border-red-200 rounded-xl p-4 bg-red-50/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-600 bn-text">মোট বকেয়া / বাকি</span>
            <span className="text-base">🚨</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-red-700 tabular-nums mt-1.5">
            {tk(totalMarketDue)}
          </p>
          <p className="text-[11px] text-red-500/90 bn-text mt-0.5">
            {customersWithDueCount} জন কৃষকের কাছে বাকি
          </p>
        </div>

        {/* Total Customers */}
        <div className="bg-white border border-frost-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-frost-muted bn-text">মোট নিবন্ধিত গ্রাহক</span>
            <span className="text-base">👥</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-frost-dark tabular-nums mt-1.5">
            {customers.length} জন
          </p>
          <p className="text-[11px] text-frost-muted bn-text mt-0.5">
            সক্রিয় কাস্টমার তালিকা
          </p>
        </div>

        {/* Wholesale Count */}
        <div className="bg-white border border-frost-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-frost-muted bn-text">পাইকারি ডিলার</span>
            <span className="text-base">🏪</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-frost-dark tabular-nums mt-1.5">
            {wholesaleCount} জন
          </p>
          <p className="text-[11px] text-emerald-700 font-medium bn-text mt-0.5">
            সাব-ডিলার ও পাইকারি প্রোফাইল
          </p>
        </div>

        {/* Retail Count */}
        <div className="bg-white border border-frost-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-frost-muted bn-text">খুচরা কৃষক</span>
            <span className="text-base">🌾</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-frost-dark tabular-nums mt-1.5">
            {retailCount} জন
          </p>
          <p className="text-[11px] text-frost-muted bn-text mt-0.5">
            স্থানীয় জমির চাষী ও বাগান মালিক
          </p>
        </div>
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs sm:text-sm font-semibold bn-text flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="cursor-pointer text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs sm:text-sm font-semibold bn-text flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="cursor-pointer text-red-600 hover:text-red-900">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-frost-border rounded-xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-frost-muted">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="নাম, ব্যবসা প্রতিষ্ঠান, ফোন বা গ্রাম দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-4 py-2 border border-frost-border rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden bn-text bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-frost-muted hover:text-frost-dark cursor-pointer"
            >
              মুছুন
            </button>
          )}
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-frost-surface p-1 rounded-lg border border-frost-border">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer bn-text ${
              filterType === "ALL"
                ? "bg-white text-frost-dark shadow-xs"
                : "text-frost-muted hover:text-frost-dark"
            }`}
          >
            সকল ({customers.length})
          </button>
          <button
            onClick={() => setFilterType("HAS_DUE")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer bn-text ${
              filterType === "HAS_DUE"
                ? "bg-red-600 text-white shadow-xs"
                : "text-red-600 hover:bg-red-50"
            }`}
          >
            বাকি আছে ({customersWithDueCount})
          </button>
          <button
            onClick={() => setFilterType("WHOLESALE")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer bn-text ${
              filterType === "WHOLESALE"
                ? "bg-white text-frost-dark shadow-xs"
                : "text-frost-muted hover:text-frost-dark"
            }`}
          >
            পাইকারি ডিলার ({wholesaleCount})
          </button>
          <button
            onClick={() => setFilterType("RETAIL")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer bn-text ${
              filterType === "RETAIL"
                ? "bg-white text-frost-dark shadow-xs"
                : "text-frost-muted hover:text-frost-dark"
            }`}
          >
            খুচরা কৃষক ({retailCount})
          </button>
        </div>
      </div>

      {/* Customers List Table / Cards */}
      <div className="bg-white border border-frost-border rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-frost-muted bn-text">
            <span className="text-3xl animate-spin inline-block mb-2">⏳</span>
            <p className="text-sm">কাস্টমার তথ্য লোড হচ্ছে...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-20 text-center text-frost-muted bn-text">
            <span className="text-4xl inline-block mb-2">🔍</span>
            <p className="text-base font-semibold text-frost-dark">কোনো কাস্টমার পাওয়া যায়নি!</p>
            <p className="text-xs mt-1">অনুসন্ধান বা ফিল্টার পরিবর্তন করে দেখুন।</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-frost-surface border-b border-frost-border text-frost-dark bn-text font-bold">
                <tr>
                  <th className="px-4 py-3">কাস্টমার প্রোফাইল</th>
                  <th className="px-3 py-3">ধরণ</th>
                  <th className="px-3 py-3">ঠিকানা / গ্রাম</th>
                  <th className="px-3 py-3">যোগাযোগ ও WhatsApp</th>
                  <th className="px-4 py-3 text-right">ক্রেডিট লিমিট</th>
                  <th className="px-4 py-3 text-right">বর্তমান বাকি</th>
                  <th className="px-4 py-3 text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-frost-border/60">
                {filteredCustomers.map((c) => {
                  const due = Number(c.currentDue) || 0
                  const limit = Number(c.creditLimit) || 0
                  const isOverLimit = limit > 0 && due > limit
                  const duePercent = limit > 0 ? Math.min(100, Math.round((due / limit) * 100)) : 0
                  const waUrl = formatWhatsAppUrl(c.whatsappNumber || c.phone, c.name, due)

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-frost-surface/40 transition-colors ${
                        due > 0 ? "bg-red-50/15" : ""
                      }`}
                    >
                      {/* Name and Business */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-frost-dark bn-text text-sm sm:text-base">
                          {c.name}
                        </div>
                        {c.businessName && (
                          <div className="text-xs font-semibold text-emerald-800 bn-text mt-0.5">
                            🏢 {c.businessName}
                          </div>
                        )}
                        {c.fatherName && (
                          <div className="text-[11px] text-frost-muted bn-text mt-0.5">
                            পিতা: {c.fatherName}
                          </div>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="px-3 py-3">
                        {c.customerType === "WHOLESALE" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200 bn-text">
                            পাইকারি ডিলার
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 bn-text">
                            খুচরা কৃষক
                          </span>
                        )}
                      </td>

                      {/* Village */}
                      <td className="px-3 py-3 bn-text text-frost-muted">
                        {c.villageAddress ? (
                          <span className="flex items-center gap-1">
                            <span>📍</span>
                            <span>{c.villageAddress}</span>
                          </span>
                        ) : (
                          <span className="text-frost-muted/50">—</span>
                        )}
                      </td>

                      {/* Contact & WhatsApp */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5 tabular-nums text-frost-dark font-medium">
                          <span>📞</span>
                          <span>{c.phone}</span>
                        </div>
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                            title="হোয়াটসঅ্যাপে বর্তমান বাকির তাগাদা মেসেজ পাঠান"
                          >
                            <span>💬</span>
                            <span>WhatsApp বাকি তাগাদা</span>
                          </a>
                        )}
                      </td>

                      {/* Credit Limit */}
                      <td className="px-4 py-3 text-right">
                        <div className="tabular-nums font-semibold text-frost-dark">
                          {limit > 0 ? tk(limit) : "অসীমিত"}
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
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-red-700 bg-red-100 border border-red-200 rounded px-1.5 py-0.2 bn-text">
                            ⚠️ লিমিট অতিক্রম!
                          </span>
                        )}
                        {due === 0 && (
                          <span className="text-[11px] text-emerald-700 bn-text font-medium">
                            পরিশোধিত ✓
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
                            className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer bn-text disabled:opacity-30 disabled:cursor-not-allowed bg-emerald-700 hover:bg-emerald-800 text-white"
                            title="মানি রিসিট (MR No) সহ বাকি আদায় জমা করুন"
                          >
                            💵 বাকি আদায়
                          </button>

                          {/* Ledger Drawer Button */}
                          <button
                            onClick={() => handleOpenLedger(c)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-frost-surface hover:bg-frost-hover text-frost-dark border border-frost-border transition-all cursor-pointer bn-text"
                            title="গ্রাহকের পূর্ণাঙ্গ হিসাব খাতা ও অডিট স্টেটমেন্ট দেখুন"
                          >
                            📋 খাতা / লেজার
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
          <div className="bg-white rounded-2xl shadow-2xl border border-frost-border max-w-2xl w-full p-5 sm:p-6 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-frost-border">
              <div className="flex items-center gap-2">
                <span className="text-xl">👤</span>
                <h3 className="font-bold text-frost-dark bn-text text-lg">
                  নতুন কাস্টমার নিবন্ধন ফরম
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-frost-muted hover:text-frost-dark text-lg leading-none cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-300 rounded-lg text-red-700 text-xs font-semibold bn-text">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                    কাস্টমারের নাম *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomerForm.name}
                    onChange={(e) =>
                      setNewCustomerForm({ ...newCustomerForm, name: e.target.value })
                    }
                    placeholder="যেমন: হাজী আব্দুর রহমান"
                    className="w-full px-3 py-2 border border-frost-border rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden bn-text"
                  />
                </div>

                {/* Father's Name */}
                <div>
                  <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                    পিতার নাম
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
                    placeholder="যেমন: মরহুম কাছিম আলী"
                    className="w-full px-3 py-2 border border-frost-border rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden bn-text"
                  />
                </div>

                {/* Business Name */}
                <div>
                  <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                    ব্যবসা প্রতিষ্ঠান / দোকানের নাম
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
                    placeholder="যেমন: রহমান ফার্টিলাইজার (ডিলারদের ক্ষেত্রে)"
                    className="w-full px-3 py-2 border border-frost-border rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden bn-text"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                    মোবাইল নম্বর *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomerForm.phone}
                    onChange={(e) =>
                      setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })
                    }
                    placeholder="০১৭xxxxxxxx"
                    className="w-full px-3 py-2 border border-frost-border rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden tabular-nums"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                    হোয়াটসঅ্যাপ নম্বর
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
                    placeholder="০১৭xxxxxxxx (খালি রাখলে ফোন নম্বর ব্যবহৃত হবে)"
                    className="w-full px-3 py-2 border border-frost-border rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden tabular-nums"
                  />
                </div>

                {/* Village / Address */}
                <div>
                  <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                    গ্রাম / এলাকা / ঠিকানা
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
                    placeholder="যেমন: কান্দাপাড়া, বেলাবো"
                    className="w-full px-3 py-2 border border-frost-border rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden bn-text"
                  />
                </div>

                {/* Customer Type */}
                <div>
                  <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                    কাস্টমার ধরণ *
                  </label>
                  <select
                    value={newCustomerForm.customerType}
                    onChange={(e) =>
                      setNewCustomerForm({
                        ...newCustomerForm,
                        customerType: e.target.value as CustomerType,
                      })
                    }
                    className="w-full px-3 py-2 border border-frost-border rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden bn-text bg-white"
                  >
                    <option value="RETAIL">খুচরা কৃষক (Retail Farmer)</option>
                    <option value="WHOLESALE">পাইকারি ডিলার (Wholesale Dealer)</option>
                  </select>
                </div>

                {/* Credit Limit */}
                <div>
                  <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                    সর্বোচ্চ বাকির সীমা / ক্রেডিট লিমিট (৳)
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
                    placeholder="২০,০০০"
                    className="w-full px-3 py-2 border border-frost-border rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden tabular-nums"
                  />
                </div>

                {/* Initial Due */}
                <div>
                  <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                    পূর্বের প্রারম্ভিক বাকি (যদি থাকে ৳)
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
                    placeholder="০.০০"
                    className="w-full px-3 py-2 border border-frost-border rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden tabular-nums"
                  />
                </div>

                {/* MFS Type & Number */}
                <div>
                  <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                    মোবাইল ব্যাংকিং (বিকাশ/নগদ)
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
                      className="px-2 py-2 border border-frost-border rounded-lg text-xs bn-text bg-white"
                    >
                      <option value="">চিহ্নিত নেই</option>
                      <option value="bKash">বিকাশ</option>
                      <option value="Nagad">নগদ</option>
                      <option value="Rocket">রকেট</option>
                      <option value="Upay">উপায়</option>
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
                      placeholder="MFS নম্বর"
                      className="px-2 py-2 border border-frost-border rounded-lg text-xs tabular-nums"
                    />
                  </div>
                </div>

                {/* Bank Info */}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-frost-surface/40 p-2.5 rounded-lg border border-frost-border">
                  <div>
                    <label className="block text-[11px] font-semibold text-frost-muted mb-0.5 bn-text">
                      ব্যাংকের নাম
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
                      placeholder="যেমন: সোনালী ব্যাংক"
                      className="w-full px-2 py-1.5 border border-frost-border rounded-md text-xs bn-text"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-frost-muted mb-0.5 bn-text">
                      শাখা (Branch)
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
                      placeholder="যেমন: বেলাবো শাখা"
                      className="w-full px-2 py-1.5 border border-frost-border rounded-md text-xs bn-text"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-frost-muted mb-0.5 bn-text">
                      হিসাব নম্বর (Account No)
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
                      placeholder="A/C নং"
                      className="w-full px-2 py-1.5 border border-frost-border rounded-md text-xs tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-frost-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-frost-muted hover:bg-frost-hover cursor-pointer bn-text"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer bn-text flex items-center gap-1.5"
                >
                  {isSavingCustomer ? (
                    <>
                      <span className="animate-spin text-xs">⏳</span>
                      <span>সংরক্ষণ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>কাস্টমার সেভ করুন</span>
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
          <div className="bg-white rounded-2xl shadow-2xl border border-frost-border max-w-md w-full p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-frost-border">
              <div className="flex items-center gap-2">
                <span className="text-xl">💵</span>
                <h3 className="font-bold text-frost-dark bn-text text-base sm:text-lg">
                  বাকি আদায় ও মানি রিসিট (MR No)
                </h3>
              </div>
              <button
                onClick={() => setRepayCustomer(null)}
                className="text-frost-muted hover:text-frost-dark text-lg leading-none cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Customer Info Box */}
            <div className="mt-3 bg-frost-surface p-3 rounded-xl border border-frost-border flex justify-between items-center">
              <div>
                <p className="font-bold text-frost-dark bn-text text-sm">
                  {repayCustomer.name}
                </p>
                {repayCustomer.businessName && (
                  <p className="text-xs text-emerald-800 font-semibold bn-text">
                    {repayCustomer.businessName}
                  </p>
                )}
                <p className="text-xs text-frost-muted mt-0.5">
                  📞 {repayCustomer.phone}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-red-500 font-semibold bn-text">বর্তমান বাকি</p>
                <p className="text-xl font-bold text-red-600 tabular-nums">
                  {tk(repayCustomer.currentDue)}
                </p>
              </div>
            </div>

            {repayError && (
              <div className="mt-3 p-2 bg-red-50 border border-red-300 rounded-lg text-red-700 text-xs font-semibold bn-text">
                ⚠️ {repayError}
              </div>
            )}

            <form onSubmit={handleSaveRepayment} className="mt-4 space-y-3.5">
              {/* Repay Amount */}
              <div>
                <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                  পরিশোধের পরিমাণ (৳) *
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
                  placeholder="০.০০"
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
                    className="py-1 px-2 border border-frost-border rounded text-xs font-semibold hover:bg-frost-surface transition-colors bn-text"
                  >
                    ৫০% ({tk(Math.round(repayCustomer.currentDue * 0.5))})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRepayAmount(Math.round(repayCustomer.currentDue * 0.75).toString())
                      setRepayError(null)
                    }}
                    className="py-1 px-2 border border-frost-border rounded text-xs font-semibold hover:bg-frost-surface transition-colors bn-text"
                  >
                    ৭৫% ({tk(Math.round(repayCustomer.currentDue * 0.75))})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRepayAmount(repayCustomer.currentDue.toString())
                      setRepayError(null)
                    }}
                    className="py-1 px-2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-bold hover:bg-emerald-200 transition-colors bn-text"
                  >
                    পূর্ণ বাকি (১০০%)
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                  পরিশোধের মাধ্যম *
                </label>
                <select
                  value={repayMethod}
                  onChange={(e) => setRepayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-frost-border rounded-lg text-xs sm:text-sm bn-text bg-white"
                >
                  <option value="CASH">💵 নগদ (Cash)</option>
                  <option value="BKASH">📱 বিকাশ (bKash)</option>
                  <option value="NAGAD">📱 নগদ (Nagad)</option>
                  <option value="BANK_TRANSFER">🏦 ব্যাংক ট্রান্সফার (Bank Transfer)</option>
                </select>
              </div>

              {/* Money Receipt No (MR No.) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-frost-dark bn-text">
                    মানি রিসিট নম্বর (MR No. / রসিদ বইয়ের ক্রমিক)
                  </label>
                  <button
                    type="button"
                    onClick={() => setRepayMrNo(generateSuggestedMrNo())}
                    className="text-[11px] text-emerald-700 hover:underline cursor-pointer bn-text"
                  >
                    স্বয়ংক্রিয় নম্বর দিন
                  </button>
                </div>
                <input
                  type="text"
                  value={repayMrNo}
                  onChange={(e) => setRepayMrNo(e.target.value)}
                  placeholder="যেমন: MR-1042 অথবা রসিদ নং"
                  className="w-full px-3 py-2 border border-frost-border rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden font-mono"
                />
                <p className="text-[11px] text-frost-muted bn-text mt-0.5">
                  কাগজের মানি রিসিট বইয়ের নম্বর লিখুন যাতে পরবর্তীতে হিসাব মেলানো যায়।
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-frost-dark mb-1 bn-text">
                  মন্তব্য / বিবরণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                  placeholder="যেমন: ধান বিক্রির টাকা থেকে পরিশোধ"
                  className="w-full px-3 py-2 border border-frost-border rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden bn-text"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-frost-border">
                <button
                  type="button"
                  onClick={() => setRepayCustomer(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-frost-muted hover:bg-frost-hover cursor-pointer bn-text"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSavingRepayment}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer bn-text flex items-center gap-1.5"
                >
                  {isSavingRepayment ? (
                    <>
                      <span className="animate-spin text-xs">⏳</span>
                      <span>সংরক্ষণ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <span>✅</span>
                      <span>জমা নিশ্চিত করুন</span>
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
          <div className="bg-white rounded-2xl shadow-2xl border border-frost-border max-w-3xl w-full p-5 sm:p-6 my-6 print:m-0 print:p-0 print:border-none print:shadow-none print-area">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-frost-border no-print">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📋</span>
                <div>
                  <h3 className="font-bold text-frost-dark bn-text text-lg">
                    গ্রাহকের লেজার স্টেটমেন্ট (Ledger Audit)
                  </h3>
                  <p className="text-xs text-frost-muted bn-text">
                    সমস্ত চালান বিল, নগদ পরিশোধ ও সমন্বয় অডিট বিবরণ
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintLedger}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-frost-dark text-white hover:bg-black transition-colors cursor-pointer shadow-xs bn-text"
                >
                  <span>🖨️</span>
                  <span>প্রিন্ট স্টেটমেন্ট</span>
                </button>
                <button
                  onClick={() => setLedgerCustomer(null)}
                  className="text-frost-muted hover:text-frost-dark text-xl leading-none cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Shop Banner Header */}
            <div className="text-center py-3 border-b border-dashed border-frost-border mb-4">
              <h2 className="text-xl font-bold text-frost-dark bn-text">
                আল-আমিন ট্রেডার্স (Al-Amin Traders)
              </h2>
              <p className="text-xs text-emerald-800 font-semibold bn-text">
                অনুমোদিত কৃষি পরিবেশক
              </p>
              <p className="text-xs text-frost-muted bn-text mt-0.5">
                উত্তর বাজার, বেলাবো, নরসিংদী · মোবাইল: ০১৭১১-১২৩৪৫৬
              </p>
              <div className="inline-block mt-1 bg-frost-surface px-3 py-0.5 rounded text-xs font-bold bn-text text-frost-dark border border-frost-border">
                গ্রাহক খাতা ও বাকি বিবরণী
              </div>
            </div>

            {/* Customer Info Card */}
            <div className="bg-frost-surface/50 border border-frost-border rounded-xl p-3 sm:p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-frost-muted bn-text block">কাস্টমার নাম:</span>
                <span className="font-bold text-frost-dark bn-text text-sm">
                  {ledgerCustomer.name}
                </span>
                {ledgerCustomer.businessName && (
                  <span className="block font-semibold text-emerald-800 bn-text text-xs mt-0.5">
                    🏢 {ledgerCustomer.businessName}
                  </span>
                )}
              </div>
              <div>
                <span className="text-frost-muted bn-text block">যোগাযোগ:</span>
                <span className="font-semibold text-frost-dark tabular-nums">
                  {ledgerCustomer.phone}
                </span>
                <span className="block text-frost-muted bn-text mt-0.5">
                  {ledgerCustomer.villageAddress || "গ্রাম উল্লেখ নেই"}
                </span>
              </div>
              <div>
                <span className="text-frost-muted bn-text block">ক্রেডিট লিমিট:</span>
                <span className="font-bold text-frost-dark tabular-nums">
                  {ledgerCustomer.creditLimit > 0 ? tk(ledgerCustomer.creditLimit) : "অসীমিত"}
                </span>
                <span className="block text-[11px] text-frost-muted bn-text mt-0.5">
                  {ledgerCustomer.customerType === "WHOLESALE" ? "পাইকারি ডিলার" : "খুচরা কৃষক"}
                </span>
              </div>
              <div className="text-right sm:text-right">
                <span className="text-red-500 font-semibold bn-text block">সর্বশেষ বাকি জের:</span>
                <span className="text-lg font-bold text-red-600 tabular-nums">
                  {tk(ledgerCustomer.currentDue)}
                </span>
              </div>
            </div>

            {/* Ledger Entries Table */}
            {isLedgerLoading ? (
              <div className="py-16 text-center text-frost-muted bn-text">
                <span className="text-2xl animate-spin inline-block mb-1">⏳</span>
                <p>লেজার অডিট হিসাব আনা হচ্ছে...</p>
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="py-12 text-center text-frost-muted bn-text border border-dashed border-frost-border rounded-xl">
                <p className="text-sm font-semibold">কোনো লেনদেনের রেকর্ড নেই।</p>
                <p className="text-xs mt-1">এই কাস্টমারের কোনো পূর্ববর্তী চালান বা পরিশোধ নেই।</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-frost-border rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-frost-surface border-b border-frost-border text-frost-dark bn-text font-bold">
                    <tr>
                      <th className="px-3 py-2.5">তারিখ</th>
                      <th className="px-3 py-2.5">বিবরণ / লেনদেন ধরণ</th>
                      <th className="px-2 py-2.5">MR / চালান নং</th>
                      <th className="px-3 py-2.5 text-right text-red-600">ডেবিট (বাকি ৳)</th>
                      <th className="px-3 py-2.5 text-right text-emerald-600">ক্রেডিট (জমা ৳)</th>
                      <th className="px-3 py-2.5 text-right font-bold">অবশিষ্ট জের (৳)</th>
                      <th className="px-3 py-2.5">মন্তব্য</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-frost-border/60">
                    {ledgerEntries.map((item) => {
                      const isPayment = item.transactionType === "CASH_PAYMENT"
                      const isReturn = item.transactionType === "RETURN_CREDIT"
                      const isInvoice = item.transactionType === "INVOICE_BILL"

                      return (
                        <tr key={item.id} className="hover:bg-frost-surface/30">
                          <td className="px-3 py-2 whitespace-nowrap text-frost-muted tabular-nums">
                            {item.transactionDate
                              ? new Date(item.transactionDate).toLocaleDateString("bn-BD")
                              : "—"}
                          </td>
                          <td className="px-3 py-2 bn-text font-semibold">
                            {isPayment && (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <span>💵</span> নগদ আদায়
                              </span>
                            )}
                            {isReturn && (
                              <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                <span>🔄</span> পণ্য ফেরত সমন্বয়
                              </span>
                            )}
                            {isInvoice && (
                              <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                <span>🛒</span> পণ্য বিক্রয় চালান
                              </span>
                            )}
                            {!isPayment && !isReturn && !isInvoice && (
                              <span className="text-frost-dark">{item.transactionType}</span>
                            )}
                          </td>
                          <td className="px-2 py-2 font-mono text-[11px] text-frost-dark whitespace-nowrap">
                            {item.moneyReceiptNo || (item.saleId ? `INV-${item.saleId}` : "—")}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-red-600 font-semibold">
                            {item.debit > 0 ? tk(item.debit) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-600 font-semibold">
                            {item.credit > 0 ? tk(item.credit) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-bold text-frost-dark">
                            {tk(item.balanceAfter)}
                          </td>
                          <td className="px-3 py-2 bn-text text-frost-muted text-[11px]">
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
            <div className="mt-8 pt-6 border-t border-frost-border grid grid-cols-2 text-center text-xs bn-text">
              <div>
                <div className="border-t border-frost-dark/40 w-36 mx-auto pt-1 font-semibold text-frost-muted">
                  গ্রাহকের স্বাক্ষর
                </div>
              </div>
              <div>
                <div className="border-t border-frost-dark/40 w-36 mx-auto pt-1 font-semibold text-frost-muted">
                  আল-আমিন ট্রেডার্স
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
