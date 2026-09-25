import React, { useState } from "react"
import { Users, X, AlertTriangle, Loader2, Save } from "lucide-react"
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
      setFormError("Customer name is required!")
      return
    }
    if (!form.phone.trim()) {
      setFormError("Mobile number is required!")
      return
    }

    try {
      setIsSaving(true)
      setFormError(null)
      await createCustomer({
        ...form,
        name: form.name.trim(),
        phone: form.phone.trim(),
        initialDue: Number(form.initialDue) || 0,
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-5 sm:p-6 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-900" />
            <h3 className="font-bold text-slate-900 text-base sm:text-lg">
              Add New Customer Profile
            </h3>
          </div>
          <button
            type="button"
            data-testid="close-add-modal"
            onClick={handleClose}
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                value={form.fatherName || ""}
                onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
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
                value={form.businessName || ""}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
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
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
                value={form.whatsappNumber || ""}
                onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
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
                value={form.villageAddress || ""}
                onChange={(e) => setForm({ ...form, villageAddress: e.target.value })}
                placeholder="e.g. Kandapara, Belabo"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            {/* Customer Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1">
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
                <SelectTrigger className="w-full bg-white text-sm">
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
              <label className="block text-xs font-semibold text-slate-900 mb-1">
                Opening Due Balance (if any, ৳)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={form.initialDue || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
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
                <Select
                  value={form.mfsType || "NONE"}
                  onValueChange={(val) =>
                    setForm({
                      ...form,
                      mfsType: val === "NONE" ? "" : val,
                    })
                  }
                >
                  <SelectTrigger className="w-full bg-white text-xs py-2">
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Not specified</SelectItem>
                    <SelectItem value="bKash">bKash</SelectItem>
                    <SelectItem value="Nagad">Nagad</SelectItem>
                    <SelectItem value="Rocket">Rocket</SelectItem>
                    <SelectItem value="Upay">Upay</SelectItem>
                  </SelectContent>
                </Select>
                <input
                  type="text"
                  value={form.mfsNumber || ""}
                  onChange={(e) => setForm({ ...form, mfsNumber: e.target.value })}
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
                  value={form.bankName || ""}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
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
                  value={form.bankBranch || ""}
                  onChange={(e) => setForm({ ...form, bankBranch: e.target.value })}
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
                  value={form.bankAccountNo || ""}
                  onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })}
                  placeholder="A/C No."
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              {isSaving ? (
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
  )
}
