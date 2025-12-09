'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X, Anchor, LogOut, Settings, CreditCard, Moon, Sun, ChevronDown } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '../../contexts/AuthContext'
import { useSocket } from '../../contexts/SocketContext'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { user, signOut } = useAuth()
  const { connected, agentStatuses } = useSocket()
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
    // Check demo mode
    const demoMode = typeof window !== 'undefined' && localStorage.getItem('helmwise_demo_mode') === 'true'
    setIsDemoMode(demoMode)

    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Re-check demo mode when pathname changes
  useEffect(() => {
    const demoMode = typeof window !== 'undefined' && localStorage.getItem('helmwise_demo_mode') === 'true'
    setIsDemoMode(demoMode)
  }, [pathname])

  const isAuthenticated = user || isDemoMode

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', requireAuth: true },
    { name: 'Plan Passage', href: '/planner', requireAuth: true },
    { name: 'My Passages', href: '/passages', requireAuth: true },
    { name: 'Pricing', href: '/pricing', requireAuth: false },
  ]

  const activeAgents = Object.keys(agentStatuses).length
  const displayName = user?.email?.split('@')[0] || (isDemoMode ? 'Demo' : '')

  const handleSignOut = () => {
    if (isDemoMode) {
      localStorage.removeItem('helmwise_demo_mode')
      window.location.href = '/login'
    } else {
      signOut()
    }
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className={cn(
      'sticky top-0 z-50 w-full transition-all duration-300',
      scrolled
        ? 'glass-heavy shadow-maritime'
        : 'bg-background/80 backdrop-blur-sm'
    )}>
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-ocean-deep flex items-center justify-center shadow-maritime group-hover:shadow-maritime-lg transition-shadow">
                <Anchor className="h-5 w-5 text-primary-foreground" />
              </div>
              {isAuthenticated && connected && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-background" />
              )}
            </div>
            <span className="font-display text-xl font-bold tracking-tight">Helmwise</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex lg:items-center lg:gap-1">
            {navigation
              .filter(item => !item.requireAuth || isAuthenticated)
              .map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    pathname === item.href
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {item.name}
                </Link>
              ))}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Demo Mode Indicator */}
          {isDemoMode && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-brass-100 dark:bg-brass-900/30 text-brass-700 dark:text-brass-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-brass-500" />
              <span>Demo Mode</span>
            </div>
          )}

          {/* Agent Status Indicator */}
          {isAuthenticated && activeAgents > 0 && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>{activeAgents} agents active</span>
            </div>
          )}

          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-lg"
              title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          )}

          {/* User Menu */}
          {isAuthenticated ? (
            <div className="relative group hidden lg:block">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-semibold',
                  isDemoMode
                    ? 'bg-gradient-to-br from-brass-400 to-brass-600'
                    : 'bg-gradient-to-br from-ocean-300 to-ocean-600'
                )}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium max-w-[100px] truncate">
                  {displayName}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Dropdown */}
              <div className="absolute right-0 mt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right translate-y-1 group-hover:translate-y-0">
                <div className="card p-2 shadow-maritime-lg">
                  <div className="px-3 py-2 mb-1">
                    <p className="text-sm font-medium">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isDemoMode ? 'Demo Account' : user?.email}
                    </p>
                  </div>
                  <hr className="my-1 border-border" />
                  {!isDemoMode && (
                    <>
                      <Link
                        href="/profile"
                        className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <span>Profile Settings</span>
                      </Link>
                      <Link
                        href="/billing"
                        className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors"
                      >
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span>Billing</span>
                      </Link>
                      <hr className="my-1 border-border" />
                    </>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-destructive/10 text-destructive w-full text-left transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{isDemoMode ? 'Exit Demo' : 'Sign Out'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" className="h-9 px-4 text-sm">
                  Log In
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="btn-primary h-9 px-4 text-sm">
                  Start Free Trial
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-10 w-10"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={cn(
        'lg:hidden overflow-hidden transition-all duration-300',
        mobileMenuOpen ? 'max-h-screen' : 'max-h-0'
      )}>
        <div className="glass-heavy border-t border-border px-4 py-6 space-y-4">
          {/* Demo Mode Banner Mobile */}
          {isDemoMode && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brass-100 dark:bg-brass-900/30 text-brass-700 dark:text-brass-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-brass-500" />
              <span>Demo Mode Active</span>
            </div>
          )}

          {navigation
            .filter(item => !item.requireAuth || isAuthenticated)
            .map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'block px-4 py-3 rounded-lg text-base font-medium transition-colors',
                  pathname === item.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}

          <hr className="border-border" />

          {/* Theme toggle mobile */}
          {mounted && (
            <button
              onClick={toggleTheme}
              className="flex items-center justify-between w-full px-4 py-3 rounded-lg text-base font-medium hover:bg-muted/50 transition-colors"
            >
              <span>{resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              {resolvedTheme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          )}

          {isAuthenticated ? (
            <>
              {!isDemoMode && (
                <Link
                  href="/profile"
                  className="block px-4 py-3 rounded-lg text-base font-medium hover:bg-muted/50 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profile
                </Link>
              )}
              <button
                onClick={() => {
                  handleSignOut()
                  setMobileMenuOpen(false)
                }}
                className="block w-full text-left px-4 py-3 rounded-lg text-base font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                {isDemoMode ? 'Exit Demo' : 'Sign Out'}
              </button>
            </>
          ) : (
            <div className="space-y-3 pt-2">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full h-12">
                  Log In
                </Button>
              </Link>
              <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                <Button className="btn-primary w-full h-12">
                  Start Free Trial
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
