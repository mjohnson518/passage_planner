'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { CreateFleetDialog } from '../components/fleet/CreateFleetDialog'
import { FleetVesselCard } from '../components/fleet/FleetVesselCard'
import { CrewList } from '../components/fleet/CrewList'
import FleetAnalyticsDashboard from '../components/fleet/FleetAnalyticsDashboard'
import { InviteCrewDialog } from '../components/fleet/InviteCrewDialog'
import { AddVesselDialog } from '../components/fleet/AddVesselDialog'
import { SharePassageDialog } from '../components/fleet/SharePassageDialog'
import { 
  Anchor, 
  Ship, 
  Users, 
  BarChart3, 
  Plus,
  Settings,
  Share2,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

// Fleet types (TODO: Import from shared package when available)
interface Fleet {
  id: string
  name: string
  description?: string
  owner_id: string
  created_at: string
  updated_at: string
  role?: 'owner' | 'admin' | 'captain' | 'member' | 'viewer'
}

interface FleetMember {
  id: string
  fleet_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_at: string
}

interface FleetVessel {
  id: string
  fleet_id: string
  vessel_id: string
  added_at: string
}

export default function FleetPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [fleet, setFleet] = useState<Fleet | null>(null)
  const [vessels, setVessels] = useState<FleetVessel[]>([])
  const [members, setMembers] = useState<FleetMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showAddVesselDialog, setShowAddVesselDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [activeTab, setActiveTab] = useState('vessels')

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    // Check if user is Pro tier
    const userTier = (user as any)?.subscription_tier || (user as any)?.user_metadata?.subscription_tier
    if (userTier !== 'pro' && userTier !== 'enterprise') {
      router.push('/pricing?upgrade=fleet')
      return
    }

    fetchFleet()
  }, [user, router])

  const fetchFleet = async () => {
    try {
      const response = await fetch('/api/fleet', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      if (response.status === 404) {
        // No fleet exists yet
        setLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch fleet')
      }

      const fleetData = await response.json()
      setFleet(fleetData)
      
      // Fetch vessels and members
      await Promise.all([
        fetchVessels(fleetData.id),
        fetchMembers(fleetData.id)
      ])
    } catch (error) {
      console.error('Failed to fetch fleet:', error)
      toast.error('Failed to load fleet data')
    } finally {
      setLoading(false)
    }
  }

  const fetchVessels = async (fleetId: string) => {
    try {
      const response = await fetch(`/api/fleet/${fleetId}/vessels`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      if (response.ok) {
        const vesselsData = await response.json()
        setVessels(vesselsData)
      }
    } catch (error) {
      console.error('Failed to fetch vessels:', error)
    }
  }

  const fetchMembers = async (fleetId: string) => {
    try {
      const response = await fetch(`/api/fleet/${fleetId}/members`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      if (response.ok) {
        const membersData = await response.json()
        setMembers(membersData)
      }
    } catch (error) {
      console.error('Failed to fetch members:', error)
    }
  }

  const handleCreateFleet = async (name: string, description?: string) => {
    try {
      const response = await fetch('/api/fleet/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ name, description })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create fleet')
      }

      const newFleet = await response.json()
      setFleet(newFleet)
      setShowCreateDialog(false)
      toast.success('Fleet created successfully!')
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleAddVessel = async (vesselData: any) => {
    if (!fleet) return

    try {
      const response = await fetch(`/api/fleet/${fleet.id}/vessels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(vesselData)
      })

      if (!response.ok) {
        throw new Error('Failed to add vessel')
      }

      const newVessel = await response.json()
      setVessels([...vessels, newVessel])
      setShowAddVesselDialog(false)
      toast.success('Vessel added successfully!')
    } catch (error) {
      toast.error('Failed to add vessel')
    }
  }

  const handleInviteCrew = async (email: string, role: string, vesselIds?: string[]) => {
    if (!fleet) return

    try {
      const response = await fetch(`/api/fleet/${fleet.id}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ email, role, vesselIds })
      })

      if (!response.ok) {
        throw new Error('Failed to send invitation')
      }

      setShowInviteDialog(false)
      toast.success('Invitation sent successfully!')
    } catch (error) {
      toast.error('Failed to send invitation')
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
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <Anchor className="h-16 w-16 text-primary mx-auto mb-4" />
              <CardTitle className="text-2xl">Create Your Fleet</CardTitle>
              <CardDescription>
                Manage multiple vessels and coordinate with your crew
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-6">
                Set up your fleet to track vessels, invite crew members, and share passage plans.
              </p>
              <Button size="lg" onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-5 w-5" />
                Create Fleet
              </Button>
            </CardContent>
          </Card>
        </div>

        <CreateFleetDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={(fleet) => {
            setFleet(fleet)
            setShowCreateDialog(false)
            toast.success('Fleet created successfully')
          }}
        />
      </div>
    )
  }

  const isAdmin = fleet.role === 'admin'
  const canManage = fleet.role === 'admin' || fleet.role === 'captain'

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">{fleet.name}</h1>
          {fleet.description && (
            <p className="text-muted-foreground">{fleet.description}</p>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowShareDialog(true)}>
            <Share2 className="mr-2 h-4 w-4" />
            Share Passage
          </Button>
          {isAdmin && (
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vessels">
            <Ship className="mr-2 h-4 w-4" />
            Vessels ({vessels.length})
          </TabsTrigger>
          <TabsTrigger value="crew">
            <Users className="mr-2 h-4 w-4" />
            Crew ({members.length})
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vessels" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Fleet Vessels</h2>
            {canManage && (
              <Button onClick={() => setShowAddVesselDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Vessel
              </Button>
            )}
          </div>

          {vessels.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Ship className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No vessels in your fleet yet</p>
                {canManage && (
                  <Button onClick={() => setShowAddVesselDialog(true)}>
                    Add Your First Vessel
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {vessels.map((vessel) => (
                <FleetVesselCard
                  key={vessel.id}
                  vessel={vessel}
                  canEdit={canManage}
                  onUpdate={() => fetchVessels(fleet.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="crew" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Crew Members</h2>
            {isAdmin && (
              <Button onClick={() => setShowInviteDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Invite Crew
              </Button>
            )}
          </div>

          <CrewList
            members={members}
            vessels={vessels}
            isAdmin={isAdmin}
            onUpdate={() => fetchMembers(fleet.id)}
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <FleetAnalyticsDashboard
            fleetId={fleet.id}
            vessels={vessels}
            members={members}
          />
        </TabsContent>
      </Tabs>

      <AddVesselDialog
        open={showAddVesselDialog}
        onOpenChange={setShowAddVesselDialog}
        onSubmit={handleAddVessel}
      />

      <InviteCrewDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        vessels={vessels}
        onSubmit={handleInviteCrew}
      />

      <SharePassageDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        fleetId={fleet.id}
        vessels={vessels}
        members={members}
      />
    </div>
  )
} 