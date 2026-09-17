/**
 * Financial Precision & BDT Currency Utility
 * 
 * BUSINESS DECISION: Eliminates IEEE 754 floating-point arithmetic errors (e.g. 0.1 + 0.2 = 0.30000000000000004)
 * by executing financial math in fixed-point integer paisa (1 BDT = 100 paisa) before converting to display strings.
 */

/**
 * Converts a BDT amount (e.g. 125.50) to integer paisa (e.g. 12550).
 */
export function toPaisa(amount: number | string | undefined | null): number {
  if (amount === undefined || amount === null || amount === "") return 0
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}

/**
 * Converts integer paisa back to fractional BDT number.
 */
export function fromPaisa(paisa: number): number {
  return paisa / 100
}

/**
 * Rounds any financial amount strictly to 2 decimal places using fixed-point integer math.
 */
export function roundAccounting(amount: number | string | undefined | null): number {
  return fromPaisa(toPaisa(amount))
}

/**
 * Formats a BDT numeric amount into a standardized display string with ৳ prefix and 2 decimals.
 * Example: 1250.5 -> "৳1,250.50"
 */
export function formatTk(amount: number | string | undefined | null): string {
  const rounded = roundAccounting(amount)
  return `৳${rounded.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Formats an amount with optional compact abbreviation if greater than 100k,
 * or standard 2-decimal display.
 */
export function formatTkCompact(amount: number | undefined | null): string {
  const num = roundAccounting(amount)
  if (Math.abs(num) >= 100000) {
    return `৳${(num / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 })}k`
  }
  return formatTk(num)
}

/**
 * Computes line total strictly using integer paisa multiplication to avoid micro-penny drift.
 * (unitPrice in Tk * quantity)
 */
export function calcLineTotal(unitPrice: number, quantity: number): number {
  const unitPaisa = toPaisa(unitPrice)
  // quantity can be fractional (e.g. 1.5 kg / liters)
  const totalPaisa = Math.round(unitPaisa * quantity)
  return fromPaisa(totalPaisa)
}

/**
 * Computes discount amount based on flat BDT or percentage.
 */
export function calcDiscount(
  subtotal: number,
  type: "flat" | "percent",
  valueStrOrNum: string | number,
): number {
  const subtotalPaisa = toPaisa(subtotal)
  if (subtotalPaisa <= 0) return 0

  const val = typeof valueStrOrNum === "string" ? parseFloat(valueStrOrNum) : valueStrOrNum
  if (isNaN(val) || val <= 0) return 0

  if (type === "percent") {
    const pct = Math.min(100, Math.max(0, val))
    const discountPaisa = Math.round((subtotalPaisa * pct) / 100)
    return fromPaisa(discountPaisa)
  }

  // Flat discount capped at subtotal
  const flatPaisa = Math.min(subtotalPaisa, toPaisa(val))
  return fromPaisa(flatPaisa)
}

/**
 * Calculates gross profit and margin percentage between sale price and acquisition cost.
 */
export function calcGrossProfit(
  sellingPrice: number,
  purchaseCost: number,
  quantity: number,
): { profit: number; marginPct: number } {
  const totalRevenue = calcLineTotal(sellingPrice, quantity)
  const totalCost = calcLineTotal(purchaseCost, quantity)
  const profit = roundAccounting(totalRevenue - totalCost)
  const marginPct = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0

  return {
    profit,
    marginPct,
  }
}

/**
 * Computes cash change return: max(0, tendered - payable).
 */
export function calcChangeReturn(tendered: number, payable: number): number {
  const tenderedPaisa = toPaisa(tendered)
  const payablePaisa = toPaisa(payable)
  const changePaisa = Math.max(0, tenderedPaisa - payablePaisa)
  return fromPaisa(changePaisa)
}
