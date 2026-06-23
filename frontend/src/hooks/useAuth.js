import { useState, useCallback } from 'react'

const API_URL   = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TOKEN_KEY = 'biblioflow_admin_token'

export function useAuth() {
  const [token,   setToken]   = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const isAdmin = !!token

  const login = useCallback(async (username, password) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        setError('Identifiants incorrects')
        return false
      }
      const data = await res.json()
      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
      return true
    } catch {
      setError('Erreur de connexion au serveur')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
  }, [])

  const authFetch = useCallback((url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    })
  }, [token])

  return { token, isAdmin, loading, error, login, logout, authFetch }
}
