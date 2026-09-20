import { useEffect, type ReactNode } from "react"
import { X } from "lucide-react"

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: "sm" | "md" | "lg" | "xl" | "full"
  closeOnEsc?: boolean
  closeOnClickOutside?: boolean
  className?: string
  headerVariant?: "dark" | "light" | "none"
  headerClassName?: string
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[95vw] min-h-[85vh]",
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = "md",
  closeOnEsc = true,
  closeOnClickOutside = true,
  className = "",
  headerVariant = "dark",
  headerClassName = "",
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEsc) {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, closeOnEsc, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (closeOnClickOutside && e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl border border-slate-200 w-full my-auto overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150 ${sizeClasses[size]} ${className}`.trim()}
      >
        {/* Modal Header */}
        {headerVariant !== "none" && (title || icon) && (
          <div
            className={`px-6 py-4 flex items-center justify-between shrink-0 ${
              headerVariant === "light"
                ? "bg-white border-b border-slate-200/80 text-slate-900"
                : "bg-slate-900 text-white"
            } ${headerClassName}`.trim()}
          >
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div
                  className={`shrink-0 flex items-center justify-center ${
                    headerVariant === "light"
                      ? "h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-2xs"
                      : "text-emerald-400"
                  }`}
                >
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h2
                  className={`font-bold text-base sm:text-lg leading-tight truncate ${
                    headerVariant === "light" ? "text-slate-900" : "text-white"
                  }`}
                >
                  {title}
                </h2>
                {subtitle && (
                  <p
                    className={`text-xs mt-0.5 truncate ${
                      headerVariant === "light" ? "text-slate-500 font-normal" : "text-slate-300"
                    }`}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                headerVariant === "light"
                  ? "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>

        {/* Modal Footer */}
        {footer && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
