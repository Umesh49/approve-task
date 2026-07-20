import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: ('admin' | 'approver' | 'requester')[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading, checkAuth } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    if (isAuthenticated && !user && !isLoading) {
      checkAuth()
    }
  }, [isAuthenticated, user, isLoading, checkAuth])

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
        <span className="mt-2 text-xs font-medium text-muted-foreground">Checking credentials...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
