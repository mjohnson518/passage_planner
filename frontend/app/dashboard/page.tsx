'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import dynamic from 'next/dynamic'
import { Skeleton } from '../components/ui/skeleton'

const DemoPassage = dynamic(
  () => import('../components/demo/DemoPassage').then(m => ({ default: m.DemoPassage })),
  { loading: () => <Skeleton className="h-[300px] w-full" /> }
)
import {
  Plus,
  History,
  Compass,
  Ship,
  TrendingUp,
  Clock,
  MapPin,
  Waves,
  Navigation,
  ArrowRight,
  Anchor,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '../lib/utils'

interface RecentPassage {
  id: string
  departure: string
  destination: string
  date: string
  status: 'completed' | 'planned' | 'in-progress'
  distance: number
}

// Demo data for when user is in demo mode
const DEMO_PASSAGES: RecentPassage[] = [
  {
    id: 'demo-1',
    departure: 'Miami, FL',
    destination: 'Nassau, Bahamas',
    date: '2024-12-05',
    status: 'completed',
    distance: 184
  },
  {
    id: 'demo-2',
    departure: 'Key West, FL',
    destination: 'Havana, Cuba',
    date: '2024-12-10',
    status: 'planned',
    distance: 106
  },
  {
    id: 'demo-3',
    departure: 'Fort Lauderdale, FL',
    destination: 'Bimini, Bahamas',
    date: '2024-12-01',
    status: 'completed',
    distance: 50
  }
]

const DEMO_STATS = {
  totalPassages: 24,
  totalDistance: 2847,
  avgDuration: 16.5
}

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [recentPassages, setRecentPassages] = useState<RecentPassage[]>([])
  const [stats, setStats] = useState({
    totalPassages: 0,
    totalDistance: 0,
    avgDuration: 0
  })
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [displayName, setDisplayName] = useState('Captain')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for demo mode
    const demoMode = typeof window !== 'undefined' && localStorage.getItem('helmwise_demo_mode') === 'true'
    setIsDemoMode(demoMode)

    if (!user && !demoMode) {
      router.push('/login')
      return
    }

    if (demoMode) {
      // Load demo data
      setRecentPassages(DEMO_PASSAGES)
      setStats(DEMO_STATS)
      setDisplayName('Demo Captain')
      setIsLoading(false)
    } else if (user) {
      // Load real user data
      setDisplayName(user.email?.split('@')[0] || 'Captain')
      setRecentPassages([
        {
          id: '1',
          departure: 'Boston, MA',
          destination: 'Portland, ME',
          date: '2024-01-15',
          status: 'completed',
          distance: 98
        },
        {
          id: '2',
          departure: 'Newport, RI',
          destination: 'Block Island',
          date: '2024-01-20',
          status: 'planned',
          distance: 45
        }
      ])
      setStats({
        totalPassages: 12,
        totalDistance: 1234,
        avgDuration: 18.5
      })
      setIsLoading(false)
    }
  }, [user, router])

  const handleExitDemo = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('helmwise_demo_mode')
      router.push('/login')
    }
  }

  // Show loading state
  if (isLoading && !isDemoMode && !user) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
        {/* Background pattern */}
        <div className="absolute inset-0 chart-grid opacity-30" />

        <div className="relative container mx-auto px-4 py-8 lg:py-12 max-w-7xl">
          {/* Demo Mode Banner */}
          {isDemoMode && (
            <div data-testid="dashboard-demo-banner" className="mb-6 p-4 bg-brass-100 dark:bg-brass-900/20 border border-brass-300 dark:border-brass-700 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-brass-600 dark:text-brass-400" />
                <div>
                  <p className="font-medium text-brass-800 dark:text-brass-300">Demo Mode Active</p>
                  <p className="text-sm text-brass-600 dark:text-brass-400">You're exploring Helmwise with sample data</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleExitDemo} className="border-brass-400 text-brass-700 dark:text-brass-300 hover:bg-brass-200 dark:hover:bg-brass-800">
                Exit Demo
              </Button>
            </div>
          )}

          {/* Welcome Section */}
          <div data-testid="dashboard-welcome" className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-ocean-deep flex items-center justify-center">
                <Anchor className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-2xl lg:text-3xl">
                  Welcome back, <span className="text-gradient">{displayName}</span>
                </h1>
                <p className="text-muted-foreground">
                  Ready to plan your next sailing adventure?
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              {
                href: '/planner',
                icon: Plus,
                title: 'New Passage',
                description: 'Plan a new route',
                accent: 'primary',
              },
              {
                href: '/passages',
                icon: History,
                title: 'My Passages',
                description: 'View history',
                accent: 'ocean',
              },
              {
                href: '/weather',
                icon: Waves,
                title: 'Weather',
                description: 'Check conditions',
                accent: 'brass',
              },
              {
                href: '/fleet',
                icon: Ship,
                title: 'My Boats',
                description: 'Manage vessels',
                accent: 'muted',
              },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="group" {...(item.href === '/planner' ? { 'data-testid': 'dashboard-new-passage' } : {})}>
                <Card className="h-full card-hover">
                  <CardContent className="p-5 lg:p-6 text-center">
                    <div className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 transition-all duration-300 group-hover:scale-110',
                      item.accent === 'primary' && 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground',
                      item.accent === 'ocean' && 'bg-ocean-100 dark:bg-ocean-900/20 text-ocean-600 dark:text-ocean-400',
                      item.accent === 'brass' && 'bg-brass-100 dark:bg-brass-900/20 text-brass-600 dark:text-brass-400',
                      item.accent === 'muted' && 'bg-muted text-muted-foreground'
                    )}>
                      <item.icon className="h-7 w-7" />
                    </div>
                    <h3 className="font-display font-semibold text-base lg:text-lg">{item.title}</h3>
                    <p className="text-xs lg:text-sm text-muted-foreground mt-1">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <Card className="card-nautical">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Navigation className="h-4 w-4" />
                  Total Passages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold text-gradient">
                  {stats.totalPassages}
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-success" />
                  <span className="text-success">+3</span> this month
                </p>
              </CardContent>
            </Card>

            <Card className="card-nautical">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Compass className="h-4 w-4" />
                  Distance Sailed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold">
                  {stats.totalDistance.toLocaleString()} <span className="text-lg text-muted-foreground">nm</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Across all passages
                </p>
              </CardContent>
            </Card>

            <Card className="card-nautical">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Avg Duration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold">
                  {stats.avgDuration}<span className="text-lg text-muted-foreground">h</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Per passage
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Passages & Demo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-display text-xl">Recent Passages</CardTitle>
                  <CardDescription>Your latest sailing plans</CardDescription>
                </div>
                <Link href="/passages">
                  <Button variant="ghost" size="sm" className="text-primary">
                    View All
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {recentPassages.length > 0 ? (
                  <div className="space-y-3">
                    {recentPassages.map((passage) => (
                      <Link
                        key={passage.id}
                        href={`/passages/${passage.id}`}
                        className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-200 group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <MapPin className="h-4 w-4 text-primary" />
                            </div>
                            <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                              {passage.departure} → {passage.destination}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground ml-10">
                            <span>{new Date(passage.date).toLocaleDateString()}</span>
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                            <span>{passage.distance} nm</span>
                          </div>
                        </div>
                        <Badge
                          variant={
                            passage.status === 'completed'
                              ? 'secondary'
                              : passage.status === 'planned'
                              ? 'outline'
                              : 'default'
                          }
                          className={cn(
                            'ml-3 flex-shrink-0',
                            passage.status === 'completed' && 'badge-success',
                            passage.status === 'planned' && 'badge-primary'
                          )}
                        >
                          {passage.status}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Compass className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">No passages yet</p>
                    <Button asChild>
                      <Link href="/planner">Plan Your First Passage</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Demo Passage */}
            <div className="hidden sm:block">
              <DemoPassage />
            </div>
          </div>

          {/* Floating Action Button for Mobile */}
          <Link href="/planner" className="lg:hidden">
            <Button
              size="lg"
              className="fab w-14 h-14 p-0"
            >
              <Plus className="h-6 w-6" />
              <span className="sr-only">New Passage</span>
            </Button>
          </Link>
        </div>
    </div>
  )
}
