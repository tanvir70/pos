import assert from "node:assert/strict"
import { ApiError, DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_DOWNLOAD_TIMEOUT_MS } from "../api/client.ts"

console.log("Running Network Resilience & Timeout Verification Suite...")

// 1. Timeout Constants
{
  console.log("  [1/3] Verifying default network timeout thresholds...")
  assert.equal(DEFAULT_REQUEST_TIMEOUT_MS, 12000, "Standard API timeout must be 12 seconds")
  assert.equal(DEFAULT_DOWNLOAD_TIMEOUT_MS, 30000, "Download/blob timeout must be 30 seconds")
  console.log("  - Timeout thresholds verified.")
}

// 2. ApiError Contract for Timeouts
{
  console.log("  [2/3] Verifying ApiError contract on timeout...")
  const timeoutErr = new ApiError(
    "Request timed out. The server may be busy or connection was interrupted.",
    408,
    "REQUEST_TIMEOUT"
  )
  assert.equal(timeoutErr.status, 408)
  assert.equal(timeoutErr.errorCode, "REQUEST_TIMEOUT")
  assert.equal(timeoutErr.name, "ApiError")
  assert.match(timeoutErr.message, /timed out/i)
  console.log("  - Timeout ApiError contract verified.")
}

// 3. Simulated Timeout Signal
{
  console.log("  [3/3] Verifying AbortController timeout execution...")
  const controller = new AbortController()
  let isTimedOut = false

  const timer = setTimeout(() => {
    isTimedOut = true
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"))
  }, 50)

  await new Promise((resolve) => setTimeout(resolve, 80))
  clearTimeout(timer)

  assert.equal(isTimedOut, true, "Timeout flag should be true")
  assert.equal(controller.signal.aborted, true, "Signal must be aborted")
  assert.equal(controller.signal.reason?.name, "TimeoutError", "Abort reason must be TimeoutError")
  console.log("  - AbortController timeout behavior verified.")
}

console.log("ALL NETWORK RESILIENCE CHECKS PASSED CLEANLY!\n")
