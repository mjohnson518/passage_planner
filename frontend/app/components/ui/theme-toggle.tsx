'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown' | 'switch'
  className?: string
}

export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={cn('h-9 w-9', className)} disabled>
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  if (variant === 'switch') {
    return (
      <div className={cn('flex items-center gap-2 p-1 rounded-full bg-muted', className)}>
        <button
          onClick={() => setTheme('light')}
          className={cn(
            'p-2 rounded-full transition-all duration-200',
            theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
          aria-label="Light mode"
        >
          <Sun className="h-4 w-4" />
        </button>
        <button
          onClick={() => setTheme('system')}
          className={cn(
            'p-2 rounded-full transition-all duration-200',
            theme === 'system' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
          aria-label="System theme"
        >
          <Monitor className="h-4 w-4" />
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={cn(
            'p-2 rounded-full transition-all duration-200',
            theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
          aria-label="Dark mode"
        >
          <Moon className="h-4 w-4" />
        </button>
      </div>
    )
  }

  if (variant === 'dropdown') {
    return (
      <div className={cn('relative group', className)}>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
        <div className="absolute right-0 mt-2 w-36 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right">
          <div className="card p-1 shadow-maritime-lg">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm transition-colors',
                theme === 'light' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
              )}
            >
              <Sun className="h-4 w-4" />
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm transition-colors',
                theme === 'dark' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
              )}
            >
              <Moon className="h-4 w-4" />
              Dark
            </button>
            <button
              onClick={() => setTheme('system')}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm transition-colors',
                theme === 'system' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
              )}
            >
              <Monitor className="h-4 w-4" />
              System
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Default icon variant
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className={cn('h-9 w-9 rounded-lg', className)}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
