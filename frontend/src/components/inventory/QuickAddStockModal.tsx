import React, { useState, useEffect } from "react"
import type { GroupedProduct } from "../../types"
import { createLot } from "../../api/endpoints"
import { getNextLotNumber } from "../../utils/lotNumber"
import { useToast } from "../../context/ToastContext"
import Modal from "../ui/Modal"
import Input from "../ui/Input"
import Button from "../ui/Button"

export interface StockModalProduct {
  productId: number
  nameEn: string
  baseUnit: string
  retailPrice: number
  wholesalePrice: number
  buyingPrice: number
}

export interface QuickAddStockModalProps {
  product: StockModalProduct | null
  groupedProducts: GroupedProduct[]
  onClose: () => void
  onSuccess: () => void
}

export default function QuickAddStockModal({
  product,
  groupedProducts,
  onClose,
  onSuccess,
}: QuickAddStockModalProps) {
  const { showSuccess, showError, showWarning } = useToast()

  const [addStockQty, setAddStockQty] = useState("")
  const [addStockBuying, setAddStockBuying] = useState("")
  const [addStockRetail, setAddStockRetail] = useState("")
  const [addStockWholesale, setAddStockWholesale] = useState("")
  const [addStockLotNumber, setAddStockLotNumber] = useState("")
  const [addStockExpiry, setAddStockExpiry] = useState("")
  const [addStockSupplier, setAddStockSupplier] = useState("")
  const [addStockChallan, setAddStockChallan] = useState("")
  const [isAddingStock, setIsAddingStock] = useState(false)

  useEffect(() => {
    if (product) {
      setAddStockQty("")
      setAddStockBuying(product.buyingPrice ? String(product.buyingPrice) : "")
      setAddStockRetail(product.retailPrice ? String(product.retailPrice) : "")
      setAddStockWholesale(product.wholesalePrice ? String(product.wholesalePrice) : "")
      const matched = groupedProducts.find((p) => p.productId === product.productId)
      setAddStockLotNumber(getNextLotNumber(matched?.lots))
      setAddStockExpiry(new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      setAddStockSupplier("Agro Chemical Ltd.")
      setAddStockChallan(`CH-${Date.now().toString().slice(-6)}`)
    }
  }, [product, groupedProducts])

  if (!product) return null

  const handleClose = () => {
    setAddStockQty("")
    setAddStockBuying("")
    setAddStockRetail("")
    setAddStockWholesale("")
    setAddStockLotNumber("")
    setAddStockExpiry("")
    setAddStockSupplier("")
    setAddStockChallan("")
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = parseFloat(addStockQty)
    if (isNaN(qty) || qty <= 0) {
      showWarning("Please enter a valid stock quantity")
      return
    }

    try {
      setIsAddingStock(true)
      const buying = parseFloat(addStockBuying) || product.buyingPrice || 0
      const retail = parseFloat(addStockRetail) || product.retailPrice || 0
      const wholesale = parseFloat(addStockWholesale) || product.wholesalePrice || retail

      if (retail <= 0) {
        showWarning("Please enter a valid retail price")
        return
      }

      if (wholesale <= 0) {
        showWarning("Please enter a valid wholesale price")
        return
      }

      const matched = groupedProducts.find((p) => p.productId === product.productId)
      const defaultLot = getNextLotNumber(matched?.lots)
      const lotNumber = addStockLotNumber.trim() || defaultLot
      const challanNo = addStockChallan.trim() || `CH-${Date.now().toString().slice(-6)}`
      const expiryDate =
        addStockExpiry ||
        new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

      await createLot({
        productId: product.productId,
        lotNumber,
        quantityBaseUnits: qty,
        purchaseCost: buying,
        lotRetailPrice: retail,
        lotWholesalePrice: wholesale,
        entryDate: new Date().toISOString().split("T")[0],
        expiryDate,
        supplierName: addStockSupplier.trim() || "Direct stock entry",
        challanNo,
      })

      showSuccess(
        `Added ${qty} ${product.baseUnit} to ${product.nameEn} as ${lotNumber}`,
      )
      handleClose()
      onSuccess()
    } catch (err) {
      showError(err, "Failed to add stock")
    } finally {
      setIsAddingStock(false)
    }
  }

  return (
    <Modal
      isOpen={!!product}
      onClose={handleClose}
      title={`Add Stock Lot to ${product.nameEn}`}
      subtitle={`Receive a new batch with purchase cost and expiry tracking for ${product.nameEn}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="addStockQtyInput" className="block text-xs font-bold text-slate-900 mb-1">
              Quantity ({product.baseUnit}) *
            </label>
            <Input
              id="addStockQtyInput"
              type="number"
              step="any"
              min="0.01"
              required
              value={addStockQty}
              onChange={(e) => setAddStockQty(e.target.value)}
              placeholder="e.g. 50"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="addStockLotInput" className="block text-xs font-bold text-slate-900 mb-1">
              Lot / Batch No
            </label>
            <Input
              id="addStockLotInput"
              value={addStockLotNumber}
              onChange={(e) => setAddStockLotNumber(e.target.value)}
              placeholder="e.g. LOT-01"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="addStockBuyingInput" className="block text-xs font-bold text-slate-900 mb-1">
              Purchase Cost
            </label>
            <Input
              id="addStockBuyingInput"
              type="number"
              step="0.01"
              min="0"
              value={addStockBuying}
              onChange={(e) => setAddStockBuying(e.target.value)}
              placeholder={String(product.buyingPrice || "0.00")}
            />
          </div>

          <div>
            <label htmlFor="addStockRetailInput" className="block text-xs font-bold text-slate-900 mb-1">
              Retail Price *
            </label>
            <Input
              id="addStockRetailInput"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={addStockRetail}
              onChange={(e) => setAddStockRetail(e.target.value)}
              placeholder={String(product.retailPrice || "0.00")}
            />
          </div>

          <div>
            <label htmlFor="addStockWholesaleInput" className="block text-xs font-bold text-slate-900 mb-1">
              Wholesale Price *
            </label>
            <Input
              id="addStockWholesaleInput"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={addStockWholesale}
              onChange={(e) => setAddStockWholesale(e.target.value)}
              placeholder={String(product.wholesalePrice || product.retailPrice || "0.00")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="addStockExpiryInput" className="block text-xs font-bold text-slate-900 mb-1">
              Expiry Date
            </label>
            <Input
              id="addStockExpiryInput"
              type="date"
              value={addStockExpiry}
              onChange={(e) => setAddStockExpiry(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="addStockSupplierInput" className="block text-xs font-bold text-slate-900 mb-1">
              Supplier
            </label>
            <Input
              id="addStockSupplierInput"
              value={addStockSupplier}
              onChange={(e) => setAddStockSupplier(e.target.value)}
              placeholder="Supplier name"
            />
          </div>

          <div>
            <label htmlFor="addStockChallanInput" className="block text-xs font-bold text-slate-900 mb-1">
              Challan No
            </label>
            <Input
              id="addStockChallanInput"
              value={addStockChallan}
              onChange={(e) => setAddStockChallan(e.target.value)}
              placeholder="Auto generated"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isAddingStock}
            disabled={!addStockQty || parseFloat(addStockQty) <= 0}
          >
            Add Stock
          </Button>
        </div>
      </form>
    </Modal>
  )
}
