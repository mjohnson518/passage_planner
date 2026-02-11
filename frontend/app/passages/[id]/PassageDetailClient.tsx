'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'

const ExportDialog = dynamic(
  () => import('../../components/export/ExportDialog').then(m => ({ default: m.ExportDialog })),
  { ssr: false }
)
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Download, 
  Share2,
  Wind,
  Waves,
  Calendar,
  AlertTriangle,
  Anchor
} from 'lucide-react'
import type { Passage } from '@/types/shared'

// Helper function to convert degrees to compass direction
function degreesToCompass(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const index = Math.round(degrees / 22.5) % 16
  return directions[index]
}

// Helper to format time for display
function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Mock data for demonstration
const mockPassage: Passage = {
  id: '1',
  userId: 'user1',
  boatId: 'boat1',
  name: 'Boston to Portland Summer Cruise',
  departure: {
    name: 'Boston Harbor',
    coordinates: { lat: 42.3601, lng: -71.0589 },
    facilities: ['fuel', 'water', 'provisions'],
    vhfChannel: 16
  },
  destination: {
    name: 'Portland Harbor',
    coordinates: { lat: 43.6591, lng: -70.2568 },
    facilities: ['fuel', 'water', 'customs'],
    vhfChannel: 16
  },
  waypoints: [
    {
      id: '1',
      name: 'Gloucester',
      coordinates: { lat: 42.6159, lng: -70.6620 },
      type: 'marina'
    },
    {
      id: '2',
      name: 'Isles of Shoals',
      coordinates: { lat: 42.9869, lng: -70.6231 },
      type: 'anchorage'
    }
  ],
  departureTime: new Date('2024-07-15T08:00:00'),
  estimatedArrivalTime: new Date('2024-07-16T00:00:00'),
  distance: 98,
  estimatedDuration: 16,
  weather: [
    {
      startTime: new Date('2024-07-15T08:00:00'),
      endTime: new Date('2024-07-15T14:00:00'),
      location: { lat: 42.45, lng: -70.85 },
      wind: { direction: 225, speed: 12, gusts: 18 },
      waves: { height: 1.2, period: 6, direction: 200 },
      visibility: 10,
      precipitation: 0,
      pressure: 1018,
      temperature: 22
    },
    {
      startTime: new Date('2024-07-15T14:00:00'),
      endTime: new Date('2024-07-15T20:00:00'),
      location: { lat: 42.80, lng: -70.65 },
      wind: { direction: 240, speed: 15, gusts: 22 },
      waves: { height: 1.5, period: 7, direction: 210 },
      visibility: 8,
      precipitation: 0,
      pressure: 1016,
      temperature: 24
    },
    {
      startTime: new Date('2024-07-15T20:00:00'),
      endTime: new Date('2024-07-16T00:00:00'),
      location: { lat: 43.30, lng: -70.45 },
      wind: { direction: 250, speed: 10, gusts: 15 },
      waves: { height: 1.0, period: 5, direction: 220 },
      visibility: 12,
      precipitation: 0,
      pressure: 1017,
      temperature: 20
    }
  ],
  tides: [
    {
      location: 'Boston Harbor',
      coordinates: { lat: 42.3601, lng: -71.0589 },
      type: 'high',
      time: new Date('2024-07-15T06:30:00'),
      height: 3.2,
      current: { speed: 0.5, direction: 45 }
    },
    {
      location: 'Boston Harbor',
      coordinates: { lat: 42.3601, lng: -71.0589 },
      type: 'low',
      time: new Date('2024-07-15T12:45:00'),
      height: 0.3,
      current: { speed: 1.2, direction: 225 }
    },
    {
      location: 'Portsmouth Harbor',
      coordinates: { lat: 43.0718, lng: -70.7626 },
      type: 'high',
      time: new Date('2024-07-15T07:15:00'),
      height: 2.9,
      current: { speed: 0.8, direction: 60 }
    },
    {
      location: 'Portsmouth Harbor',
      coordinates: { lat: 43.0718, lng: -70.7626 },
      type: 'low',
      time: new Date('2024-07-15T13:30:00'),
      height: 0.4,
      current: { speed: 1.5, direction: 240 }
    },
    {
      location: 'Portland Harbor',
      coordinates: { lat: 43.6591, lng: -70.2568 },
      type: 'high',
      time: new Date('2024-07-15T07:45:00'),
      height: 3.0,
      current: { speed: 0.6, direction: 50 }
    },
    {
      location: 'Portland Harbor',
      coordinates: { lat: 43.6591, lng: -70.2568 },
      type: 'low',
      time: new Date('2024-07-15T14:00:00'),
      height: 0.2,
      current: { speed: 1.0, direction: 230 }
    }
  ],
  route: [
    {
      from: { lat: 42.3601, lng: -71.0589 },
      to: { lat: 42.6159, lng: -70.6620 },
      bearing: 45,
      distance: 26,
      estimatedSpeed: 6,
      estimatedTime: 4.3
    },
    {
      from: { lat: 42.6159, lng: -70.6620 },
      to: { lat: 42.9869, lng: -70.6231 },
      bearing: 15,
      distance: 25,
      estimatedSpeed: 6,
      estimatedTime: 4.2
    },
    {
      from: { lat: 42.9869, lng: -70.6231 },
      to: { lat: 43.6591, lng: -70.2568 },
      bearing: 5,
      distance: 47,
      estimatedSpeed: 6,
      estimatedTime: 7.8
    }
  ],
  safety: {
    vhfChannels: [16, 9, 13],
    emergencyContacts: [],
    nearestSafeHarbors: [],
    navigationWarnings: ['Lobster pots near Isles of Shoals']
  },
  preferences: {
    maxWindSpeed: 25,
    maxWaveHeight: 2,
    avoidNight: true,
    preferMotoring: false,
    comfortLevel: 'cruising'
  },
  status: 'planned',
  createdAt: new Date(),
  updatedAt: new Date()
}

