import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  onAuthStateChange,
  signup as signupRequest,
} from '../services/auth.js'


const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}

    try {
      unsubscribe = onAuthStateChange((currentUser) => {
        if (active) {
          setUser(currentUser)
          setLoading(false)
        }
      })
    } catch {
      setLoading(false)
    }

    getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    async login(credentials) {
      const authenticatedUser = await loginRequest(credentials)
      setUser(authenticatedUser)
      return authenticatedUser
    },
    async signup(account) {
      const result = await signupRequest(account)
      if (!result.requiresEmailConfirmation) setUser(result.user)
      return result
    },
    async logout() {
      await logoutRequest()
      setUser(null)
    },
  }), [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
