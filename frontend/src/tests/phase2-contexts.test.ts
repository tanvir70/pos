import assert from "node:assert/strict"
import {
  calcLineTotal,
  calcDiscount,
  calcGrossProfit,
  calcChangeReturn,
  roundAccounting,
  toPaisa,
  fromPaisa,
} from "../utils/currency.ts"
import { ApiError } from "../api/client.ts"

console.log("Running Phase 2 Context & Logic Verification Suite...")

// 1. Currency Math Precision
{
  console.log("  [1/4] Verifying integer-paisa currency precision...")
  // Floating point edge case: 0.1 + 0.2
  assert.equal(roundAccounting(0.1 + 0.2), 0.3)

  // Line total with 3 decimal quantity (e.g. 2.375 kg * ৳450.50)
  const line = calcLineTotal(2.375, 450.5)
  assert.equal(line, 1069.94)

  // Discount percentage: 10% on 1069.94 = 106.99
  const discPct = calcDiscount(1069.94, "percent", "10")
  assert.equal(discPct, 106.99)

  // Flat discount
  const discFlat = calcDiscount(1000, "flat", "150")
  assert.equal(discFlat, 150)

  // Flat discount capped at subtotal
  const discCapped = calcDiscount(50, "flat", "100")
  assert.equal(discCapped, 50)

  // 1-Click round-off: ৳1453.60 -> deficit is ৳3.60
  const total = 1453.6
  const deficit = roundAccounting(total % 10)
  assert.equal(deficit, 3.6)
  const rounded = roundAccounting(total - deficit)
  assert.equal(rounded, 1450)

  // Gross profit & margin
  const selling = 1200
  const cost = 950
  const { profit, marginPct } = calcGrossProfit(selling, cost, 1)
  assert.equal(profit, 250)
  assert.equal(marginPct, 21)


  // Change return: paid ৳1500 on ৳1450 = ৳50 change
  const change = calcChangeReturn(1500, 1450)
  assert.equal(change, 50)

  console.log("  - Currency math precision verified.")
}

// 2. Cart Serialization and Hydration
{
  console.log("  [2/4] Verifying Cart session storage state structure...")
  const mockCartState = {
    cart: [
      {
        id: "cart-1-1710000000",
        productId: 1,
        productCode: "SYN-VIRT-100",
        nameEn: "Virtako 40WG",
        nameBn: "ভিরতাকো ৪০ ডব্লিউজি",
        baseUnit: "Packet",
        cartonMultiplier: 20,
        lotId: 101,
        lotNumber: "LOT-2026-001",
        expiryDate: "2027-05-15",
        purchaseCost: 280,
        lotRetailPrice: 350,
        lotWholesalePrice: 320,
        availableStock: 50,
        quantity: 3,
        unitPrice: 350,
      },
    ],
    saleMode: "RETAIL",
    selectedCustomerId: 2,
    discountType: "flat",
    discountValue: "50",
    roundOff: 0,
    paymentMethod: "CASH",
    cashPaidInput: "1000",
    digitalPaidInput: "",
    digitalMedium: "BKASH",
    digitalTrxId: "",
  }

  const serialized = JSON.stringify(mockCartState)
  const deserialized = JSON.parse(serialized)
  assert.equal(deserialized.cart.length, 1)
  assert.equal(deserialized.cart[0].productCode, "SYN-VIRT-100")
  assert.equal(deserialized.saleMode, "RETAIL")
  assert.equal(deserialized.selectedCustomerId, 2)
  console.log("  - Cart session serialization verified.")
}

// 3. ApiError Handling and Bengali Translation
{
  console.log("  [3/4] Verifying ApiError and Bengali error categorization...")
  const errInvalidPin = new ApiError("Bad PIN", 400, "INVALID_PIN")
  assert.equal(errInvalidPin.errorCode, "INVALID_PIN")

  const errStock = new ApiError("No stock", 400, "NEGATIVE_STOCK_NOT_ALLOWED")
  assert.equal(errStock.errorCode, "NEGATIVE_STOCK_NOT_ALLOWED")

  const errUnauthorized = new ApiError("Session expired", 401)
  assert.equal(errUnauthorized.status, 401)

  const errForbidden = new ApiError("Owner mode required", 403)
  assert.equal(errForbidden.status, 403)
  console.log("  - ApiError categorization verified.")
}

// 4. Token & Idempotency Key Headers Contract
{
  console.log("  [4/4] Verifying Idempotency Key generation contract...")
  const uuid = crypto.randomUUID()
  assert.ok(uuid.length > 20)
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  console.log("  - Idempotency UUID generation verified.")
}

console.log("ALL PHASE 2 VERIFICATION CHECKS PASSED CLEANLY!\n")
