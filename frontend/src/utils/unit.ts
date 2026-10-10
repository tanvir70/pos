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
  "drum",
  "canister",
  "tub",
  "jar",
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
 * Canonical quantity formatter for the Rajib Enterprise POS & Inventory system.
 * Formats a quantity value appropriately:
 * - Whole numbers: Trims trailing zeros entirely (e.g. 2.000 -> "2", 10.000 -> "10").
 * - Fractional numbers: Preserves only meaningful decimal places up to 3 decimals without trailing zeros
 *   (e.g. 2.500 -> "2.5", 2.250 -> "2.25", 2.125 -> "2.125").
 * - Discrete units (Bottle, Packet, Piece, Bag, etc.): Rounded to integers.
 * - Handles numbers, strings, null, and undefined safely.
 */
export function formatQuantity(
  qty: number | string | null | undefined,
  unit?: string | null,
): string {
  if (qty == null || qty === "") return "0"
  const num = typeof qty === "string" ? parseFloat(qty) : Number(qty)
  if (!Number.isFinite(num)) return "0"

  if (unit && isDiscreteUnit(unit)) {
    return Math.round(num).toString()
  }

  if (Number.isInteger(num)) {
    return num.toString()
  }

  // Remove redundant trailing zeroes after decimal point for weights/liquids
  return parseFloat(num.toFixed(3)).toString()
}

/**
 * Formats a quantity value appropriately for its unit:
 * - Whole integers for discrete units (e.g. 2 instead of 2.000).
 * - Up to 3 decimal places without redundant trailing zeros for continuous units (Kg, Liter).
 * - Returns empty string if input is null or empty.
 */
export function formatQuantityByUnit(
  qty: number | string | null | undefined,
  unit?: string | null,
): string {
  if (qty == null || qty === "") return ""
  return formatQuantity(qty, unit)
}

export interface ParsedPackSize {
  amount: number
  unit: string
  type: "volume" | "weight" | "other"
  formatTotal: (multiplier: number) => {
    totalUnits: number
    primaryText: string
    secondaryText?: string
    combinedText: string
    shortText: string
  }
}

/**
 * Intelligent parser for agrochemical packaging sizes (e.g. "50 ml", "100 gm", "1 L", "20 x 50 ml").
 * Calculates total carton net content (volume/mass) avoiding unit confusion.
 */
export function parsePackSize(packSizeStr?: string | null, fallbackUnit?: string | null): ParsedPackSize | null {
  if (!packSizeStr) return null
  const clean = packSizeStr.trim()
  if (!clean) return null

  // If contains packaging breakdown like "20 x 50 ml" or "4 x 10 x 10 gm", take the last segment
  const segments = clean.split(/[xX*]/)
  const targetSegment = segments[segments.length - 1].trim()

  // Remove any bracketed notes like "(48s)" or "(200s)"
  const sanitized = targetSegment.replace(/\(.*?\)/g, "").trim()

  const match = sanitized.match(/^([\d.]+)\s*([a-zA-Z]+)?$/)
  if (!match) return null

  const amount = parseFloat(match[1])
  if (isNaN(amount) || amount <= 0) return null

  let rawUnit = (match[2] || "").toLowerCase()
  if (!rawUnit && fallbackUnit) {
    rawUnit = fallbackUnit.trim().toLowerCase()
  }

  // 1. Volume (ml / L)
  if (["ml", "mll", "milli", "milliliter", "millilitre", "milliliters", "millilitres"].includes(rawUnit)) {
    return {
      amount,
      unit: "ml",
      type: "volume",
      formatTotal: (multiplier: number) => {
        const totalMl = amount * multiplier
        const totalL = totalMl / 1000
        const lStr = Number(totalL.toFixed(3)).toString()
        const mlStr = totalMl.toLocaleString()

        if (totalMl >= 1000) {
          return {
            totalUnits: totalMl,
            primaryText: `${lStr} L`,
            secondaryText: `${mlStr} ml`,
            combinedText: totalMl % 1000 === 0 ? `${lStr} L` : `${lStr} L (${mlStr} ml)`,
            shortText: `${lStr} L`,
          }
        } else {
          return {
            totalUnits: totalMl,
            primaryText: `${mlStr} ml`,
            secondaryText: `${lStr} L`,
            combinedText: `${mlStr} ml (${lStr} L)`,
            shortText: `${mlStr} ml`,
          }
        }
      },
    }
  }

  if (["l", "lt", "ltr", "liter", "litre", "liters", "litres"].includes(rawUnit)) {
    return {
      amount,
      unit: "L",
      type: "volume",
      formatTotal: (multiplier: number) => {
        const totalL = amount * multiplier
        const lStr = Number(totalL.toFixed(2)).toString()
        return {
          totalUnits: totalL * 1000,
          primaryText: `${lStr} L`,
          combinedText: `${lStr} L`,
          shortText: `${lStr} L`,
        }
      },
    }
  }

  // 2. Weight (gm / Kg / mg)
  if (["gm", "g", "gram", "grams"].includes(rawUnit)) {
    return {
      amount,
      unit: "gm",
      type: "weight",
      formatTotal: (multiplier: number) => {
        const totalGm = amount * multiplier
        const totalKg = totalGm / 1000
        const kgStr = Number(totalKg.toFixed(3)).toString()
        const gmStr = totalGm.toLocaleString()

        if (totalGm >= 1000) {
          return {
            totalUnits: totalGm,
            primaryText: `${kgStr} Kg`,
            secondaryText: `${gmStr} gm`,
            combinedText: totalGm % 1000 === 0 ? `${kgStr} Kg` : `${kgStr} Kg (${gmStr} gm)`,
            shortText: `${kgStr} Kg`,
          }
        } else {
          return {
            totalUnits: totalGm,
            primaryText: `${gmStr} gm`,
            secondaryText: `${kgStr} Kg`,
            combinedText: `${gmStr} gm (${kgStr} Kg)`,
            shortText: `${gmStr} gm`,
          }
        }
      },
    }
  }

  if (["kg", "kgs", "kilo", "kilogram", "kilograms"].includes(rawUnit)) {
    return {
      amount,
      unit: "Kg",
      type: "weight",
      formatTotal: (multiplier: number) => {
        const totalKg = amount * multiplier
        const kgStr = Number(totalKg.toFixed(2)).toString()
        return {
          totalUnits: totalKg * 1000,
          primaryText: `${kgStr} Kg`,
          combinedText: `${kgStr} Kg`,
          shortText: `${kgStr} Kg`,
        }
      },
    }
  }

  if (["mg", "milligram", "milligrams"].includes(rawUnit)) {
    return {
      amount,
      unit: "mg",
      type: "weight",
      formatTotal: (multiplier: number) => {
        const totalMg = amount * multiplier
        return {
          totalUnits: totalMg / 1000,
          primaryText: `${totalMg.toLocaleString()} mg`,
          combinedText: `${totalMg.toLocaleString()} mg`,
          shortText: `${totalMg.toLocaleString()} mg`,
        }
      },
    }
  }

  return null
}

