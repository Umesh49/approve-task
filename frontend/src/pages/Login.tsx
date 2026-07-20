import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { PasswordInput } from '@/components/ui/password-input'
import { AnimatedBackground } from '@/components/ui/animated-background'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore()

  const from = (location.state as any)?.from?.pathname || '/dashboard'

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
    return () => {
      clearError()
    }
  }, [isAuthenticated, navigate, from, clearError])

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  const onSubmit = async (data: LoginFormValues) => {
    try {
      await login(data.email, data.password)
      toast.success('Successfully logged in')
    } catch {
      toast.error('Authentication failed')
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      <AnimatedBackground />
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md relative"
      >
        <Card className="border border-border bg-card/80 backdrop-blur-sm rounded-md shadow-sm">
          <CardHeader className="space-y-4 pt-8 pb-6 flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center bg-[#F0FDF4] text-[#16A34A] rounded-md border border-[#16A34A]/20">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight m-0">Welcome Back</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your credentials to access ApproveFlow
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 bg-[#FEF2F2] border border-border text-[#DC2626] text-xs font-semibold rounded-md">
                  {error}
                </div>
              )}
              
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[#9CA3AF]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    className="pl-9 border-border bg-card focus-visible:ring-[#1C1917] rounded-md text-sm h-10"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-[#DC2626] font-medium mt-0.5">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Password
                  </Label>
                </div>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  className="border-border bg-card focus-visible:ring-[#1C1917] rounded-md text-sm h-10"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-[#DC2626] font-medium mt-0.5">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center space-x-2 py-1">
                <Checkbox
                  id="rememberMe"
                  className="rounded-md border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  onCheckedChange={(checked) => setValue('rememberMe', !!checked)}
                />
                <Label
                  htmlFor="rememberMe"
                  className="text-xs font-medium text-muted-foreground cursor-pointer"
                >
                  Remember this device
                </Label>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center justify-center font-medium transition-colors mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col items-center justify-center border-t border-border bg-background/50 py-4 text-center rounded-md-b-[2px]">
            <p className="text-xs text-muted-foreground">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-bold text-foreground hover:underline"
              >
                Register here
              </Link>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}
