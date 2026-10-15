import React, { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

const KEY = 'room_token'
const INFO = 'room_user'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(KEY))
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(INFO) ?? 'null') } catch { return null }
  })

  const login = useCallback((token, userData) => {
    localStorage.setItem(KEY, token)
    localStorage.setItem(INFO, JSON.stringify(userData))
    setToken(token)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(KEY)
    localStorage.removeItem(INFO)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuth: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve estar dentro de AuthProvider')
  return ctx
}
