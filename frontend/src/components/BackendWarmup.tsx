import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, ServerCrash, CheckCircle2 } from 'lucide-react'
import { api } from '@/services/api'
import { useAppStore } from '@/stores/appStore'

export function BackendWarmup({ children }: { children: React.ReactNode }) {
  const { backendReady, setBackendReady } = useAppStore()
  const [isReady, setIsReady] = useState(backendReady)
  const [attempts, setAttempts] = useState(0)
  const [showSplash, setShowSplash] = useState(false)
  const [errorState, setErrorState] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (backendReady) {
      setIsReady(true)
      return
    }

    const splashTimer = setTimeout(() => {
      setShowSplash(true)
    }, 2000)

    let intervalId: any

    const checkHealth = async () => {
      try {
        await api.get('/api/health/', { timeout: 4000 })
        setBackendReady(true)
        setIsReady(true)
        clearTimeout(splashTimer)
        clearInterval(intervalId)
      } catch {
        setAttempts((prev) => {
          const next = prev + 1
          if (next >= 20) {
            setErrorState(true)
            clearInterval(intervalId)
          }
          return next
        })
      }
    }

    checkHealth()

    intervalId = setInterval(checkHealth, 3000)

    return () => {
      clearTimeout(splashTimer)
      clearInterval(intervalId)
    }
  }, [backendReady, setBackendReady])

  useEffect(() => {
    if (!showSplash || isReady || errorState) return

    const startTime = Date.now()
    const duration = 30000 // 30 seconds

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const calculatedProgress = Math.min((elapsed / duration) * 100, 95) // Cap at 95% until ready
      setProgress(calculatedProgress)
    }, 100)

    return () => clearInterval(progressInterval)
  }, [showSplash, isReady, errorState])

  const handleRetry = () => {
    setErrorState(false)
    setAttempts(0)
    setProgress(0)
    window.location.reload()
  }

  if (isReady) {
    return <>{children}</>
  }

  return (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-6 text-foreground"
        >
          <div className="w-full max-w-md border border-border bg-card p-8 shadow-sm rounded-md">
            {errorState ? (
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="flex h-16 w-16 items-center justify-center bg-[#FEF2F2] text-[#DC2626] border border-border rounded-md">
                  <ServerCrash className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold tracking-tight">Server Unreachable</h2>
                  <p className="text-sm text-muted-foreground">
                    We tried waking up the backend server after {attempts} attempts, but it did not respond. Please try again.
                  </p>
                </div>
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center justify-center space-x-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 border border-ring rounded-md transition-colors w-full"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Retry Connection</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col space-y-6">
                {/* Branded Logo and Title */}
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center bg-[#F0FDF4] text-[#16A34A] rounded-md border border-[#16A34A]/20">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight m-0">ApproveFlow</h1>
                    <p className="text-xs tracking-wider text-muted-foreground uppercase font-semibold mt-1">
                      Approval Workflow Engine
                    </p>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="space-y-4">
                  <div className="h-[4px] w-full bg-secondary rounded-md overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: 'linear' }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Waking up the server...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                </div>

                {/* Pulsing Dots Loader */}
                <div className="flex justify-center space-x-1 py-2">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="h-2 w-2 bg-primary rounded-md"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </div>

                <div className="border-t border-border pt-4 text-center">
                  <p className="text-xs font-medium text-foreground mb-1">
                    Please Wait
                  </p>
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    "Did you know? Free tier servers sleep after 15 minutes of inactivity."
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
