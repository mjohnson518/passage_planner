'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X, Anchor, User, LogOut, Settings, CreditCard, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '../../contexts/AuthContext'
import { useSocket } from '../../contexts/SocketContext'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { theme, setTheme } = useTheme()
  const { user, signOut } = useAuth()
  const { connected, agentStatuses } = useSocket()
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', requireAuth: true },
    { name: 'Plan Passage', href: '/planner', requireAuth: true },
    { name: 'My Passages', href: '/passages', requireAuth: true },
    { name: 'Pricing', href: '/pricing', requireAuth: false },
    { name: 'Docs', href: '/docs', requireAuth: false },
  ]

  const activeAgents = Object.keys(agentStatuses).length

  return (
    <header className={cn(
      'sticky top-0 z-50 w-full transition-all duration-200',
      scrolled ? 'glass shadow-lg' : 'bg-transparent'
    )}>
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8">
        {/* Logo */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-2">
            <Anchor className="h-8 w-8 text-primary animate-float" />
            <span className="text-xl font-bold text-gradient">Passage Planner</span>
          </Link>
          
          {/* Agent Status Indicator */}
          {user && (
            <div className="ml-4 hidden lg:flex items-center space-x-1">
              <div className={cn(
                'h-2 w-2 rounded-full',
                connected ? 'bg-green-500' : 'bg-red-500'
              )} />
              <span className="text-xs text-muted-foreground">
                {activeAgents} agents active
              </span>
            </div>
          )}
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex lg:gap-x-8">
          {navigation
            .filter(item => !item.requireAuth || user)
            .map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  pathname === item.href 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                )}
              >
                {item.name}
              </Link>
            ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="hidden lg:flex"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* User Menu */}
          {user ? (
            <div className="relative group">
              <Button variant="ghost" className="hidden lg:flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span className="text-sm">{user.email.split('@')[0]}</span>
              </Button>
              
              {/* Dropdown */}
              <div className="absolute right-0 mt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right">
                <div className="glass rounded-lg shadow-lg p-2">
                  <Link href="/profile" className="flex items-center space-x-2 px-3 py-2 rounded hover:bg-accent">
                    <Settings className="h-4 w-4" />
                    <span>Profile Settings</span>
                  </Link>
                  <Link href="/billing" className="flex items-center space-x-2 px-3 py-2 rounded hover:bg-accent">
                    <CreditCard className="h-4 w-4" />
                    <span>Billing</span>
                  </Link>
                  <hr className="my-2 border-border" />
                  <button
                    onClick={() => signOut()}
                    className="flex items-center space-x-2 px-3 py-2 rounded hover:bg-accent w-full text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost">Log In</Button>
              </Link>
              <Link href="/signup">
                <Button className="btn-primary">Start Free Trial</Button>
              </Link>
            </div>
          )}

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={cn(
        'lg:hidden',
        mobileMenuOpen ? 'block' : 'hidden'
      )}>
        <div className="glass border-t border-border px-4 py-6 space-y-4">
          {navigation
            .filter(item => !item.requireAuth || user)
            .map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'block text-base font-medium transition-colors hover:text-primary',
                  pathname === item.href 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          
          <hr className="border-border" />
          
          {user ? (
            <>
              <Link href="/profile" className="block text-base font-medium">
                Profile
              </Link>
              <button
                onClick={() => {
                  signOut()
                  setMobileMenuOpen(false)
                }}
                className="block text-base font-medium text-destructive"
              >
                Sign Out
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" fullWidth>Log In</Button>
              </Link>
              <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                <Button fullWidth>Start Free Trial</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
} 