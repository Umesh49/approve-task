
import { useNavigate } from 'react-router-dom'
import {
  Menu,
  User,
  Settings,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/components/ThemeProvider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface NavbarProps {
  setIsMobileOpen: (isOpen: boolean) => void
}

export function Navbar({ setIsMobileOpen }: NavbarProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()



  const handleLogout = () => {
    logout()
    navigate('/login')
  }


  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <header className="h-16 shrink-0 border-b border-border bg-card flex items-center justify-between px-4 sticky top-0 z-30">
      {/* Mobile Sidebar Hamburger */}
      <div className="flex items-center space-x-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileOpen(true)}
          className="md:hidden h-9 w-9 text-foreground hover:bg-background rounded-md"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Top Navbar Actions */}
      <div className="flex items-center space-x-3">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="h-9 w-9 text-primary hover:text-primary hover:bg-secondary dark:hover:bg-[#292524] rounded-md"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>



        {/* User Account Settings Dropdown */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 p-1 flex items-center space-x-2 hover:bg-background rounded-md"
              >
                <Avatar className="h-7 w-7 rounded-md border border-border">
                  <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-xs font-semibold">
                    {getInitials(user.username)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline-block text-xs font-semibold text-foreground">
                  {user.username}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 border-border bg-card rounded-md" align="end">
              <DropdownMenuLabel className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-3 py-2">
                My Account
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-secondary" />
              <DropdownMenuItem
                onClick={() => navigate('/profile')}
                className="focus:bg-background focus:text-foreground text-xs px-3 py-2 cursor-pointer rounded-md"
              >
                <User className="mr-2 h-4 w-4" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/settings')}
                className="focus:bg-background focus:text-foreground text-xs px-3 py-2 cursor-pointer rounded-md"
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Preferences</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-secondary" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="focus:bg-[#FEF2F2] focus:text-[#DC2626] text-xs text-[#DC2626] px-3 py-2 cursor-pointer rounded-md font-medium"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
