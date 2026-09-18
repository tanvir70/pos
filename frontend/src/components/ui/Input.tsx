import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react"
import { X } from "lucide-react"

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
      md: "py-2 px-3.5 text-sm min-h-[40px]",
      lg: "py-2.5 px-4 text-base min-h-[46px]",
    }[inputSize]

    const fontClass = isMonospace ? "tabular-nums font-mono font-medium" : ""
    const borderClass = error
      ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/30 text-red-900"
      : "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-white text-slate-900"

    return (
      <div className="w-full text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftAdornment && (
            <div className="absolute left-3 flex items-center pointer-events-none text-slate-400 text-sm">
              {leftAdornment}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            value={value}
            disabled={disabled}
            className={`w-full rounded-lg border transition-colors outline-hidden ${borderClass} ${sizeClasses} ${fontClass} ${
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
              className="absolute right-3 p-0.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer"
              title="Clear"
            >
              <X size={14} />
            </button>
          )}

          {!onClear && rightAdornment && (
            <div className="absolute right-3 flex items-center pointer-events-none text-slate-400 text-sm">
              {rightAdornment}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1 animate-in fade-in duration-150">
            <span>{error}</span>
          </p>
        )}

        {!error && helperText && (
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    )
  },
)

Input.displayName = "Input"

export default Input
