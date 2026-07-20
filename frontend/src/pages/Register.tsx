import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Mail, User as UserIcon } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AnimatedBackground } from '@/components/ui/animated-background'
import { PasswordInput } from '@/components/ui/password-input'

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores are allowed'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  password_confirm: z.string().min(1, 'Please confirm your password'),
  role: z.union([z.literal('approver'), z.literal('requester')]),
}).refine(data => data.password === data.password_confirm, {
  message: "Passwords don't match",
  path: ['password_confirm'],
})

type RegisterFormValues = z.infer<typeof registerSchema>

export function Register() {
  const navigate = useNavigate()
  const { register: signup, isAuthenticated, isLoading, error, clearError } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
    return () => {
      clearError()
    }
  }, [isAuthenticated, navigate, clearError])

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      password_confirm: '',
      role: 'requester',
    },
  })

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      await signup({
        username: data.username,
        email: data.email,
        password: data.password,
        password_confirm: data.password_confirm,
        role: data.role,
      })
      toast.success('Registration successful')
    } catch {
      toast.error('Registration failed')
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
              <h1 className="text-2xl font-bold tracking-tight m-0">Create Account</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Join ApproveFlow to manage approval workflows
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
                <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Username
                </Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-[#9CA3AF]" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="johndoe"
                    className="pl-9 border-border bg-card focus-visible:ring-[#1C1917] rounded-md text-sm h-10"
                    {...register('username')}
                  />
                </div>
                {errors.username && (
                  <p className="text-xs text-[#DC2626] font-medium mt-0.5">{errors.username.message}</p>
                )}
              </div>

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
                <Label htmlFor="role" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  System Role
                </Label>
                <Select
                  defaultValue="requester"
                  onValueChange={(val: 'approver' | 'requester') => setValue('role', val)}
                >
                  <SelectTrigger className="border-border bg-card focus:ring-[#1C1917] rounded-md text-sm h-10">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent className="border-border rounded-md">
                    <SelectItem value="requester" className="focus:bg-background focus:text-foreground rounded-md">
                      Requester
                    </SelectItem>
                    <SelectItem value="approver" className="focus:bg-background focus:text-foreground rounded-md">
                      Approver / Reviewer
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-xs text-[#DC2626] font-medium mt-0.5">{errors.role.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </Label>
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

              <div className="space-y-1.5">
                <Label htmlFor="password_confirm" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Confirm Password
                </Label>
                <PasswordInput
                  id="password_confirm"
                  placeholder="••••••••"
                  className="border-border bg-card focus-visible:ring-[#1C1917] rounded-md text-sm h-10"
                  {...register('password_confirm')}
                />
                {errors.password_confirm && (
                  <p className="text-xs text-[#DC2626] font-medium mt-0.5">{errors.password_confirm.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center justify-center font-medium transition-colors mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <span>Register</span>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col items-center justify-center border-t border-border bg-background/50 py-4 text-center rounded-md-b-[2px]">
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-bold text-foreground hover:underline"
              >
                Login here
              </Link>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}
