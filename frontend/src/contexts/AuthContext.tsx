import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { api, setTokens, clearTokens } from "../services/api"

interface User {
  id: string
  name: string
  email: string
  avatar: string | null
  provider: string
  cvFileName?: string
  cvUpdatedAt?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  loginWithGoogle: (credential: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  loginWithGoogle: async () => {},
  logout: () => {},
})

export const useAuth = () => useContext(AuthContext)

interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      const accessToken = localStorage.getItem("accessToken")
      if (!accessToken) {
        setIsLoading(false)
        return
      }

      const data = await api<{ user: User }>("/api/auth/me")
      setUser(data.user)
    } catch {
      clearTokens()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const login = async (email: string, password: string) => {
    const data = await api<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    })
    setTokens(data.accessToken, data.refreshToken)
    setUser(data.user)
  }

  const register = async (name: string, email: string, password: string) => {
    const data = await api<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: { name, email, password },
    })
    setTokens(data.accessToken, data.refreshToken)
    setUser(data.user)
  }

  const loginWithGoogle = async (credential: string) => {
    const data = await api<AuthResponse>("/api/auth/google", {
      method: "POST",
      body: { credential },
    })
    setTokens(data.accessToken, data.refreshToken)
    setUser(data.user)
  }

  const logout = () => {
    clearTokens()
    setUser(null)
  }

  return (
    <AuthContext value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      loginWithGoogle,
      logout,
    }}>
      {children}
    </AuthContext>
  )
}
