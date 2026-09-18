// ============================================================================
// Wholesale Configuration Settings & Pricing Engine
// ============================================================================

import { roundAccounting } from "./currency.ts"

export const WHOLESALE_SETTINGS_KEY = "pos_wholesale_settings_v1"

export interface WholesaleSettings {
  discountPercentage: number // e.g. 5 means 5% discount from retail price
  enabled: boolean
  updatedAt?: string
}

export const DEFAULT_WHOLESALE_SETTINGS: WholesaleSettings = {
  discountPercentage: 5,
  enabled: true,
}

/**
 * Retrieve active wholesale configuration settings from localStorage.
 */
export function getWholesaleSettings(): WholesaleSettings {
  try {
    const raw = localStorage.getItem(WHOLESALE_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_WHOLESALE_SETTINGS }
    const parsed = JSON.parse(raw)
    const discount = typeof parsed.discountPercentage === "number" && parsed.discountPercentage >= 0
      ? parsed.discountPercentage
      : DEFAULT_WHOLESALE_SETTINGS.discountPercentage
    return {
      discountPercentage: discount,
      enabled: parsed.enabled ?? true,
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return { ...DEFAULT_WHOLESALE_SETTINGS }
  }
}

/**
 * Persist updated wholesale configuration settings.
 */
export function saveWholesaleSettings(settings: Partial<WholesaleSettings>): WholesaleSettings {
  const current = getWholesaleSettings()
  const updated: WholesaleSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(WHOLESALE_SETTINGS_KEY, JSON.stringify(updated))
    // Dispatch custom window event so open tabs/components react immediately
    window.dispatchEvent(new CustomEvent("wholesale-settings-updated", { detail: updated }))
  } catch (err) {
    console.error("Failed to save wholesale settings:", err)
  }
  return updated
}

/**
 * Calculates wholesale price based on retail price and pre-configured wholesale ratio.
 * E.g., retail = ৳100, ratio = 5% -> ৳95.00
 */
export function calcWholesalePrice(
  retailPrice: number | undefined | null,
  settings?: WholesaleSettings,
): number {
  const base = Number(retailPrice) || 0
  if (base <= 0) return 0
  const cfg = settings || getWholesaleSettings()
  const ratio = Math.max(0, Math.min(100, cfg.discountPercentage))
  const multiplier = (100 - ratio) / 100
  return roundAccounting(base * multiplier)
}
