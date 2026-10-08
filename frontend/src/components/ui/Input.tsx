import * as React from "react"
import { useId } from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string | null
  helperText?: string
  leftAdornment?: React.ReactNode
  rightAdornment?: React.ReactNode
  onClear?: () => void
  isMonospace?: boolean
  inputSize?: "sm" | "md" | "lg"
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
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
      type = "text",
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId

    const sizeClasses = {
      sm: "h-8 px-2.5 py-1 text-xs",
      md: "h-9 px-3 py-1.5 text-sm",
      lg: "h-11 px-3.5 py-2 text-base",
    }[inputSize]

    const hasValue = value !== undefined && value !== null && value !== ""

    return (
      <div className="w-full text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftAdornment && (
            <div className="absolute left-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              {leftAdornment}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            value={value}
            disabled={disabled}
            data-slot="input"
            aria-invalid={!!error}
            className={cn(
              "w-full rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              sizeClasses,
              isMonospace && "tabular-nums font-mono font-medium",
              error
                ? "border-destructive text-destructive focus-visible:ring-destructive/20 bg-rose-50/30 dark:bg-rose-950/20"
                : "border-input dark:border-slate-700 text-slate-900 dark:text-slate-100 focus-visible:border-ring",
              leftAdornment ? "pl-9" : "",
              rightAdornment || onClear ? "pr-9" : "",
              className,
            )}
            {...props}
          />

          {onClear && hasValue && !disabled && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-2.5 p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Clear input"
            >
              <X className="size-3.5" />
            </button>
          )}

          {rightAdornment && (!onClear || !hasValue) && (
            <div className="absolute right-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              {rightAdornment}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-1 text-xs font-medium text-destructive">{error}</p>
        )}

        {helperText && !error && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
        )}
      </div>
    )
  },
)

Input.displayName = "Input"

export default Input
