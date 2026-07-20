import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { BackendWarmup } from '@/components/BackendWarmup'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { ThemeProvider } from '@/components/ThemeProvider'

import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { Dashboard } from '@/pages/Dashboard'
import { Workflows } from '@/pages/Workflows'
import { Requests } from '@/pages/Requests'
import { Approvals } from '@/pages/Approvals'
import { AuditLogs } from '@/pages/AuditLogs'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="spinach-ui-theme">
        <BackendWarmup>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Guarded App Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              
              {/* Admin Only Route */}
              <Route
                path="workflows"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Workflows />
                  </ProtectedRoute>
                }
              />
              
              {/* Common Request Route */}
              <Route path="requests" element={<Requests />} />
              
              {/* Approver & Admin Route (Now open to everyone since Requesters can be assigned) */}
              <Route
                path="approvals"
                element={
                  <ProtectedRoute>
                    <Approvals />
                  </ProtectedRoute>
                }
              />
              
              {/* Admin Only Route */}
              <Route
                path="audit-logs"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AuditLogs />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Fallback Catch-all Route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </BackendWarmup>
      </ThemeProvider>
      
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            color: '#1C1917',
            border: '1px solid #E7E5E4',
            borderRadius: '2px', // Strict sharp corners
          },
        }}
      />
    </QueryClientProvider>
  )
}

export default App
