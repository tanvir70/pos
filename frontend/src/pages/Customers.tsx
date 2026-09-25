import { useState, useEffect, useCallback } from "react"
import type { Customer, SaleResponse } from "../types"
import { getCustomers } from "../api/endpoints"
import CustomerDirectoryTable from "../components/customers/CustomerDirectoryTable"
import AddCustomerModal from "../components/customers/AddCustomerModal"
import CustomerRepayModal from "../components/customers/CustomerRepayModal"
import CustomerPurchasesModal from "../components/customers/CustomerPurchasesModal"
import CustomerLedgerModal from "../components/customers/CustomerLedgerModal"
import ThermalReceipt from "../components/ThermalReceipt"
import DueCollectionReceipt, { type DueReceiptData } from "../components/DueCollectionReceipt"

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Active Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false)
  const [repayCustomer, setRepayCustomer] = useState<Customer | null>(null)
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null)
  const [purchasesCustomer, setPurchasesCustomer] = useState<Customer | null>(null)

  // Receipt & Reprint Modals state
  const [dueReceiptToPrint, setDueReceiptToPrint] = useState<DueReceiptData | null>(null)
  const [invoiceToPrint, setInvoiceToPrint] = useState<SaleResponse | null>(null)

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

  const handleAddSuccess = () => {
    setSuccessMessage("New customer added successfully!")
    loadCustomers()
  }

  const handleRepaySuccess = (receiptData: DueReceiptData) => {
    setSuccessMessage(`Payment recorded successfully! MR Voucher: ${receiptData.receiptNo}`)
    setDueReceiptToPrint(receiptData)
    loadCustomers()
  }

  return (
    <>
      <CustomerDirectoryTable
        customers={customers}
        isLoading={isLoading}
        successMessage={successMessage}
        errorMessage={errorMessage}
        onClearSuccessMessage={() => setSuccessMessage(null)}
        onClearErrorMessage={() => setErrorMessage(null)}
        onRefresh={loadCustomers}
        onOpenAddCustomer={() => setIsAddModalOpen(true)}
        onOpenRepayModal={(c) => setRepayCustomer(c)}
        onOpenLedger={(c) => setLedgerCustomer(c)}
        onOpenPurchases={(c) => setPurchasesCustomer(c)}
      />

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />

      {/* Repay / Collect Due Modal */}
      <CustomerRepayModal
        customer={repayCustomer}
        onClose={() => setRepayCustomer(null)}
        onSuccess={handleRepaySuccess}
      />

      {/* Purchases Drilldown Modal */}
      <CustomerPurchasesModal
        customer={purchasesCustomer}
        onClose={() => setPurchasesCustomer(null)}
        onOpenRepayModal={(c) => setRepayCustomer(c)}
        onOpenLedger={(c) => setLedgerCustomer(c)}
        onPrintInvoice={(sale) => setInvoiceToPrint(sale)}
      />

      {/* Customer Ledger Audit Modal */}
      <CustomerLedgerModal
        customer={ledgerCustomer}
        onClose={() => setLedgerCustomer(null)}
      />

      {/* Invoice Thermal Reprint Modal */}
      {invoiceToPrint && (
        <ThermalReceipt
          sale={invoiceToPrint}
          autoPrint={false}
          onClose={() => setInvoiceToPrint(null)}
        />
      )}

      {/* Due Collection Thermal Receipt Modal */}
      {dueReceiptToPrint && (
        <DueCollectionReceipt
          data={dueReceiptToPrint}
          autoPrint={true}
          onClose={() => setDueReceiptToPrint(null)}
        />
      )}
    </>
  )
}
