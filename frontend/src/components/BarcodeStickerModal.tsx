import { useState, useId } from "react"
import type { StockItem } from "../types"
import { getBarcodePngUrl } from "../api/endpoints"
import { Tag, X, Sprout, Printer, Layers } from "lucide-react"
import { formatLotNumber } from "../utils/lotNumber"

// BUSINESS DECISION: Standard thermal barcode stickers format at 50mm × 25mm standard dimensions.
// Features dealership branding, dual English/Bengali product names, FEFO expiry date,
// Code 128 barcode, and mandated MRP (Maximum Retail Price) for legal compliance.

export interface BarcodeStickerModalProps {
  item: StockItem | null
  lots?: StockItem[]
  onSelectLot?: (lot: StockItem) => void
  isOpen: boolean
  onClose: () => void
}

export default function BarcodeStickerModal({
  item,
  lots = [],
  onSelectLot,
  isOpen,
  onClose,
}: BarcodeStickerModalProps) {
  const customStickersId = useId()
  const [stickerCount, setStickerCount] = useState<number>(1)
  const [isPrinting, setIsPrinting] = useState<boolean>(false)

  if (!isOpen || !item) return null

  const barcode = item.barcode || item.lotBarcode || item.defaultBarcode || "SYN-ITEM"
  const barcodeUrl = getBarcodePngUrl(barcode, 320, 80)

  const productNameBn = item.productNameBn || item.nameBn || ""
  const productNameEn = item.productNameEn || item.nameEn || ""
  const retailPrice = item.lotRetailPrice ?? 0

  const handlePrint = () => {
    setIsPrinting(true)
    const printWindow = window.open("", "_blank", "width=450,height=600")
    if (!printWindow) {
      alert("Popup blocked. Please allow popups to print.")
      setIsPrinting(false)
      return
    }

    const stickersHtml = Array.from({ length: stickerCount })
      .map(
        () => `
        <div class="label-page">
          <div class="sticker">
            <div class="header">
              <span class="brand">RAJIB ENTERPRISE</span>
              <span class="mrp">MRP &#2547;${retailPrice}</span>
            </div>
            <div class="product-title-en">${productNameEn}</div>
            <div class="product-title-bn">${productNameBn}</div>
            <div class="lot-row">
              <span>Lot: <strong>${formatLotNumber(item.lotNumber)}</strong></span>
              <span>Exp: <strong>${item.expiryDate || "N/A"}</strong></span>
            </div>
            <div class="barcode-container">
              <img src="${barcodeUrl}" alt="${barcode}" class="barcode-img" />
              <div class="barcode-text">${barcode}</div>
            </div>
            <div class="footer-price">
              MRP: &#2547;${retailPrice.toLocaleString("en-US")} (Incl. VAT)
            </div>
          </div>
        </div>
      `,
      )
      .join("")

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode Stickers - ${barcode}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: 50mm 25mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Bengali", sans-serif;
            background: #fff;
            color: #000;
            width: 50mm;
            margin: 0;
            padding: 0;
          }
          .label-page {
            width: 50mm;
            height: 25mm;
            page-break-after: always;
            page-break-inside: avoid;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1mm 1.5mm;
          }
          .sticker {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            text-align: center;
            border: 0.5px dashed #ccc;
          }
          @media print {
            .sticker {
              border: none;
            }
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 6.5px;
            font-weight: 700;
            border-bottom: 0.5px solid #000;
            padding-bottom: 0.3mm;
            line-height: 1;
          }
          .brand {
            letter-spacing: 0.2px;
          }
          .mrp {
            font-size: 7px;
            font-weight: 800;
          }
          .product-title-en {
            font-size: 7.5px;
            font-weight: bold;
            line-height: 1.1;
            margin-top: 0.4mm;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .product-title-bn {
            font-size: 6px;
            color: #333;
            line-height: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .lot-row {
            display: flex;
            justify-content: space-between;
            font-size: 5.8px;
            color: #111;
            margin-top: 0.2mm;
            padding: 0 1mm;
          }
          .barcode-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin-top: 0.3mm;
          }
          .barcode-img {
            max-width: 96%;
            height: 7.5mm;
            object-fit: fill;
            display: block;
          }
          .barcode-text {
            font-family: monospace;
            font-size: 5.5px;
            letter-spacing: 1px;
            line-height: 1;
            margin-top: 0.2mm;
          }
          .footer-price {
            font-size: 6px;
            font-weight: bold;
            border-top: 0.5px solid #000;
            padding-top: 0.3mm;
            line-height: 1;
          }
        </style>
      </head>
      <body>
        ${stickersHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          };
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
    setIsPrinting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full my-auto overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Tag className="w-6 h-6" />
            <div>
              <h2 className="font-bold text-lg leading-tight">Barcode Sticker Print</h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                50mm × 25mm thermal label roll printer preview
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/80 hover:text-white text-xl leading-none cursor-pointer p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Multiple Lots Selector Dropdown */}
          {lots && lots.length > 1 && (
            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Selected Product Lot / ব্যাচ</span>
                </label>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                  {lots.length} Lots Available
                </span>
              </div>
              <select
                value={item.lotId}
                onChange={(e) => {
                  const selected = lots.find((l) => l.lotId === Number(e.target.value))
                  if (selected && onSelectLot) {
                    onSelectLot(selected)
                  }
                }}
                className="w-full text-xs font-medium py-2 px-3 bg-white border border-emerald-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
              >
                {lots.map((l, idx) => {
                  const qty = Number(l.quantity ?? (l as any).totalQuantity ?? 0)
                  return (
                    <option key={l.lotId} value={l.lotId}>
                      {formatLotNumber(l.lotNumber, idx)} • Stock: {qty} units • Exp: {l.expiryDate || "N/A"} • #{l.lotBarcode || l.barcode || l.defaultBarcode || ""}
                    </option>
                  )
                })}
              </select>
            </div>
          )}

          {/* Visual Sticker Preview Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center">
            <p className="text-xs font-semibold text-slate-500 mb-2.5 self-start">
              Print Preview (50mm × 25mm Actual Thermal Label)
            </p>

            <div
              className="bg-white border-2 border-dashed border-slate-900/30 rounded-lg p-3 shadow-md w-full max-w-[280px] text-center select-none flex flex-col justify-between"
              style={{ minHeight: "140px" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-300 pb-1 text-[11px] font-bold text-emerald-800">
                <span className="tracking-wide flex items-center gap-1">
                  <Sprout className="w-3 h-3" /> RAJIB ENTERPRISE
                </span>
                <span className="text-slate-900 font-black">
                  ৳{retailPrice}
                </span>
              </div>

              {/* Names */}
              <div className="my-1 text-center">
                <div className="font-bold text-xs text-slate-900 leading-tight truncate">
                  {productNameEn}
                </div>
                <div className="text-[10px] text-slate-500 leading-tight truncate">
                  {productNameBn}
                </div>
              </div>

              {/* Lot & Expiry */}
              <div className="flex justify-between items-center text-[10px] text-slate-900 px-1 font-mono">
                <span>
                  Lot: <strong>{formatLotNumber(item.lotNumber)}</strong>
                </span>
                <span>
                  Exp: <strong>{item.expiryDate || "N/A"}</strong>
                </span>
              </div>

              {/* Barcode Image & String */}
              <div className="my-1.5 flex flex-col items-center justify-center">
                <img
                  src={barcodeUrl}
                  alt={barcode}
                  className="h-8 max-w-[95%] object-contain"
                  onError={(e) => {
                    // Fallback visual bar in case image service isn't rendering
                    ;(e.currentTarget as HTMLElement).style.display = "none"
                  }}
                />
                <div className="font-mono text-[9px] tracking-widest text-slate-900 font-bold mt-0.5">
                  {barcode}
                </div>
              </div>

              {/* Price footer */}
              <div className="border-t border-gray-300 pt-1 text-[10px] font-bold text-slate-900">
                MRP: ৳{retailPrice.toLocaleString("en-US")} (Incl. VAT)
              </div>
            </div>
          </div>

          {/* Sticker Quantity Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              Number of Labels
            </label>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {[1, 5, 10, 20, 50].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setStickerCount(num)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer tabular-nums ${
                    stickerCount === num
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Custom count:</span>
              <input
                id={customStickersId}
                aria-label="Custom sticker count"
                type="number"
                min="1"
                max="500"
                value={stickerCount}
                onChange={(e) =>
                  setStickerCount(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-24 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-hidden"
              />
              <span className="text-xs text-slate-500">labels will be generated</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>
                {stickerCount > 1
                  ? `Print ${stickerCount} Stickers`
                  : "Print Label"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
