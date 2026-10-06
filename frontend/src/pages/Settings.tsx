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
  Lock,
  KeyRound,
  Sun,
  Moon,
  Laptop,
} from "lucide-react"
import {
  getWholesaleSettings,
  saveWholesaleSettings,
  DEFAULT_WHOLESALE_SETTINGS,
  type WholesaleSettings,
} from "../utils/wholesaleSettings"
import { downloadDatabaseBackup, changePassword } from "../api/endpoints"
import { roundAccounting } from "../utils/currency"
import { useToast } from "../context/ToastContext"
import { useTheme, type Theme } from "../context/ThemeContext"
import Button from "../components/ui/Button"
import Input from "../components/ui/Input"

export default function SettingsPage() {
  const { showSuccess, showError, showWarning } = useToast()
  const { theme, setTheme } = useTheme()

  const [settings, setSettings] = useState<WholesaleSettings>(getWholesaleSettings)
  const [ratioInput, setRatioInput] = useState<string>(() =>
    String(getWholesaleSettings().discountPercentage),
  )
  const [isSaving, setIsSaving] = useState(false)

  // Backup state
  const [isBackupLoading, setIsBackupLoading] = useState(false)
  const [backupStatus, setBackupStatus] = useState<"idle" | "success" | "error">("idle")

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)

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
      showSuccess(
        `Default wholesale discount configured to ${updated.discountPercentage}%. Applied immediately across active POS sessions.`,
        "Wholesale Policy Saved",
      )
    } catch (err) {
      showError(err, "Failed to save wholesale settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetToDefault = () => {
    setRatioInput(String(DEFAULT_WHOLESALE_SETTINGS.discountPercentage))
    const updated = saveWholesaleSettings({
      discountPercentage: DEFAULT_WHOLESALE_SETTINGS.discountPercentage,
      enabled: true,
    })
    setSettings(updated)
    showSuccess(
      `Wholesale discount restored to system default (${DEFAULT_WHOLESALE_SETTINGS.discountPercentage}%).`,
      "Wholesale Policy Reset",
    )
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      showWarning("Please enter your current password.")
      return
    }
    if (newPassword.length < 6) {
      showWarning("New password must be at least 6 characters long.")
      return
    }
    if (newPassword !== confirmPassword) {
      showWarning("New password and confirmation do not match.")
      return
    }

    try {
      setIsChangingPassword(true)
      await changePassword({ currentPassword, newPassword })
      showSuccess("Password changed successfully! Keep your new credentials safe.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      showError(err, "Failed to update password")
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <span>System & Store Settings</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Store configuration, wholesale discount ratios, and counter business preferences
          </p>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-[11px] font-semibold text-slate-400 block">Active Wholesale Discount</span>
          <span className="text-base font-bold font-mono text-purple-700 dark:text-purple-400">
            {settings.discountPercentage}% Off
          </span>
        </div>
      </div>

      {/* 1. Appearance & Theme Selection Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Display Theme & Appearance</span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 capitalize">
            {theme} mode
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Choose a visual theme designed for prolonged counter checkouts and glare reduction.
        </p>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              theme === "light"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-xs ring-1 ring-emerald-400"
                : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              theme === "dark"
                ? "bg-slate-900 dark:bg-slate-800 text-white border-slate-700 shadow-xs ring-1 ring-slate-600"
                : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Moon className="w-4 h-4 text-indigo-400" />
            <span>Dark</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme("system")}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              theme === "system"
                ? "bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700 shadow-xs ring-1 ring-teal-400"
                : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Laptop className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>System</span>
          </button>
        </div>
      </div>

      {/* 2. Wholesale Ratio Setting Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
          <Percent className="w-4 h-4 text-purple-700 dark:text-purple-400" />
          <span>Wholesale Price Ratio</span>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="ratioInput" className="block text-xs text-slate-600 dark:text-slate-400 font-medium mb-1.5">
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
                  className="w-full pl-3 pr-8 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-xl font-mono font-bold text-base text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-purple-600"
                />
                <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-sm">%</span>
              </div>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSaving}
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
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              When counter staff clicks Wholesale on an order, this ratio is deducted from the retail price.
            </p>
          </div>
        </form>
      </div>

      {/* 3. Database Backup Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Database Backup</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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

      {/* 4. Account Security & Password Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Account Security</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Change your password for secure access to the POS terminal and inventory.
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            leftAdornment={<KeyRound className="w-4 h-4" />}
            disabled={isChangingPassword}
            inputSize="md"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              leftAdornment={<Lock className="w-4 h-4" />}
              disabled={isChangingPassword}
              inputSize="md"
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              leftAdornment={<Lock className="w-4 h-4" />}
              disabled={isChangingPassword}
              inputSize="md"
            />
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-rose-600 font-medium">New password and confirmation do not match.</p>
          )}
          {newPassword && newPassword.length > 0 && newPassword.length < 6 && (
            <p className="text-xs text-amber-600 font-medium">New password must be at least 6 characters.</p>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={!currentPassword || newPassword.length < 6 || newPassword !== confirmPassword || isChangingPassword}
            isLoading={isChangingPassword}
            leftIcon={<Save className="w-4 h-4" />}
            className="font-bold cursor-pointer disabled:opacity-50"
          >
            Update Password
          </Button>
        </form>
      </div>
    </div>
  )
}
