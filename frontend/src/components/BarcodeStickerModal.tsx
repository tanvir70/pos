import { useState, useId } from "react"
import type { StockItem } from "../types"
import { getBarcodePngUrl } from "../api/endpoints"

// BUSINESS DECISION: Standard thermal barcode stickers format at 50mm × 25mm standard dimensions.
// Features dealership branding, dual English/Bengali product names, FEFO expiry date,
// Code 128 barcode, and mandated MRP (সর্বোচ্চ খুচরা মূল্য) for legal compliance.

export interface BarcodeStickerModalProps {
  item: StockItem | null
  isOpen: boolean
  onClose: () => void
}

export default function BarcodeStickerModal({
  item,
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
      alert("পপআপ ব্লক করা হয়েছে। অনুগ্রহ করে প্রিন্ট করতে পপআপ অনুমতি দিন।")
      setIsPrinting(false)
      return
    }

    const stickersHtml = Array.from({ length: stickerCount })
      .map(
        () => `
        <div class="label-page">
          <div class="sticker">
            <div class="header">
              <span class="brand">🌾 AL-AMIN TRADERS</span>
              <span class="mrp">MRP ৳${retailPrice}</span>
            </div>
            <div class="product-title-bn">${productNameBn}</div>
            <div class="product-title-en">${productNameEn}</div>
            <div class="lot-row">
              <span>লট: <strong>${item.lotNumber}</strong></span>
              <span>মেয়াদ: <strong>${item.expiryDate}</strong></span>
            </div>
            <div class="barcode-container">
              <img src="${barcodeUrl}" alt="${barcode}" class="barcode-img" />
              <div class="barcode-text">${barcode}</div>
            </div>
            <div class="footer-price">
              সর্বোচ্চ খুচরা মূল্য: ৳${retailPrice.toLocaleString("en-IN")} (ভ্যাট অন্তর্ভুক্ত)
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
          .product-title-bn {
            font-size: 7.5px;
            font-weight: bold;
            line-height: 1.1;
            margin-top: 0.4mm;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .product-title-en {
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
      <div className="bg-white rounded-2xl shadow-2xl border border-frost-border max-w-lg w-full my-auto overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏷️</span>
            <div>
              <h2 className="font-bold text-lg bn-text leading-tight">
                বারকোড স্টিকার প্রিন্ট (Barcode Sticker)
              </h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                ৫০ মিমি × ২৫ মিমি থার্মাল লেবেল রোল প্রিন্টার প্রিভিউ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="text-white/80 hover:text-white text-xl leading-none cursor-pointer p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Visual Sticker Preview Box */}
          <div className="bg-frost-surface p-4 rounded-xl border border-frost-border flex flex-col items-center">
            <p className="text-xs font-semibold text-frost-muted bn-text mb-2.5 self-start">
              প্রিন্ট প্রিভিউ (50mm × 25mm Actual Thermal Label)
            </p>

            <div
              className="bg-white border-2 border-dashed border-frost-dark/30 rounded-lg p-3 shadow-md w-full max-w-[280px] text-center select-none flex flex-col justify-between"
              style={{ minHeight: "140px" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-300 pb-1 text-[11px] font-bold text-emerald-800">
                <span className="tracking-wide flex items-center gap-1">
                  <span>🌾</span> AL-AMIN TRADERS
                </span>
                <span className="text-frost-dark font-black">
                  ৳{retailPrice}
                </span>
              </div>

              {/* Names */}
              <div className="my-1 text-center">
                <div className="font-bold text-xs text-frost-dark bn-text leading-tight truncate">
                  {productNameBn}
                </div>
                <div className="text-[10px] text-frost-muted leading-tight truncate">
                  {productNameEn}
                </div>
              </div>

              {/* Lot & Expiry */}
              <div className="flex justify-between items-center text-[10px] text-frost-dark px-1 font-mono">
                <span>
                  লট: <strong>{item.lotNumber}</strong>
                </span>
                <span>
                  মেয়াদ: <strong>{item.expiryDate}</strong>
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
                <div className="font-mono text-[9px] tracking-widest text-frost-dark font-bold mt-0.5">
                  {barcode}
                </div>
              </div>

              {/* Price footer */}
              <div className="border-t border-gray-300 pt-1 text-[10px] font-bold text-frost-dark bn-text">
                সর্বোচ্চ খুচরা মূল্য: ৳{retailPrice.toLocaleString("en-IN")}{" "}
                (ভ্যাট অন্তর্ভুক্ত)
              </div>
            </div>
          </div>

          {/* Sticker Quantity Selector */}
          <div>
            <label className="block text-xs font-bold text-frost-dark bn-text mb-1.5">
              স্টিকার সংখ্যা (Number of Labels)
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
                      : "bg-white border border-frost-border text-frost-dark hover:bg-frost-hover"
                  }`}
                >
                  {num}টি
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-frost-muted bn-text">
                কাস্টম সংখ্যা:
              </span>
              <input
                id={customStickersId}
                aria-label="কাস্টম স্টিকার সংখ্যা"
                type="number"
                min="1"
                max="500"
                value={stickerCount}
                onChange={(e) =>
                  setStickerCount(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-24 bg-white border border-frost-border rounded-lg px-2.5 py-1.5 text-sm font-bold text-frost-dark tabular-nums focus:border-emerald-600 focus:outline-hidden"
              />
              <span className="text-xs text-frost-muted bn-text">
                টি স্টিকার তৈরি হবে
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-frost-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-frost-muted hover:bg-frost-hover cursor-pointer bn-text transition-colors"
            >
              বাতিল (Cancel)
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer bn-text transition-colors shadow-sm"
            >
              <span>🖨️</span>
              <span>
                {stickerCount > 1
                  ? `${stickerCount}টি স্টিকার প্রিন্ট করুন`
                  : "প্রিন্ট স্টিকার (Print Label)"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
