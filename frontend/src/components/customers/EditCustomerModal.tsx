import React, { useState, useEffect } from "react"
import type { Customer, CustomerRequest, CustomerType } from "../../types"
import { updateCustomer } from "../../api/endpoints"
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
  const [form, setForm] = useState<CustomerRequest>({
    name: "",
    fatherName: "",
    businessName: "",
    phone: "",
    villageAddress: "",
    landArea: "",
    customerType: "RETAIL",
    mfsType: "",
    mfsNumber: "",
    bankName: "",
    bankBranch: "",
    bankAccountNo: "",
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || "",
        fatherName: customer.fatherName || "",
        businessName: customer.businessName || "",
        phone: customer.phone || "",
        villageAddress: customer.villageAddress || customer.address || "",
        landArea: customer.landArea || "",
        customerType: customer.customerType || "RETAIL",
        mfsType: customer.mfsType || "",
        mfsNumber: customer.mfsNumber || "",
        bankName: customer.bankName || "",
        bankBranch: customer.bankBranch || "",
        bankAccountNo: customer.bankAccountNo || "",
      })
      setFormError(null)
    }
  }, [customer])

  if (!isOpen || !customer) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormError("Customer name is required.")
      return
    }
    if (!form.phone.trim()) {
      setFormError("Mobile number is required.")
      return
    }

    try {
      setIsSaving(true)
      setFormError(null)
      const updated = await updateCustomer(customer.id, {
        ...form,
        name: form.name.trim(),
        phone: form.phone.trim(),
        fatherName: form.fatherName ? form.fatherName.trim() : undefined,
        businessName: form.businessName ? form.businessName.trim() : undefined,
        villageAddress: form.villageAddress ? form.villageAddress.trim() : undefined,
        landArea: form.landArea ? form.landArea.trim() : undefined,
      })
      onSuccess(updated)
      onClose()
    } catch (err: any) {
      setFormError(err?.message || "Failed to update customer profile.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-base">
              Edit Customer Profile
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Update customer details, contact number, and cultivated land area.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
            {/* Customer Name */}
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
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="017xxxxxxxx"
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

            {/* Father's Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Father's Name
              </label>
              <input
                type="text"
                value={form.fatherName || ""}
                onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
                placeholder="Father's Name"
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Business / Shop Name */}
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

            {/* Customer Type with shadcn Select */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Customer Type
              </label>
              <Select
                value={form.customerType}
                onValueChange={(val) =>
                  setForm({ ...form, customerType: val as CustomerType })
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
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
