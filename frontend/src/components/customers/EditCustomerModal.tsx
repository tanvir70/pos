import React, { useState, useEffect, useMemo, useRef } from "react"
import type { Customer, CustomerRequest, CustomerType } from "../../types"
import { updateCustomer } from "../../api/endpoints"
import { useToast } from "../../context/ToastContext"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select"

export interface EditCustomerModalProps {
  isOpen: boolean
  customer: Customer | null
  onClose: () => void
  onSuccess: (updated: Customer) => void
}

export default function EditCustomerModal({
  isOpen,
  customer,
  onClose,
  onSuccess,
}: EditCustomerModalProps) {
  const { showToast, showWarning, showError, dismissToast } = useToast()
  const confirmToastIdRef = useRef<string | null>(null)

  const [form, setForm] = useState<CustomerRequest>({
    name: "",
    businessName: "",
    phone: "",
    villageAddress: "",
    landArea: "",
    customerType: "RETAIL",
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  // Clean up confirmation toast if component unmounts
  useEffect(() => {
    return () => {
      if (confirmToastIdRef.current) {
        dismissToast(confirmToastIdRef.current)
        confirmToastIdRef.current = null
      }
    }
  }, [dismissToast])

  // Dismiss confirmation toast when modal closes or ESC is pressed
  const handleClose = () => {
    if (confirmToastIdRef.current) {
      dismissToast(confirmToastIdRef.current)
      confirmToastIdRef.current = null
    }
    onClose()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmToastIdRef.current) {
          dismissToast(confirmToastIdRef.current)
          confirmToastIdRef.current = null
          return
        }
        handleClose()
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown)
    }
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, dismissToast])

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || "",
        businessName: customer.businessName || "",
        phone: customer.phone || "",
        villageAddress: customer.villageAddress || customer.address || "",
        landArea: customer.landArea || "",
        customerType: customer.customerType || "RETAIL",
      })
      setFormError(null)
    }
  }, [customer])

  // Check if any fields were modified
  const isChanged = useMemo(() => {
    if (!customer) return false
    const initialName = (customer.name || "").trim()
    const initialPhone = (customer.phone || "").trim()
    const initialLand = (customer.landArea || "").trim()
    const initialBusiness = (customer.businessName || "").trim()
    const initialAddress = (customer.villageAddress || customer.address || "").trim()
    const initialType = (customer.customerType || "RETAIL").toUpperCase()

    const currentName = (form.name || "").trim()
    const currentPhone = (form.phone || "").trim()
    const currentLand = (form.landArea || "").trim()
    const currentBusiness = (form.businessName || "").trim()
    const currentAddress = (form.villageAddress || "").trim()
    const currentType = (form.customerType || "RETAIL").toUpperCase()

    return (
      currentName !== initialName ||
      currentPhone !== initialPhone ||
      currentLand !== initialLand ||
      currentBusiness !== initialBusiness ||
      currentAddress !== initialAddress ||
      currentType !== initialType
    )
  }, [customer, form])

  if (!isOpen || !customer) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isChanged) return

    const cleanName = form.name.trim()
    if (!cleanName) {
      setFormError("Customer name is required.")
      return
    }
    const cleanPhone = form.phone.replace(/\D/g, "")
    if (!cleanPhone) {
      setFormError("Mobile number is required.")
      return
    }
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setFormError("Mobile number must be a valid 11-digit number starting with 01 (e.g. 01712345678).")
      return
    }

    // Build changes diff list
    const changes: {
      label: string
      oldValue: string
      newValue: string
      diffBadge?: string
      badgeVariant?: "positive" | "negative" | "neutral"
    }[] = []

    const origName = (customer.name || "").trim()
    if (cleanName !== origName) {
      changes.push({
        label: "Customer Name",
        oldValue: origName || "—",
        newValue: cleanName,
      })
    }

    const origPhone = (customer.phone || "").trim()
    if (cleanPhone !== origPhone) {
      changes.push({
        label: "Mobile Number",
        oldValue: origPhone || "—",
        newValue: cleanPhone,
      })
    }

    const origType = (customer.customerType || "RETAIL").toUpperCase()
    const newType = (form.customerType || "RETAIL").toUpperCase()
    if (newType !== origType) {
      changes.push({
        label: "Customer Type",
        oldValue: origType === "WHOLESALE" ? "Wholesale Customer" : "Retail Farmer",
        newValue: newType === "WHOLESALE" ? "Wholesale Customer" : "Retail Farmer",
        diffBadge: newType,
        badgeVariant: newType === "WHOLESALE" ? "positive" : "neutral",
      })
    }

    const origBusiness = (customer.businessName || "").trim()
    const newBusiness = (form.businessName || "").trim()
    if (newBusiness !== origBusiness) {
      changes.push({
        label: "Business Name",
        oldValue: origBusiness || "—",
        newValue: newBusiness || "—",
      })
    }

    const origLand = (customer.landArea || "").trim()
    const newLand = (form.landArea || "").trim()
    if (newLand !== origLand) {
      changes.push({
        label: "Land Area",
        oldValue: origLand || "—",
        newValue: newLand || "—",
      })
    }

    const origAddress = (customer.villageAddress || customer.address || "").trim()
    const newAddress = (form.villageAddress || "").trim()
    if (newAddress !== origAddress) {
      changes.push({
        label: "Village / Address",
        oldValue: origAddress || "—",
        newValue: newAddress || "—",
      })
    }

    if (changes.length === 0) {
      showWarning("No changes were made to save.")
      return
    }

    const executeSave = async () => {
      try {
        setIsSaving(true)
        setFormError(null)
        const updated = await updateCustomer(customer.id, {
          name: cleanName,
          phone: cleanPhone,
          businessName: newBusiness ? newBusiness : null,
          villageAddress: newAddress ? newAddress : null,
          landArea: newLand ? newLand : null,
          customerType: form.customerType,
        })
        onSuccess(updated)
        handleClose()
      } catch (err: any) {
        const errorMsg = err?.message || "Failed to update customer profile."
        setFormError(errorMsg)
        showError(err, "Failed to update customer profile")
      } finally {
        setIsSaving(false)
      }
    }

    // Dismiss previous confirmation toast if active
    if (confirmToastIdRef.current) {
      dismissToast(confirmToastIdRef.current)
      confirmToastIdRef.current = null
    }

    const toastId = showToast({
      type: "info",
      title: "Confirm Customer Changes",
      presentation: "confirmation",
      duration: 0,
      closePrevious: true,
      message: (
        <div className="space-y-3">
          {/* Customer Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">
                {cleanName}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {changes.length === 1
                  ? "1 field modified"
                  : `${changes.length} fields modified`}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 whitespace-nowrap">
                ID #{customer.id}
              </span>
            </div>
          </div>

          {/* Changed Items Only */}
          <div className="max-h-[280px] overflow-y-auto space-y-2 pr-0.5">
            {changes.map((change) => (
              <div
                key={change.label}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                     {change.label}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="line-through text-slate-400 dark:text-slate-500 font-mono font-normal">
                      {change.oldValue}
                    </span>
                    <span className="text-slate-400 font-bold">→</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {change.newValue}
                    </span>
                  </div>
                </div>

                {change.diffBadge && (
                  <span
                    className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold whitespace-nowrap border ${
                      change.badgeVariant === "positive"
                        ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {change.diffBadge}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
            Confirm to commit {changes.length === 1 ? "this change" : "these changes"} to the customer account profile.
          </div>
        </div>
      ),
      actions: [
        {
          label: "Cancel",
          intent: "default",
          onClick: () => {
            dismissToast(toastId)
            confirmToastIdRef.current = null
          },
        },
        {
          label: "Confirm",
          intent: "danger",
          onClick: async () => {
            dismissToast(toastId)
            confirmToastIdRef.current = null
            await executeSave()
          },
        },
      ],
    })

    confirmToastIdRef.current = toastId
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
              Edit Customer Profile
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Update customer details, contact number, and cultivated land area.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-medium px-2 py-1 rounded cursor-pointer"
          >
            Close
          </button>
        </div>

        {formError && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-rose-950/60 border border-red-200 dark:border-rose-900/80 rounded-lg text-red-700 dark:text-rose-300 text-xs font-medium">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Customer Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {form.customerType === "WHOLESALE" || form.businessName?.trim()
                  ? "Proprietor / Customer Name *"
                  : "Customer Name *"}
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={
                  form.customerType === "WHOLESALE" || form.businessName?.trim()
                    ? "Proprietor Full Name"
                    : "Full Name"
                }
                className="w-full h-9 px-3 border border-slate-200 dark:border-slate-800 rounded-md text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 bg-white dark:bg-slate-950"
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                required
                value={form.phone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 11),
                  })
                }
                placeholder="017XXXXXXXX"
                className="w-full h-9 px-3 border border-slate-200 dark:border-slate-800 rounded-md text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 bg-white dark:bg-slate-950"
              />
            </div>

            {/* Land Area */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Land Area {form.customerType === "WHOLESALE" ? "(Optional)" : ""}
              </label>
              <input
                type="text"
                value={form.landArea || ""}
                onChange={(e) => setForm({ ...form, landArea: e.target.value })}
                placeholder="e.g. 5 Bigha / 1.5 Acre / 80 Decimal"
                className="w-full h-9 px-3 border border-slate-200 dark:border-slate-800 rounded-md text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 bg-white dark:bg-slate-950"
              />
            </div>

            {/* Business / Shop Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Business Name {form.customerType === "WHOLESALE" ? "(Store / Firm)" : "(Optional)"}
              </label>
              <input
                type="text"
                value={form.businessName || ""}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                placeholder={
                  form.customerType === "WHOLESALE"
                    ? "e.g. Bismillah Krishi Vander"
                    : "Business / Store Name (if any)"
                }
                className="w-full h-9 px-3 border border-slate-200 dark:border-slate-800 rounded-md text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 bg-white dark:bg-slate-950"
              />
            </div>

            {/* Customer Type with shadcn Select */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Customer Type
              </label>
              <Select
                value={form.customerType}
                onValueChange={(val) =>
                  setForm({ ...form, customerType: val as CustomerType })
                }
              >
                <SelectTrigger className="w-full bg-white dark:bg-slate-950 text-sm h-9">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETAIL">Retail Farmer</SelectItem>
                  <SelectItem value="WHOLESALE">Wholesale Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Village / Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Village / Address
              </label>
              <input
                type="text"
                value={form.villageAddress || ""}
                onChange={(e) => setForm({ ...form, villageAddress: e.target.value })}
                placeholder="Village / Union / Sub-district"
                className="w-full h-9 px-3 border border-slate-200 dark:border-slate-800 rounded-md text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !isChanged}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
