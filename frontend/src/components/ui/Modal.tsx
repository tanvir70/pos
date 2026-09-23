import type { ReactNode } from "react"
import { X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./dialog"
import { cn } from "@/lib/utils"

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
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-[95vw] min-h-[85vh]",
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
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "w-full max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl border border-border bg-white shadow-2xl duration-150 sm:max-w-none",
          sizeClasses[size],
          className,
        )}
        onEscapeKeyDown={(e) => {
          if (!closeOnEsc) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (!closeOnClickOutside) e.preventDefault()
        }}
      >
        {/* Accessible hidden DialogTitle if title is not rendered in standard header */}
        <DialogTitle className="sr-only">
          {typeof title === "string" ? title : "Modal Dialog"}
        </DialogTitle>
        {subtitle && typeof subtitle === "string" && (
          <DialogDescription className="sr-only">{subtitle}</DialogDescription>
        )}

        {/* Modal Header */}
        {headerVariant !== "none" && (title || icon) && (
          <div
            className={cn(
              "px-6 py-4 flex items-center justify-between shrink-0",
              headerVariant === "light"
                ? "bg-white border-b border-border text-slate-900"
                : "bg-slate-900 text-white",
              headerClassName,
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div
                  className={cn(
                    "shrink-0 flex items-center justify-center",
                    headerVariant === "light"
                      ? "size-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-2xs"
                      : "text-emerald-400",
                  )}
                >
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h2
                  className={cn(
                    "font-bold text-base sm:text-lg leading-tight truncate",
                    headerVariant === "light" ? "text-slate-900" : "text-white",
                  )}
                >
                  {title}
                </h2>
                {subtitle && (
                  <p
                    className={cn(
                      "text-xs mt-0.5 truncate",
                      headerVariant === "light" ? "text-slate-500 font-normal" : "text-slate-300",
                    )}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={cn(
                "p-1.5 rounded-lg cursor-pointer transition-colors",
                headerVariant === "light"
                  ? "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-white/10",
              )}
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
          <div className="px-6 py-3.5 bg-slate-50 border-t border-border flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default Modal
