'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Home, 
  Map, 
  History, 
  User,
  Plus
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  requireAuth: boolean
}

const navItems: NavItem[] = [
  {
    name: 'Home',
    href: '/dashboard',
    icon: Home,
    requireAuth: true
  },
  {
    name: 'History',
    href: '/passages',
    icon: History,
    requireAuth: true
  },
  {
    name: 'Plan',
    href: '/planner',
    icon: Plus,
    requireAuth: true
  },
  {
    name: 'Profile',
    href: '/profile',
    icon: User,
    requireAuth: true
  }
]

export function MobileNav() {
  const pathname = usePathname()

  // Don't show on non-app pages
  if (pathname === '/' || pathname === '/login' || pathname === '/signup') {
    return null
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="grid grid-cols-4 gap-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors',
                isActive 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Icon className={cn(
                'h-5 w-5 mb-1',
                item.href === '/planner' && !isActive && 'h-6 w-6'
              )} />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
} 