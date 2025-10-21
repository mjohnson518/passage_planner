
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { DemoPassage } from '../components/demo/DemoPassage'
import { 
  Plus, 
  History, 
  Compass, 
  Ship, 
  TrendingUp,
  Clock,
  MapPin,
  Waves
} from 'lucide-react'
import Link from 'next/link'

interface RecentPassage {
  id: string
  departure: string
  destination: string
  date: string
  status: 'completed' | 'planned' | 'in-progress'
  distance: number
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

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    // Load mock data for now
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
  }, [user, router])

  if (!user) return null

  return (
    <div className="container mx-auto px-4 py-6 lg:py-8 max-w-7xl">
      {/* Welcome Section */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold">
          Welcome back, {user.email.split('@')[0]}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Ready to plan your next sailing adventure?
        </p>
      </div>

      {/* Quick Actions - Mobile Optimized */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
        <Link href="/planner" className="group">
          <Card className="h-full hover:shadow-lg transition-all cursor-pointer group-hover:border-primary/50">
            <CardContent className="p-4 lg:p-6 text-center">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                <Plus className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-sm lg:text-base">New Passage</h3>
              <p className="text-xs lg:text-sm text-muted-foreground mt-1">
                Plan a new route
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/passages" className="group">
          <Card className="h-full hover:shadow-lg transition-all cursor-pointer group-hover:border-primary/50">
            <CardContent className="p-4 lg:p-6 text-center">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30 transition-colors">
                <History className="h-6 w-6 lg:h-7 lg:w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-sm lg:text-base">My Passages</h3>
              <p className="text-xs lg:text-sm text-muted-foreground mt-1">
                View history
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/weather" className="group">
          <Card className="h-full hover:shadow-lg transition-all cursor-pointer group-hover:border-primary/50">
            <CardContent className="p-4 lg:p-6 text-center">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3 group-hover:bg-green-200 dark:group-hover:bg-green-900/30 transition-colors">
                <Waves className="h-6 w-6 lg:h-7 lg:w-7 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-sm lg:text-base">Weather</h3>
              <p className="text-xs lg:text-sm text-muted-foreground mt-1">
                Check conditions
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/boats" className="group">
          <Card className="h-full hover:shadow-lg transition-all cursor-pointer group-hover:border-primary/50">
            <CardContent className="p-4 lg:p-6 text-center">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-3 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/30 transition-colors">
                <Ship className="h-6 w-6 lg:h-7 lg:w-7 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-sm lg:text-base">My Boats</h3>
              <p className="text-xs lg:text-sm text-muted-foreground mt-1">
                Manage vessels
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats Overview - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 lg:mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Passages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPassages}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +2 this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distance Sailed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDistance} nm</div>
            <p className="text-xs text-muted-foreground mt-1">
              <Compass className="inline h-3 w-3 mr-1" />
              Across all passages
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDuration}h</div>
            <p className="text-xs text-muted-foreground mt-1">
              <Clock className="inline h-3 w-3 mr-1" />
              Per passage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Passages - Mobile Optimized */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Passages</CardTitle>
            <CardDescription>Your latest sailing plans</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPassages.length > 0 ? (
              <div className="space-y-3">
                {recentPassages.map((passage) => (
                  <div
                    key={passage.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <p className="font-medium text-sm truncate">
                          {passage.departure} → {passage.destination}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(passage.date).toLocaleDateString()}</span>
                        <span>•</span>
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
                      className="ml-2 flex-shrink-0"
                    >
                      {passage.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Compass className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No passages yet</p>
                <Button className="mt-4" asChild>
                  <Link href="/planner">Plan Your First Passage</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Demo Passage - Hidden on small mobile */}
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
  )
} 