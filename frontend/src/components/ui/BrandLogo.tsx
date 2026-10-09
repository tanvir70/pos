import React from "react"
import logoImg from "../../assets/logo.png"

export interface BrandLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | number
  variant?: "image" | "emblem" | "monochrome"
  className?: string
  showText?: boolean
  subtitle?: string
}

const SIZE_MAP: Record<string, { box: string; px: number }> = {
  xs: { box: "w-6 h-6", px: 24 },
  sm: { box: "w-8 h-8", px: 32 },
  md: { box: "w-10 h-10", px: 40 },
  lg: { box: "w-14 h-14", px: 56 },
  xl: { box: "w-20 h-20", px: 80 },
  "2xl": { box: "w-28 h-28", px: 112 },
}

/**
 * Rajib Enterprise — Shieldless R Monogram with Living Leaves & Golden Wheat
 * Zoomed in, 100% transparent background (no white card or box container).
 */
export default function BrandLogo({
  size = "md",
  variant = "image",
  className = "",
  showText = false,
  subtitle = "Authorized Syngenta Dealer",
}: BrandLogoProps) {
  const sizeConfig = typeof size === "number" ? { box: "", px: size } : SIZE_MAP[size] || SIZE_MAP.md
  const dimensionStyle = typeof size === "number" ? { width: `${size}px`, height: `${size}px` } : undefined

  // 1. Transparent Cropped High-Resolution Emblem Image (Default)
  if (variant === "image") {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        <div
          style={dimensionStyle}
          className={`${sizeConfig.box} shrink-0 flex items-center justify-center select-none`}
        >
          <img
            src={logoImg}
            alt="Messers Rajib Enterprise Logo"
            className="w-full h-full object-contain filter drop-shadow-xs transition-transform duration-200"
          />
        </div>

        {showText && (
          <div className="min-w-0">
            <div className="font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              RAJIB ENTERPRISE
            </div>
            {subtitle && (
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 tracking-wide uppercase truncate">
                {subtitle}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // 2. Pure Scalable Vector SVG Variant (100% transparent, no shield, no box)
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        style={dimensionStyle}
        className={`${sizeConfig.box} shrink-0`}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Messers Rajib Enterprise Brand Emblem"
      >
        <defs>
          <linearGradient id="rGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>

          <linearGradient id="rEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>

          <linearGradient id="rLeafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* Golden Left Pillar of "R" */}
        <path
          d="M26 22H36V82H26V22Z"
          fill={variant === "monochrome" ? "currentColor" : "url(#rGoldGrad)"}
        />

        {/* Flourishing Twin Leaves blooming outward from the stem */}
        <path
          d="M28 46C16 42 12 28 16 18C26 20 30 32 28 46Z"
          fill={variant === "monochrome" ? "currentColor" : "url(#rLeafGrad)"}
        />
        <path
          d="M32 38C22 34 20 22 24 14C32 16 34 26 32 38Z"
          fill={variant === "monochrome" ? "currentColor" : "url(#rLeafGrad)"}
          opacity="0.9"
        />

        {/* Emerald Curved Top Loop of "R" */}
        <path
          d="M36 22H54C68 22 74 30 74 40C74 50 66 56 52 56H36V44H52C58 44 60 42 60 39C60 35 57 33 50 33H36V22Z"
          fill={variant === "monochrome" ? "currentColor" : "url(#rEmeraldGrad)"}
        />

        {/* Golden Diagonal Forward Leg of "R" */}
        <path
          d="M48 54L76 84H62L38 56H48Z"
          fill={variant === "monochrome" ? "currentColor" : "url(#rGoldGrad)"}
        />

        {/* Golden Wheat Grains sprouting on the upper-right flank */}
        <ellipse
          cx="70"
          cy="36"
          rx="4"
          ry="8"
          transform="rotate(32 70 36)"
          fill={variant === "monochrome" ? "currentColor" : "url(#rGoldGrad)"}
        />
        <ellipse
          cx="78"
          cy="44"
          rx="3.5"
          ry="7.5"
          transform="rotate(35 78 44)"
          fill={variant === "monochrome" ? "currentColor" : "url(#rGoldGrad)"}
        />
        <ellipse
          cx="82"
          cy="54"
          rx="3"
          ry="6.5"
          transform="rotate(30 82 54)"
          fill={variant === "monochrome" ? "currentColor" : "url(#rGoldGrad)"}
        />
      </svg>

      {showText && (
        <div className="min-w-0">
          <div className="font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            RAJIB ENTERPRISE
          </div>
          {subtitle && (
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 tracking-wide uppercase truncate">
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
