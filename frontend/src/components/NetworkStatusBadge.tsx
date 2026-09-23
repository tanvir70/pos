import { useState, useEffect } from "react"
import { Wifi, WifiOff } from "lucide-react"

export default function NetworkStatusBadge() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true
  })
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined

    const handleOnline = () => {
      setIsOnline(true)
      setShowReconnected(true)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => {
        setShowReconnected(false)
      }, 4000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowReconnected(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [])

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="assertive"
        title="Network connection lost. Server requests will fail until reconnected."
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold shrink-0 animate-pulse shadow-xs"
      >
        <WifiOff className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span>Offline</span>
      </div>
    )
  }

  if (showReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        title="Connection restored"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shrink-0 transition-all duration-300 shadow-xs"
      >
        <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Back Online</span>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-label="Network connected"
      title="System online and connected"
      className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 shrink-0"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-100" />
      <span className="hidden sm:inline">Online</span>
    </div>
  )
}
