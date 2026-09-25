import React, { useState, useEffect } from "react"
import { Banknote, X, Phone, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react"
import type { Customer, CustomerPaymentRequest, PaymentMethod } from "../../types"
import type { DueReceiptData } from "../DueCollectionReceipt"
import { recordPayment, getNextDueInvoiceNo } from "../../api/endpoints"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select"

export interface CustomerRepayModalProps {
  customer: Customer | null
  onClose: () => void
  onSuccess: (receiptData: DueReceiptData) => void
}

const tk = (n: number | undefined | null) =>
  `৳${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const generateSuggestedMrNo = () => {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  const rand = Math.floor(100000 + Math.random() * 900000)
  return `DUE-${yyyy}${mm}${dd}-${rand}`
}

export default function CustomerRepayModal({
  customer,
  onClose,
  onSuccess,
}: CustomerRepayModalProps) {
  const [repayAmount, setRepayAmount] = useState<string>("")
  const [repayMethod, setRepayMethod] = useState<PaymentMethod>("CASH")
  const [repayMrNo, setRepayMrNo] = useState<string>("")
  const [repayNotes, setRepayNotes] = useState<string>("")
  const [repayError, setRepayError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  useEffect(() => {
    if (customer) {
      setRepayAmount("")
      setRepayMethod("CASH")
      setRepayNotes("")
      setRepayError(null)

      getNextDueInvoiceNo()
        .then((res) => setRepayMrNo(res.dueInvoiceNo))
        .catch(() => setRepayMrNo(generateSuggestedMrNo()))
    }
  }, [customer])

  if (!customer) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = parseFloat(repayAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setRepayError("Enter a valid repayment amount!")
      return
    }
    if (amountNum > customer.currentDue) {
      setRepayError(`You can repay up to a maximum of the current due of ${tk(customer.currentDue)}.`)
      return
    }

    try {
      setIsSaving(true)
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

      const previousDue = customer.currentDue
      const remainingDue = Math.max(0, previousDue - amountNum)

      await recordPayment(customer.id, payload)

      const receiptData: DueReceiptData = {
        receiptNo: finalReceiptNo,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          fatherName: customer.fatherName,
          businessName: customer.businessName,
          villageAddress: customer.villageAddress,
          address: customer.address,
          customerType: customer.customerType,
        },
        amountPaid: amountNum,
        previousDue,
        remainingDue,
        paymentMethod: repayMethod,
        notes: repayNotes.trim() || undefined,
        date: new Date().toISOString(),
        cashierName: "Rajib",
      }

      onSuccess(receiptData)
      onClose()
    } catch (err: any) {
      setRepayError(err?.message || "Failed to record payment.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
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
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 cursor-pointer p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer Info Box */}
        <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
          <div>
            <p className="font-bold text-slate-900 text-sm">
              {customer.name}
            </p>
            {customer.businessName && (
              <p className="text-xs text-emerald-800 font-semibold">
                {customer.businessName}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <Phone className="w-3 h-3" /> {customer.phone}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-red-500 font-semibold">Current Due</p>
            <p className="text-xl font-bold text-red-600 tabular-nums">
              {tk(customer.currentDue)}
            </p>
          </div>
        </div>

        {repayError && (
          <div className="mt-3 p-2 bg-red-50 border border-red-300 rounded-lg text-red-700 text-xs font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {repayError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
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
              max={customer.currentDue}
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
                  setRepayAmount(Math.round(customer.currentDue * 0.5).toString())
                  setRepayError(null)
                }}
                className="py-1 px-2 border border-slate-200 rounded text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                50% ({tk(Math.round(customer.currentDue * 0.5))})
              </button>
              <button
                type="button"
                onClick={() => {
                  setRepayAmount(Math.round(customer.currentDue * 0.75).toString())
                  setRepayError(null)
                }}
                className="py-1 px-2 border border-slate-200 rounded text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                75% ({tk(Math.round(customer.currentDue * 0.75))})
              </button>
              <button
                type="button"
                onClick={() => {
                  setRepayAmount(customer.currentDue.toString())
                  setRepayError(null)
                }}
                className="py-1 px-2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-bold hover:bg-emerald-200 transition-colors cursor-pointer"
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
            <Select
              value={repayMethod}
              onValueChange={(val) => setRepayMethod(val as PaymentMethod)}
            >
              <SelectTrigger className="w-full bg-white text-xs sm:text-sm py-2">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="BKASH">bKash</SelectItem>
                <SelectItem value="NAGAD">Nagad</SelectItem>
                <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
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
              onClick={onClose}
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
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm Payment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
