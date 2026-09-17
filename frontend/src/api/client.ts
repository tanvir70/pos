// ============================================================================
// Lean Native Fetch API Client
// Ponytail Rules: Zero external HTTP dependencies, native fetch wrapper.
// ============================================================================

import type { ErrorResponse } from "../types"

// BUSINESS DECISION: Frontend uses native browser fetch targeting /api prefixed endpoints,
// routed to backend via Vite development proxy and configurable via VITE_API_BASE_URL.
// Eliminates external HTTP library weight (Axios) and adheres to Ponytail minimal architecture.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api"

export class ApiError extends Error {
  status: number
  errorCode?: string
  details?: Record<string, string> | null
  data?: ErrorResponse | unknown

  constructor(
    message: string,
    status: number,
    errorCode?: string,
    details?: Record<string, string> | null,
    data?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.errorCode = errorCode
    this.details = details
    this.data = data
  }
}

/**
 * Lean native fetch wrapper for typed JSON requests.
 */
export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`

  const headers = new Headers(options?.headers)
  if (
    !headers.has("Content-Type") &&
    options?.body &&
    typeof options.body === "string"
  ) {
    headers.set("Content-Type", "application/json")
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json, text/plain, */*")
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let errorDetail = response.statusText
    let errorCode: string | undefined
    let details: Record<string, string> | null | undefined
    let responseData: unknown = null
    try {
      const contentType = response.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        responseData = await response.json()
        if (responseData && typeof responseData === "object") {
          const obj = responseData as Partial<ErrorResponse> & Record<string, unknown>
          errorDetail = (obj.message ||
            obj.error ||
            JSON.stringify(responseData)) as string
          errorCode = obj.errorCode
          details = obj.details
        }
      } else {
        const text = await response.text()
        if (text) errorDetail = text
      }
    } catch {
      // Keep default status text
    }
    throw new ApiError(
      errorDetail || `Request failed with status ${response.status}`,
      response.status,
      errorCode,
      details,
      responseData,
    )
  }

  // Handle 204 No Content or empty bodies
  if (response.status === 204) {
    return {} as T
  }

  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return (await response.json()) as T
  }

  return (await response.text()) as unknown as T
}

/**
 * Downloads a binary/blob file and initiates an immediate browser download.
 * Extracts suggested filename from Content-Disposition header if available.
 */
export async function downloadBlob(
  endpoint: string,
  fallbackFilename = "download",
  options?: RequestInit,
): Promise<void> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`

  const response = await fetch(url, options)

  if (!response.ok) {
    let message = `Failed to download file (${response.status} ${response.statusText})`
    try {
      const text = await response.text()
      if (text) message = text
    } catch {
      // Use default message
    }
    throw new ApiError(message, response.status)
  }

  let filename = fallbackFilename
  const disposition = response.headers.get("Content-Disposition")
  if (disposition) {
    const filenameMatch = disposition.match(
      /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
    )
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].replace(/['"]/g, "").trim()
    }
  }

  const blob = await response.blob()
  const blobUrl = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = blobUrl
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(blobUrl)
}

/**
 * Fetches binary blob data (e.g. for image display).
 */
export async function fetchBlob(
  endpoint: string,
  options?: RequestInit,
): Promise<Blob> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`

  const response = await fetch(url, options)
  if (!response.ok) {
    throw new ApiError(
      `Failed to fetch blob (${response.status})`,
      response.status,
    )
  }
  return response.blob()
}
