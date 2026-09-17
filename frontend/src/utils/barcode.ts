import { useEffect, useRef } from "react"

/**
 * Hardware Barcode Scanner Wedge Interceptor
 * 
 * BUSINESS DECISION: 1D USB/Bluetooth barcode scanners emulate keyboard strokes at ultra-high
 * speed (<30ms between keystrokes). This utility captures high-speed burst sequences ending with Enter
 * and routes them directly to the POS cart callback, stopping the scanner from polluting whichever
 * input field (search, customer, or price) currently has keyboard focus.
 */

export interface BarcodeScannerOptions {
  /** Maximum milliseconds between consecutive keystrokes to qualify as a hardware scanner. Default 35ms. */
  maxIntervalMs?: number
  /** Minimum characters for a valid barcode string. Default 3. */
  minLength?: number
  /** Whether the scanner listener is currently active. Default true. */
  enabled?: boolean
  /** Whether to prevent default Enter action on matched scan. Default true. */
  preventDefault?: boolean
}

/**
 * React hook to listen for hardware barcode scanner bursts globally across the window.
 */
export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  options: BarcodeScannerOptions = {},
) {
  const {
    maxIntervalMs = 35,
    minLength = 3,
    enabled = true,
    preventDefault = true,
  } = options

  const bufferRef = useRef<string[]>([])
  const lastTimeRef = useRef<number>(0)
  const onScanRef = useRef(onScan)

  // Keep callback reference updated
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now()
      const diff = currentTime - lastTimeRef.current

      // If the user is typing slowly (> maxIntervalMs), it is manual human typing: clear buffer
      if (diff > maxIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = []
      }

      lastTimeRef.current = currentTime

      if (e.key === "Enter") {
        if (bufferRef.current.length >= minLength) {
          const scannedCode = bufferRef.current.join("").trim()
          if (scannedCode.length >= minLength) {
            if (preventDefault) {
              e.preventDefault()
              e.stopPropagation()
            }
            onScanRef.current(scannedCode)
          }
        }
        bufferRef.current = []
        return
      }

      // Ignore modifier keys, tab, escape, function keys
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bufferRef.current.push(e.key)
      }
    }

    window.addEventListener("keydown", handleKeyDown, true) // capture phase
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [enabled, maxIntervalMs, minLength, preventDefault])
}
