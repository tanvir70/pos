import { useState, useEffect } from "react"
import {
  Settings as SettingsIcon,
  Percent,
  Save,
  RotateCcw,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react"
import {
  getWholesaleSettings,
  saveWholesaleSettings,
  DEFAULT_WHOLESALE_SETTINGS,
  type WholesaleSettings,
} from "../utils/wholesaleSettings"
import { downloadDatabaseBackup, changeOwnerPin } from "../api/endpoints"
import { roundAccounting } from "../utils/currency"
import { useToast } from "../context/ToastContext"
import { useAuth } from "../context/AuthContext"
import Button from "../components/ui/Button"

export interface SettingsPageProps {
  isOwner?: boolean
}

export default function SettingsPage({ isOwner: propIsOwner }: SettingsPageProps) {
  const auth = useAuth()
  const { showSuccess, showError, showWarning } = useToast()
  const isOwner = propIsOwner !== undefined ? propIsOwner : auth.isOwner

  const [settings, setSettings] = useState<WholesaleSettings>(getWholesaleSettings)
  const [ratioInput, setRatioInput] = useState<string>(() =>
    String(getWholesaleSettings().discountPercentage),
  )
  const [isSaving, setIsSaving] = useState(false)

  // Change PIN state
  const [currentPin, setCurrentPin] = useState("")
  const [newPin, setNewPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [showPins, setShowPins] = useState(false)
  const [isChangingPin, setIsChangingPin] = useState(false)
  const [pinChangeError, setPinChangeError] = useState<string | null>(null)

  // Backup state
  const [isBackupLoading, setIsBackupLoading] = useState(false)
  const [backupStatus, setBackupStatus] = useState<"idle" | "success" | "error">("idle")

  useEffect(() => {
    const handleSettingsUpdated = (e: Event) => {
      const custom = e as CustomEvent<WholesaleSettings>
      if (custom.detail) {
        setSettings(custom.detail)
        setRatioInput(String(custom.detail.discountPercentage))
      }
    }
    window.addEventListener("wholesale-settings-updated", handleSettingsUpdated)
    return () => window.removeEventListener("wholesale-settings-updated", handleSettingsUpdated)
  }, [])

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!isOwner) {
      showWarning("Owner authorization required. Please enter Owner PIN.")
      auth.openPinModal()
      return
    }

    const ratio = parseFloat(ratioInput)
    if (isNaN(ratio) || ratio < 0 || ratio > 100) {
      showWarning("Please enter a valid wholesale ratio between 0% and 100%!")
      return
    }

    try {
      setIsSaving(true)
      const updated = saveWholesaleSettings({
        discountPercentage: roundAccounting(ratio),
        enabled: true,
      })
      setSettings(updated)
      showSuccess(`Wholesale ratio set to ${updated.discountPercentage}%!`)
    } catch (err) {
      showError(err, "Failed to save wholesale settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetToDefault = () => {
    if (!isOwner) {
      showWarning("Owner authorization required. Please enter Owner PIN.")
      auth.openPinModal()
      return
    }
    setRatioInput(String(DEFAULT_WHOLESALE_SETTINGS.discountPercentage))
    const updated = saveWholesaleSettings({
      discountPercentage: DEFAULT_WHOLESALE_SETTINGS.discountPercentage,
      enabled: true,
    })
    setSettings(updated)
    showSuccess("Reset wholesale ratio to 5% default.")
  }

  const handleChangePin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setPinChangeError(null)

    if (!isOwner) {
      showWarning("Owner authorization required. Please enter Owner PIN.")
      auth.openPinModal()
      return
    }

    const currentTrimmed = currentPin.trim()
    const newTrimmed = newPin.trim()
    const confirmTrimmed = confirmPin.trim()

    if (!currentTrimmed) {
      setPinChangeError("Please enter your current PIN.")
      return
    }

    if (!newTrimmed) {
      setPinChangeError("Please enter your new PIN.")
      return
    }

    if (!/^\d{4,8}$/.test(newTrimmed)) {
      setPinChangeError("New PIN must be between 4 and 8 numeric digits.")
      return
    }

    if (newTrimmed !== confirmTrimmed) {
      setPinChangeError("New PIN and confirmation PIN do not match.")
      return
    }

    if (currentTrimmed === newTrimmed) {
      setPinChangeError("New PIN cannot be the exact same as your current PIN.")
      return
    }

    try {
      setIsChangingPin(true)
      const res = await changeOwnerPin({
        currentPin: currentTrimmed,
        newPin: newTrimmed,
      })
      showSuccess(res.message || "Owner Security PIN updated successfully!", "PIN Updated")
      setCurrentPin("")
      setNewPin("")
      setConfirmPin("")
      setPinChangeError(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change PIN. Ensure current PIN is correct."
      setPinChangeError(msg)
      showError(err, "PIN Change Failed")
    } finally {
      setIsChangingPin(false)
    }
  }

  const handleBackup = async () => {
    if (isBackupLoading) return
    try {
      setIsBackupLoading(true)
      setBackupStatus("idle")
      await downloadDatabaseBackup()
      setBackupStatus("success")
      showSuccess("Database backup downloaded successfully!")
      setTimeout(() => setBackupStatus("idle"), 3000)
    } catch (err) {
      setBackupStatus("error")
      showError(err, "Backup download failed")
      setTimeout(() => setBackupStatus("idle"), 4000)
    } finally {
      setIsBackupLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Settings</h1>
            <p className="text-xs text-slate-500">Store and wholesale configuration</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] text-slate-500 block">Active Wholesale Ratio</span>
          <span className="text-lg font-black font-mono text-purple-700">
            {settings.discountPercentage}% Off
          </span>
        </div>
      </div>

      {/* Wholesale Ratio Setting Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Percent className="w-4 h-4 text-purple-700" />
          <span>Wholesale Price Ratio</span>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="ratioInput" className="block text-xs text-slate-600 font-medium mb-1.5">
              Wholesale Discount Ratio from Retail Price (%)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="ratioInput"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={ratioInput}
                  onChange={(e) => setRatioInput(e.target.value)}
                  placeholder="5"
                  className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-xl font-mono font-bold text-base text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-600"
                />
                <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-sm">%</span>
              </div>
              <Button
                type="submit"
                variant="primary"
                loading={isSaving}
                leftIcon={<Save className="w-4 h-4" />}
                className="bg-purple-700 hover:bg-purple-800 shrink-0"
              >
                Save Ratio
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleResetToDefault}
                leftIcon={<RotateCcw className="w-4 h-4" />}
                className="shrink-0"
                title="Reset to 5% default"
              >
                Reset (5%)
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              When counter staff clicks Wholesale on an order, this ratio is deducted from the retail price.
            </p>
          </div>
        </form>
      </div>

      {/* Change Owner Security PIN Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <KeyRound className="w-4 h-4 text-emerald-700" />
            <span>Owner Security PIN</span>
          </div>
          <button
            type="button"
            onClick={() => setShowPins(!showPins)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            {showPins ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showPins ? "Hide PINs" : "Show PINs"}</span>
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Change the security PIN used to unlock Owner Mode from Cashier Mode. Must be 4 to 8 numeric digits.
        </p>

        <form onSubmit={handleChangePin} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="currentPin" className="block text-xs text-slate-600 font-medium mb-1">
                Current PIN
              </label>
              <input
                id="currentPin"
                type={showPins ? "text" : "password"}
                maxLength={8}
                value={currentPin}
                onChange={(e) => {
                  setCurrentPin(e.target.value)
                  if (pinChangeError) setPinChangeError(null)
                }}
                placeholder="Current PIN"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label htmlFor="newPin" className="block text-xs text-slate-600 font-medium mb-1">
                New PIN (4-8 digits)
              </label>
              <input
                id="newPin"
                type={showPins ? "text" : "password"}
                maxLength={8}
                value={newPin}
                onChange={(e) => {
                  setNewPin(e.target.value)
                  if (pinChangeError) setPinChangeError(null)
                }}
                placeholder="New PIN"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label htmlFor="confirmPin" className="block text-xs text-slate-600 font-medium mb-1">
                Confirm New PIN
              </label>
              <input
                id="confirmPin"
                type={showPins ? "text" : "password"}
                maxLength={8}
                value={confirmPin}
                onChange={(e) => {
                  setConfirmPin(e.target.value)
                  if (pinChangeError) setPinChangeError(null)
                }}
                placeholder="Confirm PIN"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {pinChangeError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-semibold">
              {pinChangeError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              type="submit"
              variant="primary"
              loading={isChangingPin}
              disabled={!currentPin || !newPin || !confirmPin}
              leftIcon={<KeyRound className="w-4 h-4" />}
              className="bg-emerald-700 hover:bg-emerald-800 shrink-0"
            >
              Update PIN
            </Button>
          </div>
        </form>
      </div>

      {/* Database Backup Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Database Backup</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Download complete 1-click SQL backup of store inventory and orders.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleBackup}
          disabled={isBackupLoading}
          leftIcon={
            isBackupLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : backupStatus === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : backupStatus === "error" ? (
              <XCircle className="w-4 h-4 text-red-600" />
            ) : (
              <Download className="w-4 h-4" />
            )
          }
        >
          {isBackupLoading ? "Downloading..." : "Download Backup"}
        </Button>
      </div>
    </div>
  )
}
