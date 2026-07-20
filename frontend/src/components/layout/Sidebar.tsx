import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  GitBranch,
  ClipboardList,
  ClipboardCheck,
  History,
  ChevronLeft,
  ChevronRight,
  LogOut,
  CheckCircle2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface SidebarProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  isMobileOpen: boolean
  setIsMobileOpen: (isOpen: boolean) => void
}

export function Sidebar({ isOpen, setIsOpen, isMobileOpen, setIsMobileOpen }: SidebarProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'approver', 'requester'] },
    { to: '/workflows', label: 'Workflows', icon: GitBranch, roles: ['admin'] },
    { to: '/requests', label: 'Requests', icon: ClipboardList, roles: ['admin', 'approver', 'requester'] },
    { to: '/approvals', label: 'Approvals', icon: ClipboardCheck, roles: ['approver', 'admin', 'requester'] },
    { to: '/audit-logs', label: 'Audit Log', icon: History, roles: ['admin'] },
  ]

  const filteredNavItems = navItems.filter(
    (item) => user && item.roles.includes(user.role)
  )

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: isOpen ? 256 : 72 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="dark hidden md:flex flex-col h-screen bg-card border-r border-border text-card-foreground z-20 shrink-0 sticky top-0"
      >
        {/* Sidebar Header */}
        <div className={`flex h-16 items-center border-b border-border ${isOpen ? 'justify-between px-4' : 'justify-center'}`}>
          <div className={`flex items-center overflow-hidden ${isOpen ? 'space-x-2' : ''}`}>
            {isOpen && (<div className="flex h-8 w-8 items-center justify-center bg-success-light text-success rounded-md shrink-0">
              <CheckCircle2 className="h-4.5 w-4.5" /></div>)}
            {isOpen && (
              <span className="font-bold text-base tracking-tight whitespace-nowrap">
                ApproveFlow
              </span>
            )}
          </div>
          {isOpen ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(true)}
              className="h-7 w-7 mx-auto text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center py-2 text-sm font-medium border rounded-md transition-colors ${isOpen ? 'px-3 justify-start' : 'justify-center'} ${
                    isActive
                      ? 'bg-foreground text-background border-transparent'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary border-transparent'
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {isOpen && <span className="ml-3 truncate">{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* User Card at bottom */}
        {user && (
          <div className={`p-3 border-t border-border flex flex-col space-y-2 ${!isOpen ? 'items-center' : ''}`}>
            <div className={`flex items-center overflow-hidden ${isOpen ? 'space-x-3' : ''}`}>
              <Avatar className="h-9 w-9 rounded-md border border-border">
                <AvatarFallback className="rounded-md bg-foreground text-background text-xs font-semibold">
                  {getInitials(user.username)}
                </AvatarFallback>
              </Avatar>
              {isOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate m-0">
                    {user.username}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate m-0">
                    {user.email}
                  </p>
                </div>
              )}
            </div>

            {isOpen && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider rounded-md border-border text-muted-foreground bg-secondary px-2 py-0.5">
                  {user.role}
                </Badge>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="h-6 text-[10px] font-bold text-danger hover:text-danger hover:bg-danger-light rounded-md px-2 py-1 justify-start space-x-1"
                >
                  <LogOut className="h-3 w-3" />
                  <span>Logout</span>
                </Button>
              </div>
            )}
            {!isOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-8 w-8 mx-auto text-danger hover:text-danger hover:bg-danger-light rounded-md"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </motion.aside>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-background"
            />
            {/* Sidebar content */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-64 bg-card border-r border-border flex flex-col h-full z-50 text-card-foreground"
            >
              <div className="flex h-16 items-center justify-between px-4 border-b border-border">
                <div className="flex items-center space-x-2">
                  <div className="flex h-8 w-8 items-center justify-center bg-success-light text-success rounded-md">
                    <CheckCircle2 className="h-4.5 w-4.5" />
                  </div>
                  <span className="font-bold text-base tracking-tight">ApproveFlow</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileOpen(false)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center py-2 text-sm font-medium border rounded-md transition-colors ${isOpen ? 'px-3 justify-start' : 'justify-center'} ${
                          isActive
                            ? 'bg-foreground text-background border-transparent'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary border-transparent'
                        }`
                      }
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="ml-3">{item.label}</span>
                    </NavLink>
                  )
                })}
              </nav>

              {user && (
                <div className={`p-3 border-t border-border flex flex-col space-y-2 ${!isOpen ? 'items-center' : ''}`}>
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-9 w-9 rounded-md border border-border">
                      <AvatarFallback className="rounded-md bg-foreground text-background text-xs font-semibold">
                        {getInitials(user.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate m-0">
                        {user.username}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate m-0">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider rounded-md border-border text-muted-foreground bg-secondary px-2 py-0.5">
                      {user.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      onClick={handleLogout}
                      className="h-6 text-[10px] font-bold text-danger hover:text-danger hover:bg-danger-light rounded-md px-2 py-1 justify-start space-x-1"
                    >
                      <LogOut className="h-3 w-3" />
                      <span>Logout</span>
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
