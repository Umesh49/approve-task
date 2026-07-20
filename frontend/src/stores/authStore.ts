import { create } from 'zustand'
import { api } from '@/services/api'

export interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'approver' | 'requester'
  first_name?: string
  last_name?: string
}

interface RegisterData {
  username: string
  email: string
  password: string
  password_confirm: string
  role: 'admin' | 'approver' | 'requester'
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.post('/api/auth/login/', { email, password })
      const { access, refresh, user } = response.data
      
      localStorage.setItem('accessToken', access)
      localStorage.setItem('refreshToken', refresh)
      
      set({
        user: user || null,
        accessToken: access,
        refreshToken: refresh,
        isAuthenticated: true,
        isLoading: false,
      })

      if (!user) {
        const meResponse = await api.get('/api/auth/me/')
        set({ user: meResponse.data })
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Invalid email or password'
      set({ error: errorMsg, isLoading: false, isAuthenticated: false })
      throw err
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.post('/api/auth/register/', data)
      const { access, refresh, user } = response.data
      
      localStorage.setItem('accessToken', access)
      localStorage.setItem('refreshToken', refresh)
      
      set({
        user: user || null,
        accessToken: access,
        refreshToken: refresh,
        isAuthenticated: true,
        isLoading: false,
      })

      if (!user) {
        const meResponse = await api.get('/api/auth/me/')
        set({ user: meResponse.data })
      }
    } catch (err: any) {
      let errorMsg = 'Registration failed'
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMsg = err.response.data
        } else if (err.response.data.detail) {
          errorMsg = err.response.data.detail
        } else {
          const values = Object.values(err.response.data)
          if (values.length > 0 && Array.isArray(values[0]) && values[0].length > 0) {
            errorMsg = String(values[0][0])
          }
        }
      }
      set({ error: errorMsg, isLoading: false })
      throw err
    }
  },

  logout: () => {
    const refresh = localStorage.getItem('refreshToken')
    if (refresh) {
      api.post('/api/auth/logout/', { refresh }).catch(() => {})
    }
    
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    })
  },

  checkAuth: async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false })
      return
    }

    set({ isLoading: true })
    try {
      const response = await api.get('/api/auth/me/')
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch {
      const refresh = localStorage.getItem('refreshToken')
      if (refresh) {
        try {
          const refreshResponse = await api.post('/api/auth/refresh/', { refresh })
          const newAccess = refreshResponse.data.access
          localStorage.setItem('accessToken', newAccess)
          
          const response = await api.get('/api/auth/me/')
          set({
            user: response.data,
            accessToken: newAccess,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          })
        }
      } else {
        localStorage.removeItem('accessToken')
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        })
      }
    }
  },

  clearError: () => set({ error: null }),
}))
