'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { DatePicker } from '../components/ui/date-picker'
import { 
  MapPin, 
  Calendar, 
  Ship, 
  Compass, 
  Loader2,
  Plus,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { planPassage, PassagePlanRequest } from '../../lib/orchestratorApi'
import { analytics } from '@/lib/analytics'

interface Waypoint {
  id: string
  name: string
  lat?: number
  lng?: number
}

export default function PlannerPage() {
  const { user } = useAuth()
  const { connected, agentStatuses, subscribe, unsubscribe } = useSocket()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('route')
  const [passagePlan, setPassagePlan] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    departure: '',
    destination: '',
    departureDate: new Date(),
    boat: '',
    cruiseSpeed: 6,
    maxSpeed: 8,
    waypoints: [] as Waypoint[]
  })

  // Subscribe to WebSocket updates
  useEffect(() => {
    const handleUpdate = (update: any) => {
      switch (update.type) {
        case 'planning_started':
          toast.info('Planning started - AI agents are working on your passage plan');
          break;
        case 'agent_active':
          toast.info(`${update.agent}: ${update.status}`);
          break;
        case 'planning_completed':
          setPassagePlan(update.plan);
          setLoading(false);
          toast.success('Passage plan complete!');
          
          // Track successful passage creation
          analytics.trackPassageCreated({
            distance_nm: update.plan?.summary?.totalDistance,
            duration_hours: update.plan?.summary?.estimatedDuration,
            waypoint_count: update.plan?.route?.waypoints?.length,
            departure_port: formData.departure,
            destination_port: formData.destination,
          });
          break;
        case 'planning_error':
          setLoading(false);
          toast.error(`Planning failed: ${update.error}`);
          break;
      }
    };

    subscribe(handleUpdate);
    return () => unsubscribe(handleUpdate);
  }, [subscribe, unsubscribe])

  const addWaypoint = () => {
    const newWaypoint: Waypoint = {
      id: Date.now().toString(),
      name: ''
    }
    setFormData(prev => ({
      ...prev,
      waypoints: [...prev.waypoints, newWaypoint]
    }))
  }

  const removeWaypoint = (id: string) => {
    setFormData(prev => ({
      ...prev,
      waypoints: prev.waypoints.filter(w => w.id !== id)
    }))
  }

  const updateWaypoint = (id: string, name: string) => {
    setFormData(prev => ({
      ...prev,
      waypoints: prev.waypoints.map(w => 
        w.id === id ? { ...w, name } : w
      )
    }))
  }

  const handleSubmit = async () => {
    if (!formData.departure || !formData.destination) {
      toast.error('Please enter departure and destination ports')
      return
    }

    setLoading(true)
    setPassagePlan(null);
    
    try {
      // For now, use hardcoded coordinates - in production, geocode the port names
      const departureCoords = { latitude: 42.3601, longitude: -71.0589 }; // Boston
      const destinationCoords = { latitude: 43.6591, longitude: -70.2568 }; // Portland
      
      const planRequest: PassagePlanRequest = {
        departure: {
          port: formData.departure,
          latitude: departureCoords.latitude,
          longitude: departureCoords.longitude,
          time: formData.departureDate.toISOString()
        },
        destination: {
          port: formData.destination,
          latitude: destinationCoords.latitude,
          longitude: destinationCoords.longitude
        },
        vessel: {
          type: formData.boat || 'sailboat',
          cruiseSpeed: formData.cruiseSpeed,
          maxSpeed: formData.maxSpeed
        },
        userId: user?.id
      };

      const result = await planPassage(planRequest);
      console.log('Planning started:', result.planningId);
      
      // WebSocket will handle the rest via planning_completed event
    } catch (error: any) {
      setLoading(false);
      toast.error(error.message || 'Failed to create passage plan')
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold">Plan New Passage</h1>
        <p className="text-muted-foreground mt-1">
          Enter your route details and we'll create a comprehensive passage plan
        </p>
      </div>

      {/* Agent Status Display */}
      {loading && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Planning in Progress
            </CardTitle>
            <CardDescription>
              WebSocket: {connected ? '🟢 Connected' : '🔴 Disconnected'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(agentStatuses).map(([agentName, status]) => (
                <div key={agentName} className="flex items-center gap-2 text-sm">
                  {status.status === 'active' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  <span className="font-medium capitalize">{agentName}:</span>
                  <span className="text-muted-foreground">{status.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passage Plan Results */}
      {passagePlan && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Passage Plan Ready
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Distance</p>
                <p className="text-xl font-bold">{passagePlan.summary.totalDistance.toFixed(1)} nm</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estimated Duration</p>
                <p className="text-xl font-bold">{passagePlan.summary.estimatedDuration.toFixed(1)} hrs</p>
              </div>
            </div>
            
            {passagePlan.summary.warnings?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-orange-700">⚠️ Warnings:</p>
                <ul className="text-sm space-y-1">
                  {passagePlan.summary.warnings.map((warning: string, idx: number) => (
                    <li key={idx} className="text-orange-700">• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {passagePlan.summary.recommendations?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">💡 Recommendations:</p>
                <ul className="text-sm space-y-1">
                  {passagePlan.summary.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="text-muted-foreground">• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <Button onClick={() => router.push(`/passages/${passagePlan.id}`)} className="w-full">
              View Full Plan Details
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Mobile-optimized tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="route" className="text-xs sm:text-sm">
            <MapPin className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Route</span>
          </TabsTrigger>
          <TabsTrigger value="details" className="text-xs sm:text-sm">
            <Calendar className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Details</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="text-xs sm:text-sm">
            <Ship className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
        </TabsList>

        <Card>
          <TabsContent value="route" className="mt-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Route Planning</CardTitle>
              <CardDescription>Define your departure, destination, and any waypoints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="departure">Departure Port *</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="departure"
                      placeholder="e.g., Boston, MA"
                      value={formData.departure}
                      onChange={(e) => setFormData(prev => ({ ...prev, departure: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="destination">Destination Port *</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="destination"
                      placeholder="e.g., Portland, ME"
                      value={formData.destination}
                      onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Waypoints */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Waypoints (Optional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addWaypoint}
                    className="h-8"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
                
                {formData.waypoints.length > 0 ? (
                  <div className="space-y-2">
                    {formData.waypoints.map((waypoint, index) => (
                      <div key={waypoint.id} className="flex gap-2">
                        <div className="flex-1 relative">
                          <Compass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder={`Waypoint ${index + 1}`}
                            value={waypoint.name}
                            onChange={(e) => updateWaypoint(waypoint.id, e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeWaypoint(waypoint.id)}
                          className="h-10 w-10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No waypoints added. Add waypoints for specific routing.
                  </p>
                )}
              </div>
            </CardContent>
          </TabsContent>

          <TabsContent value="details" className="mt-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Passage Details</CardTitle>
              <CardDescription>Set departure time and select your boat</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="departure-date">Departure Date & Time *</Label>
                <DatePicker 
                  date={formData.departureDate}
                  setDate={(date) => setFormData(prev => ({ ...prev, departureDate: date || new Date() }))}
                />
              </div>

              <div>
                <Label htmlFor="boat">Boat Type *</Label>
                <select
                  id="boat"
                  value={formData.boat}
                  onChange={(e) => setFormData(prev => ({ ...prev, boat: e.target.value }))}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Choose boat type...</option>
                  <option value="sailboat">Sailboat</option>
                  <option value="powerboat">Powerboat</option>
                  <option value="catamaran">Catamaran</option>
                  <option value="trimaran">Trimaran</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cruise-speed">Cruise Speed (kts)</Label>
                  <Input
                    id="cruise-speed"
                    type="number"
                    min="1"
                    max="30"
                    value={formData.cruiseSpeed}
                    onChange={(e) => setFormData(prev => ({ ...prev, cruiseSpeed: parseFloat(e.target.value) || 6 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="max-speed">Max Speed (kts)</Label>
                  <Input
                    id="max-speed"
                    type="number"
                    min="1"
                    max="40"
                    value={formData.maxSpeed}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxSpeed: parseFloat(e.target.value) || 8 }))}
                  />
                </div>
              </div>
            </CardContent>
          </TabsContent>

          <TabsContent value="preferences" className="mt-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Passage Preferences</CardTitle>
              <CardDescription>Customize your passage planning preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm">
                    Your default preferences from your boat profile will be used. 
                    You can adjust these after the passage is created.
                  </p>
                </div>
              </div>
            </CardContent>
          </TabsContent>
        </Card>
      </Tabs>

      {/* Action buttons - Fixed on mobile */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-background border-t lg:relative lg:bottom-auto lg:p-0 lg:border-0 lg:bg-transparent lg:mt-6">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex-1 lg:flex-initial"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.departure || !formData.destination}
            className="flex-1 lg:flex-initial"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Planning...
              </>
            ) : (
              'Create Passage Plan'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
} 