import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react"
import {
  AUTH_ROLE_KEY,
  getStoredToken,
  getStoredUser,
  setStoredAuth,
  clearStoredAuth,
  setActiveTokenOverride,
} from "../api/client"
import { login as apiLogin, verifyOwnerPin } from "../api/endpoints"
import { useToast } from "./ToastContext"
import Modal from "../components/ui/Modal"
import Button from "../components/ui/Button"
import TouchNumpad from "../components/ui/TouchNumpad"
import { Crown } from "lucide-react"

export type AppRole = "ROLE_CASHIER" | "ROLE_OWNER"

export interface AuthContextType {
  role: AppRole
  isOwner: boolean
  /** True when Owner Mode is a real logged-in Owner account (not a temporary PIN unlock). */
  isBaseOwner: boolean
  /** True when Owner Mode is currently active via a temporary Owner PIN unlock. */
  isElevated: boolean
  isAuthenticated: boolean
  token: string | null
  username: string | null
  fullName: string | null
  isLoading: boolean
  isLoggingIn: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
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

  // ─── Base logged-in account session (from the Login page) ──────────
  const [baseToken, setBaseToken] = useState<string | null>(null)
  const [baseRole, setBaseRole] = useState<AppRole>("ROLE_CASHIER")
  const [username, setUsername] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false)

  // ─── Temporary Owner PIN elevation (cashier peeking at owner data) ──
  const [elevatedToken, setElevatedToken] = useState<string | null>(null)
  const [elevatedActive, setElevatedActive] = useState<boolean>(false)

  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false)
  const [pinInput, setPinInput] = useState<string>("")
  const [pinError, setPinError] = useState<string | null>(null)
  const [isSubmittingPin, setIsSubmittingPin] = useState<boolean>(false)

  const inactivityTimerRef = useRef<number | null>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)

  const isAuthenticated = baseToken !== null
  const isOwner = elevatedActive || baseRole === "ROLE_OWNER"
  const role: AppRole = isOwner ? "ROLE_OWNER" : "ROLE_CASHIER"
  const token = elevatedActive && elevatedToken ? elevatedToken : baseToken

  // ─── Restore session from local storage on startup ──────────────────
  useEffect(() => {
    const existingToken = getStoredToken()
    if (existingToken) {
      const storedRole = (() => {
        try {
          return localStorage.getItem(AUTH_ROLE_KEY)
        } catch {
          return null
        }
      })()
      const { username: storedUsername, fullName: storedFullName } = getStoredUser()
      setBaseToken(existingToken)
      setBaseRole(storedRole === "ROLE_OWNER" ? "ROLE_OWNER" : "ROLE_CASHIER")
      setUsername(storedUsername)
      setFullName(storedFullName)
    }
    setIsLoading(false)
  }, [])

  // ─── Login ────────────────────────────────────────────────────────
  const login = useCallback(
    async (usernameInput: string, password: string): Promise<boolean> => {
      setIsLoggingIn(true)
      try {
        const res = await apiLogin({ username: usernameInput.trim(), password })
        const resolvedRole: AppRole = res.role === "ROLE_OWNER" ? "ROLE_OWNER" : "ROLE_CASHIER"
        setBaseToken(res.token)
        setBaseRole(resolvedRole)
        setUsername(res.username || usernameInput.trim())
        setFullName(res.fullName || null)
        setStoredAuth(res.token, resolvedRole, res.username, res.fullName)
        setActiveTokenOverride(null)
        showSuccess(`Welcome back${res.fullName ? `, ${res.fullName}` : ""}!`, "Signed In")
        return true
      } catch (err) {
        showError(err, "Sign In Failed")
        return false
      } finally {
        setIsLoggingIn(false)
      }
    },
    [showSuccess, showError],
  )

  // ─── Logout ───────────────────────────────────────────────────────
  const logout = useCallback(() => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
    clearStoredAuth()
    setActiveTokenOverride(null)
    setBaseToken(null)
    setBaseRole("ROLE_CASHIER")
    setUsername(null)
    setFullName(null)
    setElevatedToken(null)
    setElevatedActive(false)
    showInfo("You have been signed out.")
  }, [showInfo])

  // ─── Lock back to the base Cashier account (drop Owner PIN elevation) ─
  const lockToCashier = useCallback(() => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
    setActiveTokenOverride(null)
    setElevatedToken(null)
    setElevatedActive(false)
    showInfo("Cashier Mode active. Purchase cost and profit are now hidden.")
  }, [showInfo])

  // ─── Inactivity Auto-Lock for a temporary Owner PIN elevation ────────
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }

    if (elevatedActive) {
      inactivityTimerRef.current = window.setTimeout(() => {
        lockToCashier()
        showWarning("Owner Mode auto-locked after 5 minutes of inactivity.")
      }, OWNER_INACTIVITY_TIMEOUT_MS)
    }
  }, [elevatedActive, lockToCashier, showWarning])

  useEffect(() => {
    if (!elevatedActive) {
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
  }, [elevatedActive, resetInactivityTimer])

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

  // ─── PIN Verification (temporary Owner Mode elevation) ───────────────
  const unlockWithOwnerPin = useCallback(
    async (pinToVerify: string): Promise<boolean> => {
      const cleanPin = pinToVerify.trim()
      if (!cleanPin) {
        setPinError("Please enter the PIN code")
        return false
      }

      setIsSubmittingPin(true)
      setPinError(null)

      try {
        const response = await verifyOwnerPin({ pin: cleanPin })
        setActiveTokenOverride(response.token)
        setElevatedToken(response.token)
        setElevatedActive(true)
        setIsPinModalOpen(false)
        setPinInput("")
        showSuccess("Owner Mode unlocked successfully! Purchase cost and gross profit are now visible.")
        return true
      } catch (err) {
        setPinError("Incorrect PIN! Enter the correct 4-digit Owner PIN (default: 1234)")
        showError(err, "PIN Verification Failed")
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
        isBaseOwner: baseRole === "ROLE_OWNER",
        isElevated: elevatedActive,
        isAuthenticated,
        token,
        username,
        fullName,
        isLoading,
        isLoggingIn,
        login,
        logout,
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
        title={
          <span className="inline-flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-amber-600" /> Unlock Owner Mode
          </span>
        }
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Enter the 4-digit Owner Security PIN to view the actual purchase cost and daily net profit.
          </p>

          <form onSubmit={handleModalFormSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="owner-pin-input"
                className="block text-xs font-bold text-slate-900 mb-1.5"
              >
                Owner Security PIN (4 digits):
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
                className="w-full text-center tracking-[0.5em] text-2xl font-black py-2.5 px-3 border-2 border-slate-200 rounded-xl focus:border-emerald-600 focus:outline-hidden tabular-nums bg-slate-50/50 text-slate-900"
                disabled={isSubmittingPin}
              />
            </div>

            {pinError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-semibold animate-in fade-in">
                {pinError}
              </div>
            )}

            {/* Quick Touch Keypad for Touch Screen POS monitors */}
            <div className="pt-2 border-t border-slate-200/60">
              <div className="text-[11px] font-semibold text-slate-500 mb-2 text-center">
                Touchscreen Keypad
              </div>
              <TouchNumpad
                onDigit={handleNumpadPress}
                onClear={handleNumpadClear}
                onBackspace={handleNumpadBackspace}
                showDecimals={false}
                showDoubleZero={false}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/60">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={closePinModal}
                disabled={isSubmittingPin}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmittingPin}
                disabled={pinInput.trim().length === 0}
              >
                Unlock
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
