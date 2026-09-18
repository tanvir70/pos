// ============================================================================
// Lean Native Fetch API Client
// Ponytail Rules: Zero external HTTP dependencies, native fetch wrapper.
// ============================================================================

import type { ErrorResponse } from "../types"

// BUSINESS DECISION: Frontend uses native browser fetch targeting /api prefixed endpoints,
// routed to backend via Vite development proxy and configurable via VITE_API_BASE_URL.
// Eliminates external HTTP library weight (Axios) and adheres to Ponytail minimal architecture.
export const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    import.meta?.env?.VITE_API_BASE_URL) ||
  "/api"


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

export const AUTH_TOKEN_KEY = "pos_auth_token"
export const AUTH_ROLE_KEY = "pos_auth_role"
export const AUTH_USERNAME_KEY = "pos_auth_username"
export const AUTH_FULLNAME_KEY = "pos_auth_fullname"

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

// In-memory override for the active request token, used for a temporary Owner PIN
// elevation that should drive live API calls without persisting to localStorage
// (so it never survives a refresh and doesn't replace the underlying account session).
let activeTokenOverride: string | null = null

export function setActiveTokenOverride(token: string | null): void {
  activeTokenOverride = token
}

function resolveActiveToken(): string | null {
  return activeTokenOverride ?? getStoredToken()
}

export function getStoredUser(): { username: string | null; fullName: string | null } {
  try {
    return {
      username: localStorage.getItem(AUTH_USERNAME_KEY),
      fullName: localStorage.getItem(AUTH_FULLNAME_KEY),
    }
  } catch {
    return { username: null, fullName: null }
  }
}

export function setStoredAuth(
  token: string,
  role: string,
  username?: string | null,
  fullName?: string | null,
): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    localStorage.setItem(AUTH_ROLE_KEY, role)
    if (username) {
      localStorage.setItem(AUTH_USERNAME_KEY, username)
    }
    if (fullName) {
      localStorage.setItem(AUTH_FULLNAME_KEY, fullName)
    }
  } catch {
    // ignore storage failures in private browsing
  }
}

export function clearStoredAuth(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_ROLE_KEY)
    localStorage.removeItem(AUTH_USERNAME_KEY)
    localStorage.removeItem(AUTH_FULLNAME_KEY)
  } catch {
    // ignore storage failures
  }
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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

  // Inject Bearer Auth token if available and not already set
  const token = resolveActiveToken()
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  // Inject Idempotency key for mutating requests (POST, PUT, DELETE)
  const method = (options?.method || "GET").toUpperCase()
  if (["POST", "PUT", "DELETE"].includes(method) && !headers.has("X-Idempotency-Key")) {
    headers.set("X-Idempotency-Key", generateIdempotencyKey())
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

  const headers = new Headers(options?.headers)
  const token = resolveActiveToken()
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(url, { ...options, headers })

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
