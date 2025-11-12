'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { 
  MapPin, 
  Clock, 
  Wind, 
  Waves, 
  Navigation, 
  AlertTriangle,
  Download,
  Share2,
  PlayCircle
} from 'lucide-react'
import { useAnalytics } from '../../hooks/useAnalytics'

export function DemoPassage() {
  const [isPlaying, setIsPlaying] = useState(false)
  const { trackFeature } = useAnalytics()

  const handleStartDemo = () => {
    setIsPlaying(true)
    trackFeature('demo_passage_started')
  }

  const demoRoute = {
    departure: 'Boston, MA',
    destination: 'Portland, ME',
    distance: 98,
    estimatedTime: '16-18 hours',
    waypoints: [
      { name: 'Boston Harbor', lat: 42.3601, lng: -71.0589 },
      { name: 'Gloucester', lat: 42.6159, lng: -70.6620 },
      { name: 'Isles of Shoals', lat: 42.9869, lng: -70.6231 },
      { name: 'Cape Porpoise', lat: 43.3633, lng: -70.4289 },
      { name: 'Portland Harbor', lat: 43.6591, lng: -70.2568 }
    ],
    weather: {
      summary: 'Fair conditions with moderate SW winds',
      wind: { direction: 'SW', speed: 15, gusts: 20 },
      waves: { height: 1.5, period: 6 },
      visibility: 10
    },
    tides: [
      { location: 'Boston', high: '06:42', low: '12:54' },
      { location: 'Portland', high: '06:58', low: '13:10' }
    ]
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Demo Passage: Boston to Portland</CardTitle>
            <CardDescription>
              See how Helmwise creates a complete sailing plan
            </CardDescription>
          </div>
          <Badge variant="secondary">Demo</Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        {!isPlaying ? (
          <div className="text-center py-8">
            <div className="mb-6">
              <Navigation className="h-16 w-16 mx-auto text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Experience intelligent passage planning
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                This demo shows a real passage plan from Boston to Portland, 
                including weather routing, tide calculations, and safety considerations.
              </p>
            </div>
            
            <Button onClick={handleStartDemo} size="lg">
              <PlayCircle className="h-5 w-5 mr-2" />
              Start Interactive Demo
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Route Overview */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Route:</span>
                  <span>{demoRoute.departure} → {demoRoute.destination}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Distance:</span>
                  <span>{demoRoute.distance} nm</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Duration:</span>
                  <span>{demoRoute.estimatedTime}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Wind className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Wind:</span>
                  <span>{demoRoute.weather.wind.direction} {demoRoute.weather.wind.speed} kts</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Waves className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Waves:</span>
                  <span>{demoRoute.weather.waves.height}m @ {demoRoute.weather.waves.period}s</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Conditions:</span>
                  <span className="text-green-600">Good for sailing</span>
                </div>
              </div>
            </div>

            {/* Detailed Information */}
            <Tabs defaultValue="waypoints" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="waypoints">Waypoints</TabsTrigger>
                <TabsTrigger value="weather">Weather</TabsTrigger>
                <TabsTrigger value="tides">Tides</TabsTrigger>
                <TabsTrigger value="safety">Safety</TabsTrigger>
              </TabsList>
              
              <TabsContent value="waypoints" className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  Optimized route with key waypoints for safe navigation
                </p>
                {demoRoute.waypoints.map((waypoint, index) => (
                  <div key={index} className="flex justify-between items-center p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{waypoint.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {waypoint.lat.toFixed(4)}°N, {Math.abs(waypoint.lng).toFixed(4)}°W
                        </p>
                      </div>
                    </div>
                    {index < demoRoute.waypoints.length - 1 && (
                      <span className="text-xs text-muted-foreground">
                        ~{Math.round(demoRoute.distance / 4)} nm
                      </span>
                    )}
                  </div>
                ))}
              </TabsContent>
              
              <TabsContent value="weather" className="space-y-3">
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
                  <h4 className="font-medium mb-2">{demoRoute.weather.summary}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Wind</p>
                      <p className="font-medium">
                        {demoRoute.weather.wind.direction} {demoRoute.weather.wind.speed}-{demoRoute.weather.wind.gusts} kts
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sea State</p>
                      <p className="font-medium">
                        {demoRoute.weather.waves.height}m waves, {demoRoute.weather.waves.period}s period
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Visibility</p>
                      <p className="font-medium">{demoRoute.weather.visibility} nm</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Conditions</p>
                      <p className="font-medium text-green-600">Favorable</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Weather forecast updated 2 hours ago from NOAA
                </p>
              </TabsContent>
              
              <TabsContent value="tides" className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Tide times for departure and arrival ports
                </p>
                {demoRoute.tides.map((tide, index) => (
                  <div key={index} className="bg-muted/30 rounded-lg p-3">
                    <h4 className="font-medium text-sm mb-2">{tide.location}</h4>
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">High: </span>
                        <span className="font-medium">{tide.high}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Low: </span>
                        <span className="font-medium">{tide.low}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Plan departure 2 hours after low tide for favorable current
                </p>
              </TabsContent>
              
              <TabsContent value="safety" className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                    <div>
                      <p className="font-medium text-sm">VHF Coverage</p>
                      <p className="text-sm text-muted-foreground">
                        Full coverage along entire route
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                    <div>
                      <p className="font-medium text-sm">Safe Harbors</p>
                      <p className="text-sm text-muted-foreground">
                        Gloucester and Portsmouth available if needed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5" />
                    <div>
                      <p className="font-medium text-sm">Navigation Warning</p>
                      <p className="text-sm text-muted-foreground">
                        Lobster pots reported near Isles of Shoals
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 mt-4">
                  <p className="text-sm font-medium">Emergency Contacts</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    USCG Sector Boston: VHF 16 or (617) 223-5757
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Export GPX
              </Button>
              <Button variant="outline" className="flex-1">
                <Share2 className="h-4 w-4 mr-2" />
                Share Plan
              </Button>
              <Button className="flex-1">
                Plan Your Own Passage
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 