
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
import { planPassage as planPassageOld, PassagePlanRequest } from '../../lib/orchestratorApi'
import { planPassage, PassagePlanningRequest, PassagePlanningResponse } from '../../lib/services/passagePlanningService'
import { analytics } from '@/lib/analytics'
import LocationAutocomplete from '../components/location/LocationAutocomplete'

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
  const [passagePlan, setPassagePlan] = useState<PassagePlanningResponse | null>(null)
  
  const [formData, setFormData] = useState({
    departure: '',
    destination: '',
    departureCoords: { latitude: 0, longitude: 0 }, // Will be set by autocomplete
    destinationCoords: { latitude: 0, longitude: 0 }, // Will be set by autocomplete
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

    // Validate coordinates are set
    if (formData.departureCoords.latitude === 0 || formData.destinationCoords.latitude === 0) {
      toast.error('Please select locations from the autocomplete suggestions')
      return
    }

    setLoading(true)
    setPassagePlan(null);
    
    try {
      // Use coordinates from autocomplete or defaults
      const planRequest: PassagePlanningRequest = {
        departure: {
          latitude: formData.departureCoords.latitude,
          longitude: formData.departureCoords.longitude,
          name: formData.departure
        },
        destination: {
          latitude: formData.destinationCoords.latitude,
          longitude: formData.destinationCoords.longitude,
          name: formData.destination
        },
        vessel: {
          cruiseSpeed: formData.cruiseSpeed,
          draft: 5.5, // Default draft in feet
          crewExperience: 'advanced', // Default to advanced
          crewSize: 2
        }
      };

      console.log('Calling production backend API...');
      const result = await planPassage(planRequest);
      
      console.log('Passage plan received:', result);
      setPassagePlan(result);
      setLoading(false);
      
      toast.success('Passage plan complete - all 6 data sources loaded!');
      
      // Track successful passage creation
      analytics.trackPassageCreated({
        distance_nm: result.route.distance,
        duration_hours: result.route.estimatedDurationHours,
        waypoint_count: result.route.waypoints.length,
        departure_port: formData.departure,
        destination_port: formData.destination,
        safety_decision: result.summary.safetyDecision
      });
      
    } catch (error: any) {
      setLoading(false);
      toast.error(error.message || 'Failed to create passage plan')
      console.error('Passage planning error:', error);
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

      {/* Passage Plan Results - All 6 Data Sources */}
      {passagePlan && (
        <div className="space-y-6 mb-6">
          {/* Safety Decision - PROMINENT DISPLAY */}
          <Card className={`border-2 ${
            passagePlan.summary.safetyDecision === 'GO' ? 'border-green-500 bg-green-50' :
            passagePlan.summary.safetyDecision === 'CAUTION' ? 'border-yellow-500 bg-yellow-50' :
            'border-red-500 bg-red-50'
          }`}>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                {passagePlan.summary.safetyDecision === 'GO' && <CheckCircle2 className="h-8 w-8 text-green-600" />}
                {passagePlan.summary.safetyDecision === 'CAUTION' && <AlertCircle className="h-8 w-8 text-yellow-600" />}
                {passagePlan.summary.safetyDecision === 'NO-GO' && <X className="h-8 w-8 text-red-600" />}
                Safety Decision: {passagePlan.summary.safetyDecision}
              </CardTitle>
              <CardDescription className="text-lg">
                Safety Score: {passagePlan.summary.safetyScore} | Risk Level: {passagePlan.summary.overallRisk}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold mb-2">Assessment:</p>
                  <p className="text-sm">{passagePlan.summary.suitableForPassage ? '✅ This passage is suitable for departure' : '⚠️ Review all warnings before proceeding'}</p>
                </div>
                
                {passagePlan.safety.riskFactors.length > 0 && (
                  <div>
                    <p className="font-semibold mb-2">Risk Factors ({passagePlan.safety.riskFactors.length}):</p>
                    <ul className="text-sm space-y-1">
                      {passagePlan.safety.riskFactors.slice(0, 5).map((factor: string, idx: number) => (
                        <li key={idx}>• {factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Route Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Compass className="h-5 w-5" />
                1. Route Calculations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Distance</p>
                  <p className="text-xl font-bold">{passagePlan.route.distance} nm</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="text-xl font-bold">{passagePlan.route.estimatedDuration}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bearing</p>
                  <p className="text-xl font-bold">{passagePlan.route.bearing.toFixed(0)}°</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Speed</p>
                  <p className="text-xl font-bold">{passagePlan.summary.averageSpeed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weather Data */}
          <Card>
          <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ship className="h-5 w-5" />
                2. Weather Conditions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold mb-2">Departure: {formData.departure}</p>
                  <div className="space-y-1 text-sm">
                    <p><strong>Conditions:</strong> {passagePlan.weather.departure.conditions}</p>
                    <p><strong>Wind:</strong> {passagePlan.weather.departure.windDescription}</p>
                    <p><strong>Waves:</strong> {passagePlan.weather.departure.waveHeight}ft</p>
                    <p><strong>Temp:</strong> {passagePlan.weather.departure.temperature}°F</p>
                    {passagePlan.weather.departure.warnings.length > 0 && (
                      <p className="text-orange-600"><strong>⚠️ Warnings:</strong> {passagePlan.weather.departure.warnings.join(', ')}</p>
                    )}
                  </div>
                </div>
              <div>
                  <p className="font-semibold mb-2">Destination: {formData.destination}</p>
                  <div className="space-y-1 text-sm">
                    <p><strong>Conditions:</strong> {passagePlan.weather.destination.conditions}</p>
                    <p><strong>Wind:</strong> {passagePlan.weather.destination.windDescription}</p>
                    <p><strong>Waves:</strong> {passagePlan.weather.destination.waveHeight}ft</p>
                    <p><strong>Temp:</strong> {passagePlan.weather.destination.temperature}°F</p>
                    {passagePlan.weather.destination.warnings.length > 0 && (
                      <p className="text-orange-600"><strong>⚠️ Warnings:</strong> {passagePlan.weather.destination.warnings.join(', ')}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t">
                <p className="text-sm"><strong>Overall:</strong> {passagePlan.weather.summary.overall}</p>
                <p className="text-sm text-muted-foreground">Source: {passagePlan.weather.departure.source}</p>
              </div>
            </CardContent>
          </Card>

          {/* Tidal Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                3. Tidal Predictions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold mb-2">Departure Tides</p>
                  <p className="text-sm"><strong>Station:</strong> {passagePlan.tidal.departure.station}</p>
                  <p className="text-sm"><strong>Next Tide:</strong> {passagePlan.tidal.departure.nextTideFormatted}</p>
                  {passagePlan.tidal.departure.predictions.length > 0 && (
                    <p className="text-sm text-muted-foreground">{passagePlan.tidal.departure.predictions.length} predictions available</p>
                  )}
              </div>
              <div>
                  <p className="font-semibold mb-2">Destination Tides</p>
                  <p className="text-sm"><strong>Station:</strong> {passagePlan.tidal.destination.station}</p>
                  <p className="text-sm"><strong>Next Tide:</strong> {passagePlan.tidal.destination.nextTideFormatted}</p>
                  {passagePlan.tidal.destination.predictions.length > 0 && (
                    <p className="text-sm text-muted-foreground">{passagePlan.tidal.destination.predictions.length} predictions available</p>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Source: {passagePlan.tidal.departure.source}</p>
            </CardContent>
          </Card>

          {/* Navigation Warnings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                4. Navigation Warnings ({passagePlan.navigationWarnings.count})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {passagePlan.navigationWarnings.critical > 0 && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded">
                  <p className="font-bold text-red-700">⚠️ {passagePlan.navigationWarnings.critical} CRITICAL WARNING(S)</p>
            </div>
              )}
            
              {passagePlan.navigationWarnings.count > 0 ? (
              <div className="space-y-2">
                  {passagePlan.navigationWarnings.warnings.slice(0, 5).map((warning: any, idx: number) => (
                    <div key={idx} className={`p-3 rounded border ${
                      warning.severity === 'critical' ? 'bg-red-50 border-red-200' :
                      warning.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-blue-50 border-blue-200'
                    }`}>
                      <p className="font-semibold text-sm">{warning.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{warning.description}</p>
                      <p className="text-xs mt-1"><strong>Source:</strong> {warning.source}</p>
                    </div>
                  ))}
                  {passagePlan.navigationWarnings.count > 5 && (
                    <p className="text-sm text-muted-foreground">+ {passagePlan.navigationWarnings.count - 5} more warnings</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active navigation warnings</p>
              )}
            </CardContent>
          </Card>

          {/* Safety Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                5. Safety Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Hazards Detected</p>
                  <p className="text-lg font-bold">{passagePlan.safety.analysis.hazardsDetected}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Warnings Active</p>
                  <p className="text-lg font-bold">{passagePlan.safety.analysis.warningsActive}</p>
                </div>
              </div>
              
              {passagePlan.safety.recommendations.length > 0 && (
                <div>
                  <p className="font-semibold mb-2">Safety Recommendations:</p>
                  <ul className="text-sm space-y-1">
                    {passagePlan.safety.recommendations.slice(0, 8).map((rec: string, idx: number) => (
                      <li key={idx} className="text-muted-foreground">• {rec}</li>
                    ))}
                  </ul>
              </div>
            )}
            
              {passagePlan.safety.emergencyContacts && (
                <div className="pt-3 border-t">
                  <p className="font-semibold mb-2">Emergency Contact:</p>
                  <p className="text-sm">{passagePlan.safety.emergencyContacts.emergency.coastGuard.name}</p>
                  <p className="text-sm">VHF: {passagePlan.safety.emergencyContacts.emergency.coastGuard.vhf}</p>
                  <p className="text-sm">Phone: {passagePlan.safety.emergencyContacts.emergency.coastGuard.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Port Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                6. Port Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Departure Port */}
                <div>
                  <p className="font-semibold mb-2">Departure Port</p>
                  {passagePlan.port.departure.found !== false ? (
                    <div className="space-y-1 text-sm">
                      <p><strong>Name:</strong> {passagePlan.port.departure.name}</p>
                      <p><strong>Distance:</strong> {passagePlan.port.departure.distance}</p>
                      <p><strong>VHF:</strong> Channel {passagePlan.port.departure.contact?.vhf}</p>
                      <p><strong>Facilities:</strong> {passagePlan.port.departure.facilities?.fuel ? '⛽' : ''} {passagePlan.port.departure.facilities?.water ? '💧' : ''} {passagePlan.port.departure.facilities?.repair ? '🔧' : ''}</p>
                      {passagePlan.port.departure.customs?.portOfEntry && (
                        <p className="text-blue-600"><strong>🛂 Port of Entry</strong></p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{passagePlan.port.departure.message || 'No port nearby'}</p>
                  )}
                </div>

                {/* Destination Port */}
                <div>
                  <p className="font-semibold mb-2">Destination Port</p>
                  {passagePlan.port.destination.found !== false ? (
                    <div className="space-y-1 text-sm">
                      <p><strong>Name:</strong> {passagePlan.port.destination.name}</p>
                      <p><strong>Distance:</strong> {passagePlan.port.destination.distance}</p>
                      <p><strong>VHF:</strong> Channel {passagePlan.port.destination.contact?.vhf}</p>
                      <p><strong>Facilities:</strong> {passagePlan.port.destination.facilities?.fuel ? '⛽' : ''} {passagePlan.port.destination.facilities?.water ? '💧' : ''} {passagePlan.port.destination.facilities?.repair ? '🔧' : ''}</p>
                      {passagePlan.port.destination.customs?.portOfEntry && (
                        <p className="text-blue-600"><strong>🛂 Port of Entry</strong></p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{passagePlan.port.destination.message || 'No port nearby'}</p>
                  )}
                </div>
              </div>

              {/* Emergency Harbors */}
              {passagePlan.port.emergencyHarbors.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="font-semibold mb-2">Emergency Harbors Nearby:</p>
              <div className="space-y-2">
                    {passagePlan.port.emergencyHarbors.map((harbor: any, idx: number) => (
                      <div key={idx} className="text-sm flex items-center gap-2">
                        <span className="font-medium">{harbor.name}</span>
                        <span className="text-muted-foreground">({harbor.distance}) - VHF {harbor.vhf}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary and Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Passage Summary & Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold mb-2">Route Summary:</p>
                <p className="text-sm">{passagePlan.summary.totalDistance} in {passagePlan.summary.estimatedTime}</p>
              </div>
              
              {passagePlan.summary.recommendations.length > 0 && (
                <div>
                  <p className="font-semibold mb-2">📋 All Recommendations:</p>
                <ul className="text-sm space-y-1">
                  {passagePlan.summary.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="text-muted-foreground">• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
            
              <div className="pt-3 border-t text-xs text-muted-foreground">
                <p><strong>Data Sources:</strong> Route (geolib), Weather (NOAA), Tidal (NOAA), Navigation Warnings, Safety Analysis, Port Information</p>
                <p><strong>Generated:</strong> {new Date().toLocaleString()}</p>
              </div>
          </CardContent>
        </Card>
        </div>
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
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                    <LocationAutocomplete
                      value={formData.departure}
                      onChange={(value) => setFormData(prev => ({ ...prev, departure: value }))}
                      onPlaceSelected={(place) => {
                        setFormData(prev => ({
                          ...prev,
                          departure: place.name,
                          departureCoords: { latitude: place.latitude, longitude: place.longitude }
                        }))
                      }}
                      placeholder="e.g., Boston, MA or Gibraltar"
                      className="pl-10 w-full"
                      id="departure"
                    />
                  </div>
                  {formData.departureCoords.latitude !== 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      📍 {formData.departureCoords.latitude.toFixed(4)}°, {formData.departureCoords.longitude.toFixed(4)}°
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="destination">Destination Port *</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                    <LocationAutocomplete
                      value={formData.destination}
                      onChange={(value) => setFormData(prev => ({ ...prev, destination: value }))}
                      onPlaceSelected={(place) => {
                        setFormData(prev => ({
                          ...prev,
                          destination: place.name,
                          destinationCoords: { latitude: place.latitude, longitude: place.longitude }
                        }))
                      }}
                      placeholder="e.g., Portland, ME or Athens, Greece"
                      className="pl-10 w-full"
                      id="destination"
                    />
                  </div>
                  {formData.destinationCoords.latitude !== 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      📍 {formData.destinationCoords.latitude.toFixed(4)}°, {formData.destinationCoords.longitude.toFixed(4)}°
                    </p>
                  )}
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