/**
 * Extracts carton packaging multiplier from strings like
 * "40 x 100 gm", "(200s)", "(48s)", "10 x 1 Kg", "20 * 50ml".
 */
export function extractCartonMultiplier(packSize?: string | null): number | null {
  if (!packSize) return null
  const bracketMatch = packSize.match(/\((\d+)s?\)/i)
  if (bracketMatch) {
    const val = parseInt(bracketMatch[1], 10)
    if (val > 1) return val
  }
  const multiMatch = packSize.match(/^(\d+)\s*[xX*]/)
  if (multiMatch) {
    const val = parseInt(multiMatch[1], 10)
    if (val > 1) return val
  }
  return null
}

/**
 * Resolves the effective carton multiplier for any product or lot item.
 * Checks explicit multiplier first, then extracts from pack size / unit size formulas.
 * Falls back to 1 (single unit / no carton).
 */
export function getEffectiveMultiplier(
  multiplier?: number | string | null,
  packSize?: string | null,
  unitSize?: string | null,
): number {
  const num = typeof multiplier === "string" ? parseFloat(multiplier) : multiplier
  if (num != null && !isNaN(num) && num > 1) {
    return num
  }
  const fromPack = extractCartonMultiplier(packSize)
  if (fromPack && fromPack > 1) {
    return fromPack
  }
  const fromUnit = extractCartonMultiplier(unitSize)
  if (fromUnit && fromUnit > 1) {
    return fromUnit
  }
  return 1
}

/**
 * Pluralizes inventory units cleanly (e.g. 1 Bottle -> Bottle, 2 Bottle -> Bottles, 1 Box -> Box, 2 Box -> Boxes).
 * Avoids awkward pluralization like '50 mls' or 'Boxs'.
 */
export function pluralizeUnit(unit: string | null | undefined, count: number): string {
  if (!unit) return ""
  const clean = unit.trim()
  if (!clean) return ""
  if (count === 1) return clean

  const lower = clean.toLowerCase()
  if (lower === "box") return `${clean}es`
  if (lower.endsWith("s")) return clean
  if (["ml", "gm", "g", "l", "kg", "ltr", "liter", "litre"].includes(lower)) {
    return clean
  }
  return `${clean}s`
}

/**
 * Formats a count and its unit: e.g. formatUnitQuantity(2, "Bottle") -> "2 Bottles".
 */
export function formatUnitQuantity(count: number, unit: string | null | undefined): string {
  if (!unit) return String(count)
  return `${count} ${pluralizeUnit(unit, count)}`
}

/**
 * Returns singular and plural labels for inventory counting units.
 * Eliminates awkward labels like "Quantity (ml) *" or "Total: 50 mls".
 */
export function getPackagingUnit(
  baseUnit?: string | null,
  packSize?: string | null,
): { singular: string; plural: string } {
  const clean = (baseUnit || "").trim()
  const lower = clean.toLowerCase()

  // 1. If base unit is already discrete (Bottle, Packet, Piece, Can, Box, etc.)
  if (isDiscreteUnit(lower)) {
    const cap = clean.charAt(0).toUpperCase() + clean.slice(1)
    if (lower === "box") return { singular: cap, plural: "Boxes" }
    if (lower.endsWith("s")) return { singular: cap, plural: cap }
    return { singular: cap, plural: `${cap}s` }
  }

  // 2. Continuous units (ml, gm, L, Kg) are net liquid/mass sizes of individual bottles/packs
  const indicator = (packSize || lower).toLowerCase()
  if (
    indicator.includes("ml") ||
    indicator.includes("liter") ||
    indicator.includes("litre") ||
    indicator.includes(" l")
  ) {
    return { singular: "Bottle", plural: "Bottles" }
  }
  if (
    indicator.includes("gm") ||
    indicator.includes("gram") ||
    indicator.includes("kg") ||
    indicator.includes("packet")
  ) {
    return { singular: "Packet", plural: "Packets" }
  }

  return { singular: "Unit", plural: "Units" }
}

