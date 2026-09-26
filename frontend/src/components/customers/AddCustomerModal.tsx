import React, { useState } from "react"
import type { CustomerRequest, CustomerType } from "../../types"
import { createCustomer } from "../../api/endpoints"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select"

export interface AddCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const initialFormState: CustomerRequest = {
  name: "",
  businessName: "",
  phone: "",
  villageAddress: "",
  landArea: "",
  customerType: "RETAIL",
  initialDue: 0,
  mfsType: "",
  mfsNumber: "",
  bankName: "",
  bankBranch: "",
  bankAccountNo: "",
}

export default function AddCustomerModal({
  isOpen,
  onClose,
  onSuccess,
}: AddCustomerModalProps) {
  const [form, setForm] = useState<CustomerRequest>(initialFormState)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  if (!isOpen) return null

  const handleClose = () => {
    setForm(initialFormState)
    setFormError(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
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

    try {
      setIsSaving(true)
      setFormError(null)
      await createCustomer({
        ...form,
        name: form.name.trim(),
        phone: cleanPhone,
        businessName: form.businessName ? form.businessName.trim() : undefined,
        villageAddress: form.villageAddress ? form.villageAddress.trim() : undefined,
        landArea: form.landArea ? form.landArea.trim() : undefined,
        initialDue: Math.max(0, Number(form.initialDue) || 0),
      })
      setForm(initialFormState)
      onSuccess()
      onClose()
    } catch (err: any) {
      setFormError(err?.message || "Failed to create customer profile.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-xl w-full p-6 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-base">
              Add New Customer
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter customer personal profile, contact information, and land area.
            </p>
          </div>
          <button
            type="button"
            data-testid="close-add-modal"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 text-sm font-medium px-2 py-1 rounded"
          >
            Close
          </button>
        </div>

        {formError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full Name"
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
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
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Land Area */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Land Area
              </label>
              <input
                type="text"
                value={form.landArea || ""}
                onChange={(e) => setForm({ ...form, landArea: e.target.value })}
                placeholder="e.g. 5 Bigha / 1.5 Acre / 80 Decimal"
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>


            {/* Business Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Business Name
              </label>
              <input
                type="text"
                value={form.businessName || ""}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                placeholder="Business / Farm Name"
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Village / Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Village / Address
              </label>
              <input
                type="text"
                value={form.villageAddress || ""}
                onChange={(e) => setForm({ ...form, villageAddress: e.target.value })}
                placeholder="Village / Union / Sub-district"
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Customer Type */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Customer Type *
              </label>
              <Select
                value={form.customerType}
                onValueChange={(val) =>
                  setForm({
                    ...form,
                    customerType: val as CustomerType,
                  })
                }
              >
                <SelectTrigger className="w-full bg-white text-sm h-9">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETAIL">Retail Farmer</SelectItem>
                  <SelectItem value="WHOLESALE">Wholesale Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Initial Due */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Opening Due Balance (if any)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={form.initialDue || ""}
                onKeyDown={(e) => {
                  if (e.key === "-" || e.key === "+" || e.key === "e" || e.key === "E") {
                    e.preventDefault()
                  }
                }}
                onChange={(e) =>
                  setForm({
                    ...form,
                    initialDue: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                placeholder="0.00"
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors"
            >
              {isSaving ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
