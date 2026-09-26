import React, { useState } from "react"
import { Plus, X } from "lucide-react"
import { createProduct, createLot } from "../../api/endpoints"
import { useToast } from "../../context/ToastContext"
import Input from "../ui/Input"
import Button from "../ui/Button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select"

export interface AddProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AddProductModal({
  isOpen,
  onClose,
  onSuccess,
}: AddProductModalProps) {
  const { showSuccess, showError, showWarning } = useToast()

  const [newProdName, setNewProdName] = useState("")
  const [newProdCode, setNewProdCode] = useState("")
  const [newProdCategory, setNewProdCategory] = useState("Insecticide")
  const [newProdBaseUnit, setNewProdBaseUnit] = useState("Bottle")
  const [newProdInitialStock, setNewProdInitialStock] = useState("")
  const [newProdRetail, setNewProdRetail] = useState("")
  const [newProdBuying, setNewProdBuying] = useState("")
  const [newProdMinStock, setNewProdMinStock] = useState("5")
  const [isSavingProd, setIsSavingProd] = useState(false)

  if (!isOpen) return null

  const handleClose = () => {
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProdName.trim()) {
      showWarning("Product name is required!")
      return
    }

    try {
      setIsSavingProd(true)
      const code =
        newProdCode.trim() ||
        `SYN-${newProdName.replace(/\s+/g, "-").toUpperCase().slice(0, 6)}`
      const retail = Math.max(0, parseFloat(newProdRetail) || 0)
      const buying = Math.max(0, parseFloat(newProdBuying) || 0)
      const initialStock = Math.max(0, parseFloat(newProdInitialStock) || 0)
      const minStock = Math.max(0, parseInt(newProdMinStock) || 5)

      const created = await createProduct({
        productCode: code,
        nameEn: newProdName.trim(),
        nameBn: newProdName.trim(), // satisfies database constraint without requiring Bangla input
        companyName: "Agro Chem",
        category: newProdCategory,
        baseUnit: newProdBaseUnit,
        cartonMultiplier: 1,
        standardRetailPrice: retail,
        buyingPrice: buying,
        minStockAlert: minStock,
        defaultBarcode: `${code}-DEF`,
      })

      if (initialStock > 0 && created.id) {
        await createLot({
          productId: created.id,
          lotNumber: "LOT-01",
          quantityBaseUnits: initialStock,
          purchaseCost: buying,
          lotRetailPrice: retail,
          lotWholesalePrice: retail,
          entryDate: new Date().toISOString().split("T")[0],
          expiryDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          supplierName: "Agro Chemical Ltd.",
          challanNo: `CH-${Date.now().toString().slice(-6)}`,
        })
      }

      setNewProdName("")
      setNewProdCode("")
      setNewProdInitialStock("")
      setNewProdRetail("")
      setNewProdBuying("")
      showSuccess("New product added to Dokan Stock successfully!")
      onSuccess()
      onClose()
    } catch (err) {
      showError(err, "Failed to create product")
    } finally {
      setIsSavingProd(false)
    }
  }

  return (
    <div className="bg-white p-5 rounded-2xl border-2 border-emerald-500 shadow-md mb-4 animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Add New Product to Master Catalog</span>
        </h3>
        <button
          type="button"
          onClick={handleClose}
          className="text-slate-500 hover:text-slate-900 text-sm p-1 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Product Name"
            required
            value={newProdName}
            onChange={(e) => setNewProdName(e.target.value)}
            placeholder="e.g. Virtako 40WG"
            autoFocus
          />
          <Input
            label="Product Code (optional)"
            value={newProdCode}
            onChange={(e) => setNewProdCode(e.target.value)}
            placeholder="e.g. SYN-VIRT-100"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1">
              Category
            </label>
            <Select
              value={newProdCategory}
              onValueChange={(val) => setNewProdCategory(val)}
            >
              <SelectTrigger className="w-full bg-white font-medium">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Insecticide">Insecticide</SelectItem>
                <SelectItem value="Fungicide">Fungicide</SelectItem>
                <SelectItem value="Herbicide">Herbicide</SelectItem>
                <SelectItem value="Bio-stimulant">Bio-stimulant (Growth Promoter)</SelectItem>
                <SelectItem value="Seed">Seed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1">
              Packaging Unit
            </label>
            <Select
              value={newProdBaseUnit}
              onValueChange={(val) => setNewProdBaseUnit(val)}
            >
              <SelectTrigger className="w-full bg-white font-medium">
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bottle">Bottle</SelectItem>
                <SelectItem value="Packet">Packet</SelectItem>
                <SelectItem value="Kg">Kg</SelectItem>
                <SelectItem value="Gram">Gram</SelectItem>
                <SelectItem value="Liter">Liter</SelectItem>
                <SelectItem value="Milliliter">Mili Liters (ml)</SelectItem>
                <SelectItem value="Piece">Piece</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Input
            label="Initial Stock Quantity"
            type="number"
            step="any"
            min="0"
            value={newProdInitialStock}
            onChange={(e) => setNewProdInitialStock(e.target.value)}
            placeholder="0"
            helperText="Initial quantity to add to dokan stock"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Retail Price (৳)"
            type="number"
            step="0.01"
            min="0"
            required
            value={newProdRetail}
            onChange={(e) => setNewProdRetail(e.target.value)}
            placeholder="0.00"
            helperText="Counter retail selling price"
          />
          <Input
            label="Buying Price (৳)"
            type="number"
            step="0.01"
            min="0"
            required
            value={newProdBuying}
            onChange={(e) => setNewProdBuying(e.target.value)}
            placeholder="0.00"
            helperText="Purchase cost / কেনা দাম"
          />
          <Input
            label="Low Stock Alert Threshold"
            type="number"
            min="0"
            value={newProdMinStock}
            onChange={(e) => setNewProdMinStock(e.target.value)}
            placeholder="5"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
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
            isLoading={isSavingProd}
          >
            Save Product
          </Button>
        </div>
      </form>
    </div>
  )
}
