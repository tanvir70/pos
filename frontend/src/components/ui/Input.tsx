import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string | null
  helperText?: string
  leftAdornment?: ReactNode
  rightAdornment?: ReactNode
  onClear?: () => void
  isMonospace?: boolean
  inputSize?: "sm" | "md" | "lg"
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftAdornment,
      rightAdornment,
      onClear,
      isMonospace = false,
      inputSize = "md",
      id,
      className = "",
      disabled,
      value,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId

    const sizeClasses = {
      sm: "py-1.5 px-3 text-xs min-h-[34px]",
      md: "py-2 px-3.5 text-sm min-h-[42px]",
      lg: "py-3 px-4 text-base min-h-[50px]",
    }[inputSize]

    const fontClass = isMonospace ? "tabular-nums font-mono font-semibold" : ""
    const borderClass = error
      ? "border-red-400 focus:border-red-600 focus:ring-2 focus:ring-red-200 bg-red-50/20 text-red-950"
      : "border-frost-border focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-white text-frost-dark"

    return (
      <div className="w-full text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold text-frost-dark bn-text mb-1.5"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftAdornment && (
            <div className="absolute left-3 flex items-center pointer-events-none text-frost-muted text-sm">
              {leftAdornment}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            value={value}
            disabled={disabled}
            className={`w-full rounded-xl border transition-colors outline-hidden ${borderClass} ${sizeClasses} ${fontClass} ${
              leftAdornment ? "pl-9" : ""
            } ${rightAdornment || onClear ? "pr-9" : ""} ${
              disabled ? "bg-slate-100 text-slate-400 cursor-not-allowed" : ""
            } ${className}`.trim()}
            {...props}
          />

          {onClear && value && !disabled && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-3 p-0.5 text-frost-muted hover:text-frost-dark rounded-full hover:bg-frost-surface cursor-pointer text-xs"
              title="মুছুন"
            >
              ✕
            </button>
          )}

          {!onClear && rightAdornment && (
            <div className="absolute right-3 flex items-center pointer-events-none text-frost-muted text-sm">
              {rightAdornment}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-1 text-xs text-red-600 font-semibold bn-text flex items-center gap-1 animate-in fade-in duration-150">
            <span>⚠️</span>
            <span>{error}</span>
          </p>
        )}

        {!error && helperText && (
          <p className="mt-1 text-xs text-frost-muted bn-text">{helperText}</p>
        )}
      </div>
    )
  },
)

Input.displayName = "Input"

export default Input
