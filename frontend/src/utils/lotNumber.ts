/**
 * Utility for generating and formatting clean, sequential lot numbers (e.g. LOT-01, LOT-02).
 */

/**
 * Calculates the next sequential lot number for a product.
 * Starts from "LOT-01" and increments ("LOT-02", "LOT-03", etc.).
 */
export function getNextLotNumber(existingLots?: { lotNumber?: string }[] | null): string {
  if (!existingLots || existingLots.length === 0) {
    return "LOT-01"
  }

  let maxNum = 0
  for (const lot of existingLots) {
    if (!lot.lotNumber) continue
    const match = lot.lotNumber.trim().match(/^LOT-(\d+)$/i)
    if (match) {
      const n = parseInt(match[1], 10)
      // Only consider simple numbers (< 1000) to avoid old timestamp-based numbers
      if (!isNaN(n) && n < 1000) {
        if (n > maxNum) maxNum = n
      }
    }
  }

  const nextNum = maxNum > 0 ? maxNum + 1 : existingLots.length + 1
  return `LOT-${String(nextNum).padStart(2, "0")}`
}

/**
 * Formats a lot number for clean, user-facing presentation.
 * Maps legacy "DEFAULT" or missing lot numbers to "LOT-01" (or sequential fallback index).
 */
export function formatLotNumber(lotNumber?: string | null, fallbackIndex: number = 0): string {
  if (!lotNumber || lotNumber.trim() === "" || lotNumber.toUpperCase() === "DEFAULT") {
    return `LOT-${String(fallbackIndex + 1).padStart(2, "0")}`
  }

  const trimmed = lotNumber.trim()
  const match = trimmed.match(/^LOT-(\d+)$/i)
  if (match) {
    const n = parseInt(match[1], 10)
    if (!isNaN(n) && n < 1000) {
      return `LOT-${String(n).padStart(2, "0")}`
    }
  }

  // If it was a legacy timestamp lot like STOCK-123456 or LOT-928172
  if (/^(STOCK|LOT)-\d{5,}$/i.test(trimmed)) {
    return `LOT-${String(fallbackIndex + 1).padStart(2, "0")}`
  }

  return trimmed
}
