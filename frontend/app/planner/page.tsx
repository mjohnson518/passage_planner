'use client'

import { useState } from 'react'
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
  X
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Waypoint {
  id: string
  name: string
  lat?: number
  lng?: number
}

export default function PlannerPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('route')
  
  const [formData, setFormData] = useState({
    departure: '',
    destination: '',
    departureDate: new Date(),
    boat: '',
    waypoints: [] as Waypoint[]
  })

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
    try {
      // TODO: Call orchestrator API
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast.success('Passage plan created successfully!')
      router.push('/passages/new-plan-id')
    } catch (error) {
      toast.error('Failed to create passage plan')
    } finally {
      setLoading(false)
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
                <Label htmlFor="boat">Select Boat *</Label>
                <select
                  id="boat"
                  value={formData.boat}
                  onChange={(e) => setFormData(prev => ({ ...prev, boat: e.target.value }))}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Choose your boat...</option>
                  <option value="default">My Default Boat</option>
                </select>
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