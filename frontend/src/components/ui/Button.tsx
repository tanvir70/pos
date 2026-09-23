import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"
import { Loader2 } from "lucide-react"

export const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 shadow-xs",
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 shadow-xs",
        secondary: "border-border bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100 shadow-xs",
        outline: "border-border bg-background hover:bg-muted hover:text-foreground",
        ghost: "hover:bg-muted hover:text-foreground",
        destructive: "bg-destructive text-white hover:bg-destructive/90 shadow-xs",
        danger: "bg-destructive text-white hover:bg-destructive/90 shadow-xs",
        warning: "bg-amber-600 text-white hover:bg-amber-700 shadow-xs",
        link: "text-primary underline-offset-4 hover:underline",
        numpad: "bg-white hover:bg-emerald-50 active:bg-emerald-100 text-slate-900 border-border shadow-xs font-mono font-bold text-lg active:scale-[0.98] transition-transform",
      },
      size: {
        default: "h-9 px-3.5 py-2 text-sm gap-2",
        xs: "h-6 px-2 text-xs gap-1 rounded-md",
        sm: "h-8 px-2.5 text-xs gap-1.5 rounded-md",
        md: "h-9 px-3.5 py-2 text-sm gap-2",
        lg: "h-11 px-5 text-base gap-2.5 rounded-lg",
        xl: "h-13 px-6 text-lg gap-3 font-bold rounded-xl",
        icon: "size-9",
        "icon-sm": "size-7 rounded-md",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      fullWidth: false,
    },
  },
)

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>

export interface ButtonProps
  extends Omit<React.ComponentProps<"button">, "disabled">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  disabled?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      fullWidth = false,
      asChild = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isActuallyDisabled = disabled || isLoading

    if (asChild) {
      return (
        <Slot.Root
          data-slot="button"
          data-variant={variant}
          data-size={size}
          className={cn(buttonVariants({ variant, size, fullWidth, className }))}
          {...props}
        >
          {children}
        </Slot.Root>
      )
    }

    return (
      <button
        ref={ref}
        type={type}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        disabled={isActuallyDisabled}
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {children}
          </>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </button>
    )
  },
)

Button.displayName = "Button"

export default Button
