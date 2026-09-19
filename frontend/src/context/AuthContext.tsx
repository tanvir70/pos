import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import {
  getStoredToken,
  getStoredUser,
  setStoredAuth,
  clearStoredAuth,
} from "../api/client"
import { login as apiLogin } from "../api/endpoints"
import { useToast } from "./ToastContext"

export type AppRole = "ROLE_OWNER"

export interface AuthContextType {
  role: AppRole
  isAuthenticated: boolean
  token: string | null
  username: string | null
  fullName: string | null
  isLoading: boolean
  isLoggingIn: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { showSuccess, showError, showInfo } = useToast()
  const [token, setToken] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false)

  useEffect(() => {
    const existingToken = getStoredToken()
    if (existingToken) {
      const { username: storedUsername, fullName: storedFullName } = getStoredUser()
      setToken(existingToken)
      setUsername(storedUsername)
      setFullName(storedFullName)
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(
    async (usernameInput: string, password: string): Promise<boolean> => {
      setIsLoggingIn(true)
      try {
        const res = await apiLogin({ username: usernameInput.trim(), password })
        setToken(res.token)
        setUsername(res.username || usernameInput.trim())
        setFullName(res.fullName || null)
        setStoredAuth(res.token, "ROLE_OWNER", res.username, res.fullName)
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

  const logout = useCallback(() => {
    clearStoredAuth()
    setToken(null)
    setUsername(null)
    setFullName(null)
    showInfo("You have been signed out.")
  }, [showInfo])

  return (
    <AuthContext.Provider
      value={{
        role: "ROLE_OWNER",
        isAuthenticated: token !== null,
        token,
        username,
        fullName,
        isLoading,
        isLoggingIn,
        login,
        logout,
      }}
    >
      {children}
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
