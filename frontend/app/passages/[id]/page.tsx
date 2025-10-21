export const runtime = 'edge'

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { ExportDialog } from '../../components/export/ExportDialog'
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
  weather: [],
  tides: [],
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
    // TODO: Fetch passage from API
    setPassage(mockPassage)
    setLoading(false)
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
              <CardTitle>Weather Forecast</CardTitle>
              <CardDescription>
                Weather conditions along the route
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Weather data will be displayed here
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tides">
          <Card>
            <CardHeader>
              <CardTitle>Tidal Information</CardTitle>
              <CardDescription>
                Tide times and current predictions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Tidal data will be displayed here
              </p>
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