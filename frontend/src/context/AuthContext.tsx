import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react"
import {
  AUTH_TOKEN_KEY,
  AUTH_ROLE_KEY,
  getStoredToken,
  setStoredAuth,
  clearStoredAuth,
} from "../api/client"
import { createCashierSession, verifyOwnerPin } from "../api/endpoints"
import { useToast } from "./ToastContext"
import Modal from "../components/ui/Modal"
import Button from "../components/ui/Button"
import TouchNumpad from "../components/ui/TouchNumpad"

export type AppRole = "ROLE_CASHIER" | "ROLE_OWNER"

export interface AuthContextType {
  role: AppRole
  isOwner: boolean
  token: string | null
  isLoading: boolean
  isPinModalOpen: boolean
  openPinModal: () => void
  closePinModal: () => void
  unlockWithOwnerPin: (pin: string) => Promise<boolean>
  lockToCashier: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const OWNER_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { showSuccess, showError, showWarning, showInfo } = useToast()

  const [token, setToken] = useState<string | null>(getStoredToken())
  const [role, setRole] = useState<AppRole>(() => {
    try {
      const storedRole = localStorage.getItem(AUTH_ROLE_KEY)
      return storedRole === "ROLE_OWNER" ? "ROLE_OWNER" : "ROLE_CASHIER"
    } catch {
      return "ROLE_CASHIER"
    }
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false)
  const [pinInput, setPinInput] = useState<string>("")
  const [pinError, setPinError] = useState<string | null>(null)
  const [isSubmittingPin, setIsSubmittingPin] = useState<boolean>(false)

  const inactivityTimerRef = useRef<number | null>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)

  const isOwner = role === "ROLE_OWNER"

