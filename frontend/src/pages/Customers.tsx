import { useState, useEffect, useCallback } from "react"
import type { Customer, SaleResponse } from "../types"
import { getCustomers } from "../api/endpoints"
import CustomerDirectoryTable from "../components/customers/CustomerDirectoryTable"
import AddCustomerModal from "../components/customers/AddCustomerModal"
import EditCustomerModal from "../components/customers/EditCustomerModal"
import CustomerDetailModal from "../components/customers/CustomerDetailModal"
import CustomerRepayModal from "../components/customers/CustomerRepayModal"
import ThermalReceipt from "../components/ThermalReceipt"
import DueCollectionReceipt, { type DueReceiptData } from "../components/DueCollectionReceipt"

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Active Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false)
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [repayCustomer, setRepayCustomer] = useState<Customer | null>(null)

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
    setSuccessMessage("New customer added successfully.")
    loadCustomers()
  }

  const handleEditSuccess = (updated: Customer) => {
    setSuccessMessage("Customer profile updated successfully.")
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    if (detailCustomer && detailCustomer.id === updated.id) {
      setDetailCustomer(updated)
    }
    loadCustomers()
  }

  const handleRepaySuccess = (receiptData: DueReceiptData) => {
    setSuccessMessage(`Payment recorded successfully. MR Voucher: ${receiptData.receiptNo}`)
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
        onOpenDetail={(c) => setDetailCustomer(c)}
        onOpenEdit={(c) => setEditCustomer(c)}
      />

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />

      {/* Unified Customer 360 Workspace Modal */}
      <CustomerDetailModal
        isOpen={!!detailCustomer}
        customer={detailCustomer}
        onClose={() => setDetailCustomer(null)}
        onOpenEdit={(c) => setEditCustomer(c)}
        onOpenRepay={(c) => setRepayCustomer(c)}
        onPrintInvoice={(sale) => setInvoiceToPrint(sale)}
      />

      {/* Edit Customer Profile Modal */}
      <EditCustomerModal
        isOpen={!!editCustomer}
        customer={editCustomer}
        onClose={() => setEditCustomer(null)}
        onSuccess={handleEditSuccess}
      />

      {/* Repay / Collect Due Modal */}
      <CustomerRepayModal
        customer={repayCustomer}
        onClose={() => setRepayCustomer(null)}
        onSuccess={handleRepaySuccess}
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
