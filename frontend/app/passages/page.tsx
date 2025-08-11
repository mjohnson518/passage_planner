'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import { 
  Map, 
  Calendar, 
  Clock, 
  Navigation,
  Search,
  Filter,
  Plus,
  Download,
  Trash2,
  Edit,
  Eye,
  FileText,
  Ship,
  ArrowUpDown
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAnalytics } from '../hooks/useAnalytics'
import { deduplicatedFetch } from '../lib/performance'

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
  boatName?: string
  createdAt: string
  updatedAt: string
}

type SortOption = 'date' | 'name' | 'distance' | 'status'
type FilterStatus = 'all' | 'draft' | 'planned' | 'completed'

export default function PassagesPage() {
  const { user, session } = useAuth()
  const router = useRouter()
  const { track, trackFeature } = useAnalytics()
  const [passages, setPassages] = useState<Passage[]>([])
  const [filteredPassages, setFilteredPassages] = useState<Passage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [sortBy, setSortBy] = useState<SortOption>('date')
  const [selectedPassages, setSelectedPassages] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    track('page_view', { page: 'passages' })
    loadPassages()
  }, [user])

  useEffect(() => {
    filterAndSortPassages()
  }, [passages, searchQuery, statusFilter, sortBy])

  const loadPassages = async () => {
    try {
      setLoading(true)
      
      const data = await deduplicatedFetch(
        `passages-list-${user?.id}`,
        async () => {
          const response = await fetch('/api/passages', {
            headers: {
              'Authorization': `Bearer ${session?.access_token}`
            }
          })
          
          if (!response.ok) {
            throw new Error('Failed to fetch passages')
          }
          
          return response.json()
        },
        30000 // Cache for 30 seconds
      )
      
      // Transform snake_case from DB to camelCase for frontend
      const transformedPassages: Passage[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        departure: p.departure,
        destination: p.destination,
        departureDate: p.departure_date,
        distanceNm: p.distance_nm,
        estimatedDuration: p.estimated_duration,
        status: p.status,
        weatherSummary: p.weather_summary,
        boatName: p.boat_name,
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

  const filterAndSortPassages = () => {
    let filtered = [...passages]
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.departure.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.destination.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter)
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime()
        case 'name':
          return a.name.localeCompare(b.name)
        case 'distance':
          return b.distanceNm - a.distanceNm
        case 'status':
          const statusOrder = { draft: 0, planned: 1, completed: 2 }
          return statusOrder[a.status] - statusOrder[b.status]
        default:
          return 0
      }
    })
    
    setFilteredPassages(filtered)
  }

  const handleNewPassage = () => {
    trackFeature('new_passage_clicked', { source: 'passages_page' })
    router.push('/planner')
  }

  const handleViewPassage = (passageId: string) => {
    trackFeature('view_passage', { passageId, source: 'passages_list' })
    router.push(`/passages/${passageId}`)
  }

  const handleEditPassage = (passageId: string) => {
    trackFeature('edit_passage', { passageId, source: 'passages_list' })
    router.push(`/planner?edit=${passageId}`)
  }

  const handleDeletePassage = async (passageId: string) => {
    if (!confirm('Are you sure you want to delete this passage?')) return
    
    trackFeature('delete_passage', { passageId })
    // TODO: Implement delete API call
    setPassages(passages.filter(p => p.id !== passageId))
  }

  const handleBulkExport = () => {
    if (selectedPassages.size === 0) return
    
    trackFeature('bulk_export', { count: selectedPassages.size })
    // TODO: Implement bulk export
  }

  const togglePassageSelection = (passageId: string) => {
    const newSelection = new Set(selectedPassages)
    if (newSelection.has(passageId)) {
      newSelection.delete(passageId)
    } else {
      newSelection.add(passageId)
    }
    setSelectedPassages(newSelection)
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      draft: 'outline',
      planned: 'default',
      completed: 'secondary'
    }
    
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  if (!user) return null

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Passages</h2>
          <p className="text-muted-foreground">
            Manage your sailing routes and passage plans
          </p>
        </div>
        <Button onClick={handleNewPassage}>
          <Plus className="mr-2 h-4 w-4" />
          New Passage
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search passages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={(value: FilterStatus) => setStatusFilter(value)}>
              <SelectTrigger className="w-[150px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="w-[150px]">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="distance">Distance</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>

            {selectedPassages.size > 0 && (
              <Button variant="outline" onClick={handleBulkExport}>
                <Download className="mr-2 h-4 w-4" />
                Export ({selectedPassages.size})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Passages List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPassages.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery || statusFilter !== 'all' 
                ? 'No passages found' 
                : 'No passages yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start planning your first sailing adventure'}
            </p>
            {(!searchQuery && statusFilter === 'all') && (
              <Button onClick={handleNewPassage}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Passage
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPassages.map((passage) => (
            <Card key={passage.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedPassages.has(passage.id)}
                      onChange={() => togglePassageSelection(passage.id)}
                      className="mt-1"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-semibold hover:text-primary cursor-pointer transition-colors"
                              onClick={() => handleViewPassage(passage.id)}>
                            {passage.name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Navigation className="h-3 w-3" />
                            {passage.departure} → {passage.destination}
                          </div>
                        </div>
                        {getStatusBadge(passage.status)}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mt-4">
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
                        {passage.boatName && (
                          <div className="flex items-center gap-1">
                            <Ship className="h-3 w-3" />
                            {passage.boatName}
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-3 text-sm text-muted-foreground">
                        {passage.weatherSummary}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewPassage(passage.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditPassage(passage.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeletePassage(passage.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {!loading && passages.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{passages.length}</div>
                <div className="text-sm text-muted-foreground">Total Passages</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {passages.filter(p => p.status === 'planned').length}
                </div>
                <div className="text-sm text-muted-foreground">Upcoming</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {passages.reduce((sum, p) => sum + p.distanceNm, 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Total Miles</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {passages.filter(p => p.status === 'completed').length}
                </div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
