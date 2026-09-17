import { useEffect, useRef, type ReactNode } from "react"

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
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (closeOnClickOutside && e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={contentRef}
        className={`bg-white rounded-2xl shadow-2xl border border-frost-border w-full my-auto overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150 ${sizeClasses[size]} ${className}`.trim()}
      >
        {/* Modal Header */}
        {(title || icon) && (
          <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {icon && <span className="text-2xl shrink-0">{icon}</span>}
              <div className="min-w-0">
                <h2 className="font-bold text-base sm:text-lg bn-text leading-tight truncate">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-xs text-emerald-100/90 bn-text mt-0.5 truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors text-sm"
              title="বন্ধ করুন (Esc)"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>

        {/* Modal Footer */}
        {footer && (
          <div className="px-6 py-3.5 bg-frost-surface border-t border-frost-border/60 flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal

