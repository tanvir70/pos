import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react"
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react"
import { ApiError } from "../api/client"

export type ToastType = "success" | "error" | "warning" | "info"

export interface ToastAction {
  label: string
  onClick: () => void
  intent?: "default" | "danger"
}

export interface ToastItem {
  id: string
  type: ToastType
  title?: string
  message: string
  timestamp: number
  duration?: number
  actions?: ToastAction[]
  presentation?: "default" | "confirmation"
}

export interface ToastContextType {
  showToast: (toast: Omit<ToastItem, "id" | "timestamp">) => string
  showSuccess: (message: string, title?: string) => string
  showError: (err: unknown, title?: string) => string
  showWarning: (message: string, title?: string) => string
  showInfo: (message: string, title?: string) => string
  dismissToast: (id: string) => void
  clearAll: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

// English translations for backend error codes & common errors
function parseErrorMessage(err: unknown): { title: string; message: string } {
  if (err instanceof ApiError) {
    if (err.errorCode) {
      switch (err.errorCode) {
        case "INVALID_CREDENTIALS":
          return {
            title: "Sign In Failed",
            message: err.message || "Invalid username or password.",
          }
        case "NEGATIVE_STOCK_NOT_ALLOWED":
          return {
            title: "Insufficient Stock",
            message: "Not enough stock available. Check stock levels and try again.",
          }
        case "CUSTOMER_CREDIT_EXCEEDED":
          return {
            title: "Credit Limit Exceeded",
            message: "This customer has exceeded their maximum credit limit!",
          }
        case "LOT_NOT_FOUND":
          return {
            title: "Lot Not Found",
            message: "The requested batch/lot was not found in the database.",
          }
        case "PRODUCT_NOT_FOUND":
          return {
            title: "Product Not Found",
            message: "The specified product could not be found.",
          }
        case "DUPLICATE_PRODUCT_CODE":
          return {
            title: "Duplicate Code",
            message: "This product code is already in use. Please enter a new code.",
          }
        case "VALIDATION_FAILED":
          return {
            title: "Validation Error",
            message: err.message || "The submitted data is invalid. Please check the form.",
          }
      }
    }

    if (err.status === 401) {
      return {
        title: "Unauthorized Session",
        message: "Your session has expired. Please log in again.",
      }
    }
    if (err.status === 403) {
      return {
        title: "Permission Denied",
        message: "You do not have permission to complete this action.",
      }
    }
    if (err.status >= 500) {
      return {
        title: "Server Error",
        message: "The server ran into a temporary problem. Please try again shortly.",
      }
    }

    return {
      title: "Error",
      message: err.message || "An unexpected error occurred.",
    }
  }

  if (err instanceof Error) {
    if (
      err.message.includes("Failed to fetch") ||
      err.message.includes("NetworkError")
    ) {
      return {
        title: "Network Disconnected",
        message: "Could not connect to the server. Check that the local server is running.",
      }
    }
    return {
      title: "Error",
      message: err.message,
    }
  }

  if (typeof err === "string") {
    return {
      title: "Notice",
      message: err,
    }
  }

  return {
    title: "Unexpected Error",
    message: "Something unexpected happened. Please try again.",
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, number>>(new Map())

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const clearAll = useCallback(() => {
    setToasts([])
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current.clear()
  }, [])

  const showToast = useCallback(
    (item: Omit<ToastItem, "id" | "timestamp">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const duration = item.duration ?? 4500
      const newToast: ToastItem = {
        ...item,
        id,
        timestamp: Date.now(),
        duration,
      }

      setToasts((prev) => [newToast, ...prev.slice(0, 4)]) // Keep max 5 toasts

      if (duration > 0) {
        const timer = window.setTimeout(() => {
          dismissToast(id)
        }, duration)
        timersRef.current.set(id, timer)
      }

      return id
    },
    [dismissToast],
  )

  const showSuccess = useCallback(
    (message: string, title = "Success") => {
      return showToast({ type: "success", title, message })
    },
    [showToast],
  )

  const showError = useCallback(
    (err: unknown, fallbackTitle?: string) => {
      const { title, message } = parseErrorMessage(err)
      return showToast({
        type: "error",
        title: fallbackTitle || title,
        message,
        duration: 6000,
      })
    },
    [showToast],
  )

  const showWarning = useCallback(
    (message: string, title = "Warning") => {
      return showToast({ type: "warning", title, message, duration: 5500 })
    },
    [showToast],
  )

  const showInfo = useCallback(
    (message: string, title = "Info") => {
      return showToast({ type: "info", title, message })
    },
    [showToast],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        dismissToast,
        clearAll,
      }}
    >
      {children}

      {/* High-contrast accessible Floating Alert Toasts Container */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-3 sm:px-0"
      >
        {toasts.map((toast) => {
          const isSuccess = toast.type === "success"
          const isError = toast.type === "error"
          const isWarning = toast.type === "warning"
          const isInfo = toast.type === "info"
          const isConfirmation = toast.presentation === "confirmation"

          return (
            <React.Fragment key={toast.id}>
              {isConfirmation && (
                <button
                  type="button"
                  aria-label="Cancel logout"
                  onClick={() => dismissToast(toast.id)}
                  className="pointer-events-auto fixed inset-0 z-[1] h-screen w-screen cursor-default bg-slate-950/55 backdrop-blur-[1px]"
                />
              )}
              <div
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl ${
                isConfirmation
                  ? "fixed left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-sm bg-white text-slate-900 border-red-200 shadow-2xl shadow-slate-950/30"
                  : "transition-all animate-in slide-in-from-top-2 duration-200"
              } ${
                isConfirmation
                  ? ""
                  : isSuccess
                  ? "bg-emerald-900/95 text-white border-emerald-500 shadow-emerald-950/30"
                  : isError
                    ? "bg-rose-900/95 text-white border-rose-500 shadow-rose-950/30"
                    : isWarning
                      ? "bg-amber-900/95 text-white border-amber-500 shadow-amber-950/30"
                      : "bg-slate-900/95 text-white border-slate-600 shadow-slate-950/30"
              }`}
            >
              {/* Semantic Icon */}
              <div className={`shrink-0 mt-0.5 select-none ${isConfirmation ? "text-red-600" : ""}`}>
                {isSuccess && <CheckCircle2 className="w-5 h-5" />}
                {isError && <XCircle className="w-5 h-5" />}
                {isWarning && <AlertTriangle className="w-5 h-5" />}
                {isInfo && <Info className="w-5 h-5" />}
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0 pr-1">
                {toast.title && (
                  <h4 className="font-bold text-sm tracking-tight leading-tight mb-0.5">
                    {toast.title}
                  </h4>
                )}
                <p
                  className={`text-xs leading-relaxed font-normal break-words ${
                    isConfirmation ? "text-slate-600" : "text-white/90"
                  }`}
                >
                  {toast.message}
                </p>
                {toast.actions && toast.actions.length > 0 && (
                  <div className="flex items-center justify-end gap-2 mt-3">
                    {toast.actions.map((action) => (
                      <button
                        type="button"
                        key={action.label}
                        onClick={action.onClick}
                        className={`px-3 py-1.5 rounded-md border text-xs font-bold cursor-pointer ${
                          action.intent === "danger"
                            ? "bg-rose-600 border-rose-500 text-white hover:bg-rose-500"
                            : isConfirmation
                              ? "bg-white border-red-300 text-red-700 hover:bg-red-50"
                              : "bg-white/10 border-white/25 text-white hover:bg-white/20"
                        }`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className={`shrink-0 rounded-md p-1 transition-colors leading-none cursor-pointer ${
                  isConfirmation
                    ? "text-slate-400 hover:text-red-600 hover:bg-red-50"
                    : "text-white/70 hover:text-white"
                }`}
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}
