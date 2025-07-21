'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { FleetVesselCard } from '../components/fleet/FleetVesselCard'
import { CrewList } from '../components/fleet/CrewList'
import { FleetAnalyticsDashboard } from '../components/fleet/FleetAnalyticsDashboard'
import { CreateFleetDialog } from '../components/fleet/CreateFleetDialog'
import { 
  Ship, 
  Users, 
  BarChart3, 
  Settings,
  Plus,
  Crown,
  Anchor
} from 'lucide-react'
import type { Fleet } from '../../shared/src/types/fleet'

export default function FleetPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [fleet, setFleet] = useState<Fleet | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    // Check if user is Pro tier
    if (user.subscription_tier !== 'pro') {
      router.push('/pricing?upgrade=fleet')
      return
    }

    fetchFleet()
  }, [user, router])

  const fetchFleet = async () => {
    try {
      // TODO: Fetch from API
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch fleet:', error)
      setLoading(false)
    }
  }

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Anchor className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading fleet...</p>
        </div>
      </div>
    )
  }

  if (!fleet) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <Ship className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">Create Your Fleet</h1>
          <p className="text-muted-foreground mb-8">
            Manage multiple vessels, coordinate with crew, and share passage plans across your fleet.
          </p>
          
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-lg p-8 mb-8">
            <h2 className="text-xl font-semibold mb-4">Fleet Management Features</h2>
            <div className="grid md:grid-cols-2 gap-4 text-left">
              <div className="flex gap-3">
                <Ship className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Multi-Vessel Management</p>
                  <p className="text-sm text-muted-foreground">
                    Track and manage all your boats in one place
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Users className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Crew Coordination</p>
                  <p className="text-sm text-muted-foreground">
                    Invite crew and manage permissions
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <BarChart3 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Fleet Analytics</p>
                  <p className="text-sm text-muted-foreground">
                    Track usage and performance metrics
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Settings className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Maintenance Tracking</p>
                  <p className="text-sm text-muted-foreground">
                    Schedule and track vessel maintenance
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Button size="lg" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-5 w-5 mr-2" />
            Create Fleet
          </Button>
        </div>

        <CreateFleetDialog 
          open={showCreateDialog} 
          onOpenChange={setShowCreateDialog}
          onSuccess={(newFleet) => {
            setFleet(newFleet)
            setShowCreateDialog(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Fleet Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl lg:text-3xl font-bold">{fleet.name}</h1>
              <Badge variant="secondary">
                <Crown className="h-3 w-3 mr-1" />
                Pro Fleet
              </Badge>
            </div>
            {fleet.description && (
              <p className="text-muted-foreground">{fleet.description}</p>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/fleet/settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Fleet Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vessels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fleet.vessels.length}</div>
            <p className="text-xs text-muted-foreground">
              {fleet.vessels.filter(v => v.status === 'active').length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Crew
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fleet.crew.length}</div>
            <p className="text-xs text-muted-foreground">
              {fleet.crew.filter(c => c.status === 'active').length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Shared Passages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fleet.sharedPassages.length}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78%</div>
            <p className="text-xs text-muted-foreground">Fleet average</p>
          </CardContent>
        </Card>
      </div>

      {/* Fleet Management Tabs */}
      <Tabs defaultValue="vessels" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="vessels">
            <Ship className="h-4 w-4 mr-2" />
            Vessels
          </TabsTrigger>
          <TabsTrigger value="crew">
            <Users className="h-4 w-4 mr-2" />
            Crew
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vessels" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Fleet Vessels</h2>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Vessel
            </Button>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fleet.vessels.map((vessel) => (
              <FleetVesselCard key={vessel.id} vessel={vessel} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="crew" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Crew Members</h2>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Invite Crew
            </Button>
          </div>
          
          <CrewList crew={fleet.crew} fleetId={fleet.id} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <h2 className="text-xl font-semibold">Fleet Analytics</h2>
          <FleetAnalyticsDashboard fleetId={fleet.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
} 