export default function PassageDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [passage, setPassage] = useState<Passage | null>(null)
  const [loading, setLoading] = useState(true)
  const [showExportDialog, setShowExportDialog] = useState(false)

  useEffect(() => {
    const fetchPassage = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
        const response = await fetch(`${apiUrl}/api/passages/${params.id}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch passage')
        }
        
        const data = await response.json()
        setPassage(data)
      } catch (error) {
        console.error('Error fetching passage:', error)
        // Fallback to mock data for now
        setPassage(mockPassage)
      } finally {
        setLoading(false)
      }
    }

    fetchPassage()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Navigation className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading passage...</p>
        </div>
      </div>
    )
  }

  if (!passage) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Passage not found</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">{passage.name}</h1>
            <div className="flex items-center gap-2 mt-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{passage.departure.name} → {passage.destination.name}</span>
              <Badge variant={passage.status === 'completed' ? 'secondary' : 'default'}>
                {passage.status}
              </Badge>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button size="sm" onClick={() => setShowExportDialog(true)}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{passage.distance} nm</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{passage.estimatedDuration}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Departure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {new Date(passage.departureTime).toLocaleDateString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(passage.departureTime).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Waypoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{passage.waypoints.length + 2}</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information */}
      <Tabs defaultValue="route" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="route">Route</TabsTrigger>
          <TabsTrigger value="weather">Weather</TabsTrigger>
          <TabsTrigger value="tides">Tides</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
        </TabsList>

        <TabsContent value="route" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Route Details</CardTitle>
              <CardDescription>
                Waypoints and navigation information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Departure */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm">
                    D
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{passage.departure.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {passage.departure.coordinates.lat.toFixed(4)}°N, 
                      {Math.abs(passage.departure.coordinates.lng).toFixed(4)}°W
                    </p>
                    <p className="text-sm mt-1">
                      Departure: {new Date(passage.departureTime).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Waypoints */}
                {passage.waypoints.map((waypoint, index) => (
                  <div key={waypoint.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{waypoint.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {waypoint.coordinates.lat.toFixed(4)}°N, 
                        {Math.abs(waypoint.coordinates.lng).toFixed(4)}°W
                      </p>
                      {waypoint.type && (
                        <Badge variant="outline" className="mt-1">
                          {waypoint.type}
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {passage.route[index]?.distance.toFixed(1)} nm
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {passage.route[index]?.bearing.toFixed(0)}° True
                      </p>
                    </div>
                  </div>
                ))}

                {/* Destination */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                    A
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{passage.destination.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {passage.destination.coordinates.lat.toFixed(4)}°N, 
                      {Math.abs(passage.destination.coordinates.lng).toFixed(4)}°W
                    </p>
                    <p className="text-sm mt-1">
                      ETA: {new Date(passage.estimatedArrivalTime).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weather">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wind className="h-5 w-5" />
                Weather Forecast
              </CardTitle>
              <CardDescription>
                Weather conditions along the route
              </CardDescription>
            </CardHeader>
            <CardContent>
              {passage.weather && passage.weather.length > 0 ? (
                <div className="space-y-4">
                  {passage.weather.map((segment, index) => (
                    <div key={index} className="p-4 rounded-lg border bg-card">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold">
                            {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(segment.startTime).toLocaleDateString()}
                          </p>
                        </div>
                        {segment.temperature && (
                          <Badge variant="secondary">{segment.temperature}°C</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                          <Wind className="h-4 w-4 text-blue-500" />
                          <div>
                            <p className="text-sm font-medium">Wind</p>
                            <p className="text-sm text-muted-foreground">
                              {segment.wind.speed} kts {degreesToCompass(segment.wind.direction)}
                              {segment.wind.gusts && ` (G${segment.wind.gusts})`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Waves className="h-4 w-4 text-cyan-500" />
                          <div>
                            <p className="text-sm font-medium">Waves</p>
                            <p className="text-sm text-muted-foreground">
                              {segment.waves.height}m @ {segment.waves.period}s
                            </p>
                          </div>
                        </div>

                        {segment.visibility && (
                          <div>
                            <p className="text-sm font-medium">Visibility</p>
                            <p className="text-sm text-muted-foreground">{segment.visibility} nm</p>
                          </div>
                        )}

                        {segment.pressure && (
                          <div>
                            <p className="text-sm font-medium">Pressure</p>
                            <p className="text-sm text-muted-foreground">{segment.pressure} hPa</p>
                          </div>
                        )}
                      </div>

                      {/* Wind warning for safety */}
                      {segment.wind.speed > 20 && (
                        <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm text-yellow-700 dark:text-yellow-300">
                            Strong winds expected - consider timing or alternate route
                          </span>
                        </div>
                      )}
                      {segment.waves.height > 2 && (
                        <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <span className="text-sm text-orange-700 dark:text-orange-300">
                            Significant wave height - may affect comfort and safety
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Wind className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No weather data available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Weather forecast will be fetched when the passage is planned
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tides">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Anchor className="h-5 w-5" />
                Tidal Information
              </CardTitle>
              <CardDescription>
                Tide times and current predictions along the route
              </CardDescription>
            </CardHeader>
            <CardContent>
              {passage.tides && passage.tides.length > 0 ? (
                <div className="space-y-6">
                  {/* Group tides by location */}
                  {(Array.from(new Set(passage.tides.map(t => t.location))) as string[]).map((location) => (
                    <div key={location} className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {location}
                      </h4>
                      <div className="grid gap-3">
                        {passage.tides
                          .filter(t => t.location === location)
                          .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                          .map((tide, index) => (
                            <div
                              key={index}
                              className={`p-3 rounded-lg border flex items-center justify-between ${
                                tide.type === 'high'
                                  ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                                  : 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${
                                  tide.type === 'high' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-slate-100 dark:bg-slate-800'
                                }`}>
                                  {tide.type === 'high' ? (
                                    <Waves className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                  ) : (
                                    <Anchor className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium capitalize">{tide.type} Tide</p>
                                  <p className="text-sm text-muted-foreground">
                                    {formatTime(tide.time)} - {new Date(tide.time).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{tide.height.toFixed(1)}m</p>
                                {tide.current && (
                                  <p className="text-sm text-muted-foreground">
                                    Current: {tide.current.speed.toFixed(1)} kts {degreesToCompass(tide.current.direction)}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}

                  {/* Tidal current warning */}
                  {passage.tides.some(t => t.current && t.current.speed > 1.5) && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">Strong Tidal Currents</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Some locations have currents exceeding 1.5 knots. Plan your departure time to use favorable currents and avoid opposing strong flows.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Anchor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No tidal data available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tide predictions will be fetched when the passage is planned
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety">
          <Card>
            <CardHeader>
              <CardTitle>Safety Information</CardTitle>
              <CardDescription>
                Emergency contacts and navigation warnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">VHF Channels</h4>
                  <div className="flex gap-2">
                    {passage.safety.vhfChannels.map(channel => (
                      <Badge key={channel} variant="outline">
                        CH {channel}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {passage.safety.navigationWarnings.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Navigation Warnings</h4>
                    <div className="space-y-2">
                      {passage.safety.navigationWarnings.map((warning, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                          <p className="text-sm">{warning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      {passage && (
        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          passage={passage}
        />
      )}
    </div>
  )
} 