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

export interface ToastOptions {
  position?: "top-right" | "top-center" | "center"
  duration?: number
  actions?: ToastAction[]
  presentation?: "default" | "confirmation"
  closePrevious?: boolean
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
  position?: "top-right" | "top-center" | "center"
  closePrevious?: boolean
  isClosing?: boolean
}

export interface ToastContextType {
  showToast: (toast: Omit<ToastItem, "id" | "timestamp">) => string
  showSuccess: (message: string, title?: string, options?: ToastOptions) => string
  showError: (err: unknown, title?: string, options?: ToastOptions) => string
  showWarning: (message: string, title?: string, options?: ToastOptions) => string
  showInfo: (message: string, title?: string, options?: ToastOptions) => string
  showToggleToast: (
    message: string,
    title?: string,
    type?: ToastType,
    options?: ToastOptions,
  ) => string
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
  const transitionTimerRef = useRef<number | null>(null)

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isClosing: true } : t)),
    )
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 150)
  }, [])

  const clearAll = useCallback(() => {
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current.clear()
    setToasts([])
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

      // If closePrevious is requested (e.g., system toggle clicked), close previous toast first
      if (item.closePrevious) {
        if (transitionTimerRef.current) {
          window.clearTimeout(transitionTimerRef.current)
          transitionTimerRef.current = null
        }
        timersRef.current.forEach((t) => window.clearTimeout(t))
        timersRef.current.clear()

        setToasts((prev) => {
          const activeToasts = prev.filter((t) => !t.isClosing)
          if (activeToasts.length > 0) {
            // Smoothly close previous toaster first, then show second toaster
            transitionTimerRef.current = window.setTimeout(() => {
              setToasts([newToast])
              if (duration > 0) {
                const timer = window.setTimeout(() => {
                  dismissToast(id)
                }, duration)
                timersRef.current.set(id, timer)
              }
              transitionTimerRef.current = null
            }, 150)
            return prev.map((t) => ({ ...t, isClosing: true }))
          } else {
            // No previous toast on screen, show immediately
            if (duration > 0) {
              const timer = window.setTimeout(() => {
                dismissToast(id)
              }, duration)
              timersRef.current.set(id, timer)
            }
            return [newToast]
          }
        })
        return id
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
    (message: string, title = "Success", options?: ToastOptions) => {
      return showToast({ type: "success", title, message, ...options })
    },
    [showToast],
  )

  const showError = useCallback(
    (err: unknown, fallbackTitle?: string, options?: ToastOptions) => {
      const { title, message } = parseErrorMessage(err)
      return showToast({
        type: "error",
        title: fallbackTitle || title,
        message,
        duration: 6000,
        ...options,
      })
    },
    [showToast],
  )

  const showWarning = useCallback(
    (message: string, title = "Warning", options?: ToastOptions) => {
      return showToast({ type: "warning", title, message, duration: 5500, ...options })
    },
    [showToast],
  )

  const showInfo = useCallback(
    (message: string, title = "Info", options?: ToastOptions) => {
      return showToast({ type: "info", title, message, ...options })
    },
    [showToast],
  )

  const showToggleToast = useCallback(
    (
      message: string,
      title?: string,
      type: ToastType = "info",
      options?: ToastOptions,
    ) => {
      return showToast({ type, title, message, closePrevious: true, ...options })
    },
    [showToast],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current)
      }
      timersRef.current.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  const renderToast = (toast: ToastItem) => {
    const isSuccess = toast.type === "success"
    const isError = toast.type === "error"
    const isWarning = toast.type === "warning"
    const isInfo = toast.type === "info"
    const isConfirmation = toast.presentation === "confirmation"
    const isTopCenter = toast.position === "top-center"
    const isCenter = toast.position === "center"
    const isClosing = toast.isClosing

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
          className={`pointer-events-auto flex items-start gap-3.5 p-4 rounded-xl border shadow-xl transition-all duration-150 ${
            isClosing
              ? "opacity-0 -translate-y-2 scale-95 pointer-events-none"
              : isConfirmation
                ? "fixed left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-sm bg-white text-slate-900 border-red-200 shadow-2xl shadow-slate-950/30"
                : isTopCenter
                  ? "w-full animate-in slide-in-from-top-4 fade-in duration-250 shadow-2xl backdrop-blur-md rounded-2xl border-2"
                  : isCenter
                    ? "w-full animate-in zoom-in-95 fade-in duration-200 shadow-2xl backdrop-blur-md rounded-2xl border-2"
                    : "w-full animate-in slide-in-from-top-2 duration-200"
          } ${
            isConfirmation
              ? ""
              : isSuccess
              ? "bg-emerald-900/95 text-white border-emerald-400 shadow-emerald-950/40"
              : isError
                ? "bg-rose-900/95 text-white border-rose-500 shadow-rose-950/30"
                : isWarning
                  ? "bg-amber-900/95 text-white border-amber-500 shadow-amber-950/30"
                  : "bg-slate-900/95 text-white border-slate-600 shadow-slate-950/30"
          }`}
        >
          {/* Semantic Icon */}
          <div className={`shrink-0 mt-0.5 select-none ${isConfirmation ? "text-red-600" : ""}`}>
            {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-300" />}
            {isError && <XCircle className="w-5 h-5 text-rose-300" />}
            {isWarning && <AlertTriangle className="w-5 h-5 text-amber-300" />}
            {isInfo && <Info className="w-5 h-5 text-sky-300" />}
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
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </React.Fragment>
    )
  }

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showToggleToast,
        dismissToast,
        clearAll,
      }}
    >
      {children}

      {/* Top Center Toasts Container (Middle of screen) */}
      {toasts.some((t) => t.position === "top-center") && (
        <div
          aria-live="polite"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2.5 max-w-sm sm:max-w-lg w-full pointer-events-none px-4"
        >
          {toasts
            .filter((t) => t.position === "top-center")
            .map(renderToast)}
        </div>
      )}

      {/* Dead Center Toasts Container */}
      {toasts.some((t) => t.position === "center") && (
        <div
          aria-live="polite"
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] flex flex-col items-center gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-4"
        >
          {toasts
            .filter((t) => t.position === "center")
            .map(renderToast)}
        </div>
      )}

      {/* Default Top-Right Floating Alert Container */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-3 sm:px-0"
      >
        {toasts
          .filter((t) => !t.position || t.position === "top-right")
          .map(renderToast)}
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
