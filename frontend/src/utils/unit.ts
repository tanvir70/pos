/**
 * Helpers for distinguishing discrete (packaged/countable) vs continuous (weight/volume) units
 * in agrochemical dealership workflows.
 */

const DISCRETE_UNITS = new Set([
  "packet",
  "bottle",
  "piece",
  "pcs",
  "pc",
  "box",
  "can",
  "strip",
  "vial",
  "bag",
  "carton",
  "cartoon",
  "unit",
  "প্যাকেট",
  "বোতল",
  "পিস",
  "বক্স",
  "ক্যান",
  "স্ট্রিপ",
  "কার্টুন",
  "ব্যাগ",
])

/**
 * Returns true if the unit represents discrete/countable items (e.g. Packet, Bottle).
 */
export function isDiscreteUnit(unit?: string | null): boolean {
  if (!unit) return false
  return DISCRETE_UNITS.has(unit.trim().toLowerCase())
}

/**
 * Formats a quantity value appropriately for its unit:
 * - Whole integers for discrete units (e.g. 2 instead of 2.000).
 * - Up to 3 decimal places without redundant trailing zeros for continuous units (Kg, Liter).
 */
export function formatQuantityByUnit(
  qty: number | string | null | undefined,
  unit?: string | null,
): string {
  if (qty == null || qty === "") return ""
  const num = typeof qty === "string" ? parseFloat(qty) : qty
  if (isNaN(num)) return ""

  if (isDiscreteUnit(unit)) {
    return Math.round(num).toString()
  }

  // Remove redundant trailing zeroes after decimal point for weights/liquids
  return parseFloat(num.toFixed(3)).toString()
}
