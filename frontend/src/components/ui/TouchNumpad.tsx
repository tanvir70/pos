import { Delete } from "lucide-react"
import { Button } from "./Button"

export interface TouchNumpadProps {
  onDigit: (digit: string) => void
  onBackspace: () => void
  onClear: () => void
  onQuickCash?: (amount: number) => void
  quickCashOptions?: number[]
  exactPayable?: number
  className?: string
  showDecimals?: boolean
  showDoubleZero?: boolean
}

export function TouchNumpad({
  onDigit,
  onBackspace,
  onClear,
  onQuickCash,
  quickCashOptions = [100, 500, 1000],
  exactPayable,
  className = "",
  showDecimals = true,
  showDoubleZero = true,
}: TouchNumpadProps) {
  const digits = [
    "7",
    "8",
    "9",
    "4",
    "5",
    "6",
    "1",
    "2",
    "3",
    "0",
    ...(showDoubleZero ? ["00"] : []),
    ...(showDecimals ? ["."] : []),
  ]

  return (
    <div className={`flex flex-col gap-2.5 ${className}`.trim()}>
      {/* Quick Cash Chips Bar (Optional) */}
      {onQuickCash && (
        <div className="grid grid-cols-4 gap-1.5 mb-1">
          {exactPayable !== undefined && exactPayable > 0 && (
            <button
              type="button"
              onClick={() => onQuickCash(exactPayable)}
              className="py-2 px-1 rounded-xl bg-emerald-100/90 hover:bg-emerald-200 active:bg-emerald-300 text-emerald-900 font-black text-xs border border-emerald-300 shadow-xs cursor-pointer transition-colors text-center"
              title="Pay exact amount"
            >
              Exact
            </button>
          )}

          {quickCashOptions.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => onQuickCash(amt)}
              className="py-2 px-1 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-900 font-mono font-bold text-xs tabular-nums border border-slate-200 shadow-xs cursor-pointer transition-colors text-center"
            >
              +{amt}
            </button>
          ))}
        </div>
      )}

      {/* Main Numeric Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {digits.map((d) => (
          <Button
            key={d}
            variant="numpad"
            size="lg"
            onClick={() => onDigit(d)}
            className="text-xl py-3"
          >
            {d}
          </Button>
        ))}
      </div>

      {/* Action Keys (Clear & Backspace) */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={onClear}
          className="text-red-700 bg-red-50 hover:bg-red-100 border-red-200 font-bold"
        >
          <span>Clear</span>
        </Button>

        <Button
          variant="secondary"
          size="md"
          onClick={onBackspace}
          className="font-bold font-mono text-base"
        >
          <Delete className="w-4 h-4" />
          <span>Backspace</span>
        </Button>
      </div>
    </div>
  )
}

export default TouchNumpad
