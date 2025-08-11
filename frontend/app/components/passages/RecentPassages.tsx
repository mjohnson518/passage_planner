'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Skeleton } from '../ui/skeleton'
import { 
  Map, 
  Calendar, 
  Clock, 
  Navigation,
  ArrowRight,
  FileText,
  Download,
  Eye
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useAnalytics } from '../../hooks/useAnalytics'
import { deduplicatedFetch } from '../../lib/performance'

interface Passage {
  id: string
  name: string
  departure: string
  destination: string
  departureDate: string
  distanceNm: number
  estimatedDuration: string
  status: 'draft' | 'planned' | 'completed'
  weatherSummary: string
  createdAt: string
  updatedAt: string
}

export function RecentPassages() {
  const { user, session } = useAuth()
  const router = useRouter()
  const { trackFeature } = useAnalytics()
  const [passages, setPassages] = useState<Passage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && session) {
      loadRecentPassages()
    }
  }, [user, session])

  const loadRecentPassages = async () => {
    try {
      setLoading(true)
      
      const data = await deduplicatedFetch(
        `recent-passages-${user?.id}`,
        async () => {
          const response = await fetch('/api/passages/recent', {
            headers: {
              'Authorization': `Bearer ${session?.access_token}`
            }
          })
          
          if (!response.ok) {
            throw new Error('Failed to fetch passages')
          }
          
          return response.json()
        },
        60000 // Cache for 1 minute
      )
      
      // Transform snake_case from DB to camelCase for frontend
      const transformedPassages = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        departure: p.departure,
        destination: p.destination,
        departureDate: p.departure_date,
        distanceNm: p.distance_nm,
        estimatedDuration: p.estimated_duration,
        status: p.status,
        weatherSummary: p.weather_summary,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }))
      
      setPassages(transformedPassages)
    } catch (error) {
      console.error('Failed to load passages:', error)
      setPassages([])
    } finally {
      setLoading(false)
    }
  }

  const handleViewPassage = (passageId: string) => {
    trackFeature('view_passage', { passageId, source: 'recent_passages' })
    router.push(`/passages/${passageId}`)
  }

  const handleViewAll = () => {
    trackFeature('view_all_passages', { source: 'recent_passages' })
    router.push('/passages')
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      draft: 'outline',
      planned: 'default',
      completed: 'secondary'
    }
    
    return (
      <Badge variant={variants[status] || 'outline'} className="text-xs">
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays > 0 && diffDays < 7) return `In ${diffDays} days`
    if (diffDays < 0 && diffDays > -7) return `${Math.abs(diffDays)} days ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Recent Passages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Recent Passages
          </CardTitle>
          <CardDescription>
            Your recently planned sailing routes
          </CardDescription>
        </div>
        {passages.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleViewAll}>
            View All
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {passages.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No passages planned yet</p>
            <Button onClick={() => router.push('/planner')}>
              Plan Your First Passage
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {passages.map((passage) => (
              <div
                key={passage.id}
                className="group border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewPassage(passage.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">
                      {passage.name}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Navigation className="h-3 w-3" />
                      {passage.departure} → {passage.destination}
                    </div>
                  </div>
                  {getStatusBadge(passage.status)}
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground mt-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(passage.departureDate)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Map className="h-3 w-3" />
                    {passage.distanceNm} nm
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {passage.estimatedDuration}
                  </div>
                </div>
                
                <div className="mt-3 text-xs text-muted-foreground">
                  {passage.weatherSummary}
                </div>
                
                <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleViewPassage(passage.id)
                    }}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      trackFeature('download_passage', { passageId: passage.id })
                    }}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
