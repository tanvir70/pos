import React from "react"
import logoImg from "../../assets/logo.png"

export interface BrandLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | number
  variant?: "image" | "emblem" | "monochrome"
  className?: string
  showText?: boolean
  subtitle?: string
}

const SIZE_MAP: Record<
  string,
  { box: string; rounded: string; shadow: string; px: number }
> = {
  xs: { box: "w-6 h-6", rounded: "rounded-md", shadow: "shadow-2xs", px: 24 },
  sm: { box: "w-8 h-8", rounded: "rounded-lg", shadow: "shadow-xs", px: 32 },
  md: {
    box: "w-9 h-9",
    rounded: "rounded-xl",
    shadow: "shadow-md shadow-emerald-950/30 ring-1 ring-amber-400/30",
    px: 36,
  },
  lg: {
    box: "w-12 h-12",
    rounded: "rounded-2xl",
    shadow: "shadow-lg shadow-emerald-950/40 ring-1 ring-amber-400/35",
    px: 48,
  },
  xl: {
    box: "w-14 h-14",
    rounded: "rounded-2xl",
    shadow: "shadow-lg shadow-emerald-950/50 ring-1 ring-amber-400/40",
    px: 56,
  },
  "2xl": {
    box: "w-20 h-20",
    rounded: "rounded-3xl",
    shadow: "shadow-xl shadow-emerald-950/60 ring-2 ring-amber-400/40",
    px: 80,
  },
}

/**
 * Messers Rajib Enterprise — Uplifted Brand Identity (Option 2: Emerald & Harvest Gold)
 * Botanical Two-Leaf Sprouting Cotyledon:
 * - Living Emerald Crop Foliage: Syngenta crop protection & botanical health.
 * - Golden Harvest Wheat Grain: Farmer yield, prosperity & authorized dealership prestige.
 * - Deep Moss Emerald Gradient Badge with warm golden ambient rim.
 */
export default function BrandLogo({
  size = "md",
  variant = "image",
  className = "",
  showText = false,
  subtitle = "Authorized Syngenta Dealer",
}: BrandLogoProps) {
  const sizeConfig =
    typeof size === "number"
      ? {
          box: "",
          rounded: "rounded-xl",
          shadow: "shadow-md ring-1 ring-amber-400/30",
          px: size,
        }
      : SIZE_MAP[size] || SIZE_MAP.md

  const dimensionStyle =
    typeof size === "number"
      ? { width: `${size}px`, height: `${size}px` }
      : undefined

  // 1. High-Resolution Emblem Image Variant (Default — Pixel-perfect anti-aliased Chrome render)
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

  // 2. Pure Scalable Vector Emblem Badge (Emerald Crop Foliage + Golden Harvest Wheat Ear)
  if (variant === "emblem") {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        <div
          style={dimensionStyle}
          className={`${sizeConfig.box} ${sizeConfig.rounded} shrink-0 bg-gradient-to-br from-[#10b981] via-[#059669] to-[#047857] border border-amber-300/45 text-white flex items-center justify-center ${sizeConfig.shadow} transition-transform select-none p-1`}
        >
          <svg
            viewBox="0 0 40 40"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Messers Rajib Enterprise Brand Emblem"
          >
            <defs>
              <linearGradient id="opt2GoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="40%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <linearGradient id="opt2EmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d1fae5" />
                <stop offset="50%" stopColor="#6ee7b7" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
              <filter id="opt2DropShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1.8" stdDeviation="1.6" floodColor="#000000" floodOpacity="0.42" />
              </filter>
            </defs>

            <g filter="url(#opt2DropShadow)">
              {/* Soil / Root base contour */}
              <path d="M10 32.5 Q20 35 30 32.5" stroke="#6ee7b7" strokeWidth="2.6" strokeLinecap="round" />

              {/* Central upward growing stem */}
              <path d="M19 32.5 C19 25 21 18.5 23 10.5" stroke="#a7f3d0" strokeWidth="2.6" strokeLinecap="round" />

              {/* Left Living Emerald Crop Foliage */}
              <path d="M20 22 C10.5 22 8.5 14 13.5 9.5 C18.5 10.5 21 16 20 22 Z" fill="url(#opt2EmeraldGrad)" />
              <path d="M14 14 Q16.5 16 19 19" stroke="#059669" strokeWidth="1.2" strokeLinecap="round" />

              {/* Right Golden Harvest Wheat Ear / Seedling Leaf */}
              <path d="M22 16 C30.5 15 34.5 8 29.5 4 C23.5 5 21 11 22 16 Z" fill="url(#opt2GoldGrad)" />
              <ellipse cx="27" cy="7.5" rx="1.3" ry="2.6" transform="rotate(22 27 7.5)" fill="#ffffff" opacity="0.95" />
            </g>
          </svg>
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

  // 3. Monochrome Variant (Current Color Text)
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        style={dimensionStyle}
        className={`${sizeConfig.box} shrink-0 flex items-center justify-center text-current select-none`}
      >
        <svg viewBox="0 0 40 40" className="w-full h-full" fill="none" stroke="currentColor">
          <path d="M10 32.5 Q20 35 30 32.5" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M19 32.5 C19 25 21 18.5 23 10.5" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M20 22 C10.5 22 8.5 14 13.5 9.5 C18.5 10.5 21 16 20 22 Z" fill="currentColor" />
          <path d="M22 16 C30.5 15 34.5 8 29.5 4 C23.5 5 21 11 22 16 Z" fill="currentColor" />
        </svg>
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
