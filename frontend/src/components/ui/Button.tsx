import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react"

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "warning"
  | "outline"
  | "ghost"
  | "numpad"

export type ButtonSize = "sm" | "md" | "lg" | "xl"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white border-transparent shadow-xs focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1",
  secondary:
    "bg-frost-surface hover:bg-frost-hover active:bg-slate-200 text-frost-dark border-frost-border focus:ring-2 focus:ring-slate-400 focus:ring-offset-1",
  danger:
    "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-transparent shadow-xs focus:ring-2 focus:ring-red-500 focus:ring-offset-1",
  warning:
    "bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white border-transparent shadow-xs focus:ring-2 focus:ring-amber-500 focus:ring-offset-1",
  outline:
    "bg-transparent hover:bg-emerald-50 active:bg-emerald-100 text-emerald-800 border-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1",
  ghost:
    "bg-transparent hover:bg-frost-hover active:bg-slate-200 text-frost-dark border-transparent focus:ring-2 focus:ring-slate-400",
  numpad:
    "bg-white hover:bg-emerald-50 active:bg-emerald-100 text-frost-dark border-frost-border shadow-xs font-mono font-bold text-xl active:scale-[0.98] transition-transform",
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs min-h-[32px] rounded-lg gap-1.5",
  md: "px-3.5 py-2 text-sm min-h-[40px] rounded-xl gap-2",
  lg: "px-5 py-2.5 text-base min-h-[48px] rounded-xl gap-2.5",
  xl: "px-6 py-3.5 text-lg min-h-[56px] rounded-2xl gap-3 font-black",
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = "",
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const baseClasses =
      "inline-flex items-center justify-center font-bold bn-text border transition-colors select-none cursor-pointer focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
    const widthClass = fullWidth ? "w-full" : ""
    const currentVariant = variantStyles[variant]
    const currentSize = sizeStyles[size]

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${currentVariant} ${currentSize} ${widthClass} ${className}`.trim()}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && (
          <span className="shrink-0 flex items-center">{rightIcon}</span>
        )}
      </button>
    )
  },
)

Button.displayName = "Button"