  // ─── Cashier Session Init ──────────────────────────────────────────
  const initCashierSession = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await createCashierSession()
      setToken(res.token)
      setRole("ROLE_CASHIER")
      setStoredAuth(res.token, "ROLE_CASHIER")
    } catch (err) {
      console.warn("Could not initiate cashier session with backend, running in offline/cached mode", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Auto-init on app startup if no token or expired
  useEffect(() => {
    const existingToken = getStoredToken()
    if (!existingToken) {
      initCashierSession()
    } else {
      setIsLoading(false)
    }
  }, [initCashierSession])

  // ─── Lock to Cashier ───────────────────────────────────────────────
  const lockToCashier = useCallback(async () => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }

    try {
      const res = await createCashierSession()
      setToken(res.token)
      setRole("ROLE_CASHIER")
      setStoredAuth(res.token, "ROLE_CASHIER")
    } catch {
      setRole("ROLE_CASHIER")
      localStorage.setItem(AUTH_ROLE_KEY, "ROLE_CASHIER")
    }

    showInfo("🔒 ক্যাশিয়ার মোড সক্রিয়। কেনা দাম ও লাভ লুকানো হয়েছে।")
  }, [showInfo])

  // ─── Inactivity Auto-Lock for Owner Mode ───────────────────────────
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }

    if (isOwner) {
      inactivityTimerRef.current = window.setTimeout(() => {
        lockToCashier()
        showWarning("⚠️ ৫ মিনিট কোনো কার্যকলাপ না থাকায় মালিক মোড স্বয়ংক্রিয়ভাবে লক করা হয়েছে।")
      }, OWNER_INACTIVITY_TIMEOUT_MS)
    }
  }, [isOwner, lockToCashier, showWarning])

  useEffect(() => {
    if (!isOwner) {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
      return
    }

    // Start timer immediately upon becoming owner
    resetInactivityTimer()

    const activityEvents = ["mousemove", "keydown", "click", "touchstart", "scroll"]
    const handleUserActivity = () => {
      resetInactivityTimer()
    }

    activityEvents.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }))

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleUserActivity))
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
    }
  }, [isOwner, resetInactivityTimer])

  // ─── Modal Controls ────────────────────────────────────────────────
  const openPinModal = useCallback(() => {
    setPinInput("")
    setPinError(null)
    setIsPinModalOpen(true)
  }, [])

  const closePinModal = useCallback(() => {
    setIsPinModalOpen(false)
    setPinInput("")
    setPinError(null)
    setIsSubmittingPin(false)
  }, [])

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isPinModalOpen) {
      setTimeout(() => pinInputRef.current?.focus(), 50)
    }
  }, [isPinModalOpen])

  // ─── PIN Verification (Owner Mode Escalation) ───────────────────────
  const unlockWithOwnerPin = useCallback(
    async (pinToVerify: string): Promise<boolean> => {
      const cleanPin = pinToVerify.trim()
      if (!cleanPin) {
        setPinError("পিন কোড লিখুন")
        return false
      }

      setIsSubmittingPin(true)
      setPinError(null)

      try {
        const response = await verifyOwnerPin({ pin: cleanPin })
        setToken(response.token)
        setRole("ROLE_OWNER")
        setStoredAuth(response.token, "ROLE_OWNER")
        setIsPinModalOpen(false)
        setPinInput("")
        showSuccess("👑 মালিক মোড সফলভাবে আনলক করা হয়েছে! কেনা দাম ও মোট লাভ দৃশ্যমান।")
        return true
      } catch (err) {
        setPinError("ভুল পিন কোড! সঠিক ৪ ডিজিটের মালিক পিন লিখুন (ডিফল্ট: 1234)")
        showError(err, "পিন যাচাইকরণ ব্যর্থ")
        setPinInput("")
        pinInputRef.current?.focus()
        return false
      } finally {
        setIsSubmittingPin(false)
      }
    },
    [showSuccess, showError],
  )

  const handleModalFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    unlockWithOwnerPin(pinInput)
  }

  const handleNumpadPress = (digit: string) => {
    if (pinInput.length < 8) {
      setPinInput((prev) => prev + digit)
      if (pinError) setPinError(null)
    }
  }

  const handleNumpadClear = () => {
    setPinInput("")
    if (pinError) setPinError(null)
  }

  const handleNumpadBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1))
    if (pinError) setPinError(null)
  }

  return (
    <AuthContext.Provider
      value={{
        role,
        isOwner,
        token,
        isLoading,
        isPinModalOpen,
        openPinModal,
        closePinModal,
        unlockWithOwnerPin,
        lockToCashier,
      }}
    >
      {children}

      {/* Global 4-Digit Owner PIN Modal with Touch Numpad */}
      <Modal
        isOpen={isPinModalOpen}
        onClose={closePinModal}
        title="👑 মালিক মোড আনলক করুন (Owner Mode)"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-frost-muted bn-text leading-relaxed">
            পণ্য ক্রয়ের আসল খরচ (কেনা দাম) এবং দৈনিক নিট মুনাফা দেখতে ৪ ডিজিটের মালিক সিকিউরিটি পিন দিন।
          </p>

          <form onSubmit={handleModalFormSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="owner-pin-input"
                className="block text-xs font-bold text-frost-dark bn-text mb-1.5"
              >
                মালিক সিকিউরিটি পিন (৪ ডিজিট):
              </label>
              <input
                id="owner-pin-input"
                ref={pinInputRef}
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value)
                  if (pinError) setPinError(null)
                }}
                placeholder="••••"
                className="w-full text-center tracking-[0.5em] text-2xl font-black py-2.5 px-3 border-2 border-frost-border rounded-xl focus:border-emerald-600 focus:outline-hidden tabular-nums bg-frost-surface/50 text-frost-dark"
                disabled={isSubmittingPin}
              />
            </div>

            {pinError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-semibold bn-text animate-in fade-in">
                {pinError}
              </div>
            )}

            {/* Quick Touch Keypad for Touch Screen POS monitors */}
            <div className="pt-2 border-t border-frost-border/60">
              <div className="text-[11px] font-semibold text-frost-muted bn-text mb-2 text-center">
                টাচস্ক্রিন পিনপ্যাড
              </div>
              <TouchNumpad
                onDigit={handleNumpadPress}
                onClear={handleNumpadClear}
                onBackspace={handleNumpadBackspace}
                showDecimals={false}
                showDoubleZero={false}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-frost-border/60">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={closePinModal}
                disabled={isSubmittingPin}
              >
                বাতিল
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmittingPin}
                disabled={pinInput.trim().length === 0}
              >
                আনলক করুন
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
