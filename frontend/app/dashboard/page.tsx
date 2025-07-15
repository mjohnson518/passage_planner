'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { 
  Anchor, 
  Map, 
  Cloud, 
  Calendar, 
  TrendingUp,
  Ship,
  Navigation,
  FileText,
  Plus,
  ArrowRight,
  Clock,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface DashboardStats {
  totalPassages: number
  totalDistance: number
  hoursUnderway: number
  favoritePort: string
  currentMonth: {
    passages: number
    limit: number
  }
}

interface RecentPassage {
  id: string
  name: string
  departure: string
  destination: string
  date: string
  distance: number
  status: 'completed' | 'planned' | 'in-progress'
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [greeting, setGreeting] = useState('')

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Set time-based greeting
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 18) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/users/stats', {
        headers: {
          Authorization: `Bearer ${user?.access_token}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch stats')
      return response.json()
    },
    enabled: !!user,
  })

  // Fetch recent passages
  const { data: passages, isLoading: passagesLoading } = useQuery<RecentPassage[]>({
    queryKey: ['recent-passages', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/passages/recent?limit=5', {
        headers: {
          Authorization: `Bearer ${user?.access_token}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch passages')
      return response.json()
    },
    enabled: !!user,
  })

  if (authLoading) {
    return <LoadingSkeleton />
  }

  if (!user) {
    return null
  }

  const usagePercentage = stats 
    ? (stats.currentMonth.passages / stats.currentMonth.limit) * 100 
    : 0

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {greeting}, {user.email.split('@')[0]}!
        </h1>
        <p className="text-muted-foreground">
          Ready to plan your next adventure on the water?
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Link href="/planner">
          <Card className="hover:shadow-lg transition-all cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <Navigation className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Plan New Passage</h3>
                    <p className="text-sm text-muted-foreground">Start planning your route</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/passages">
          <Card className="hover:shadow-lg transition-all cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                    <Map className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">My Passages</h3>
                    <p className="text-sm text-muted-foreground">View saved routes</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/weather">
          <Card className="hover:shadow-lg transition-all cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                    <Cloud className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Weather Center</h3>
                    <p className="text-sm text-muted-foreground">Marine forecasts</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-green-500 transition-colors" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Passages</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalPassages || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Distance Sailed</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalDistance || 0} nm</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hours Underway</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.hoursUnderway || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold">
                    {stats?.currentMonth.passages || 0}/{stats?.currentMonth.limit || 2}
                  </span>
                  {usagePercentage >= 100 && (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className={cn(
                      "h-2 rounded-full transition-all",
                      usagePercentage >= 100 ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Passages */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Passages</CardTitle>
              <CardDescription>Your latest route plans and completed trips</CardDescription>
            </div>
            <Link href="/passages">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {passagesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : passages && passages.length > 0 ? (
            <div className="space-y-3">
              {passages.map((passage) => (
                <Link key={passage.id} href={`/passages/${passage.id}`}>
                  <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                    <div className="flex items-center space-x-4">
                      <Ship className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {passage.departure} → {passage.destination}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(passage.date).toLocaleDateString()}
                          </span>
                          <span>{passage.distance} nm</span>
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={passage.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Ship className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No passages yet</p>
              <Link href="/planner">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Plan Your First Passage
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade CTA for free users */}
      {stats?.currentMonth.limit === 2 && (
        <Card className="mt-8 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1">Unlock Unlimited Passages</h3>
                <p className="text-muted-foreground">
                  Upgrade to Premium for unlimited route planning, 7-day forecasts, and more.
                </p>
              </div>
              <Link href="/pricing">
                <Button className="btn-primary">
                  Upgrade Now
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    planned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    'in-progress': 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  }

  return (
    <span className={cn(
      'px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
      styles[status as keyof typeof styles] || styles.planned
    )}>
      {status.replace('-', ' ')}
    </span>
  )
}

function LoadingSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Skeleton className="h-10 w-64 mb-2" />
      <Skeleton className="h-6 w-96 mb-8" />
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  )
} 