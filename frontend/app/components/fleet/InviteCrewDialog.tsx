'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Checkbox } from '../ui/checkbox'
import { Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { CrewMember, FleetVessel } from '@passage-planner/shared'

interface InviteCrewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fleetId: string
  vessels: FleetVessel[]
}

export function InviteCrewDialog({ open, onOpenChange, fleetId, vessels }: InviteCrewDialogProps) {
  const [loading, setLoading] = useState(false)
  const [invites, setInvites] = useState([{
    email: '',
    name: '',
    role: 'crew' as CrewMember['role'],
    vessels: [] as string[],
    permissions: {
      canViewPassages: true,
      canCreatePassages: false,
      canEditPassages: false,
      canManageVessels: false,
      canInviteCrew: false,
      canViewFleetAnalytics: false
    }
  }])

  const addInvite = () => {
    setInvites([...invites, {
      email: '',
      name: '',
      role: 'crew' as CrewMember['role'],
      vessels: [],
      permissions: {
        canViewPassages: true,
        canCreatePassages: false,
        canEditPassages: false,
        canManageVessels: false,
        canInviteCrew: false,
        canViewFleetAnalytics: false
      }
    }])
  }

  const removeInvite = (index: number) => {
    setInvites(invites.filter((_, i) => i !== index))
  }

  const updateInvite = (index: number, updates: any) => {
    const newInvites = [...invites]
    newInvites[index] = { ...newInvites[index], ...updates }
    
    // Auto-set permissions based on role
    if (updates.role) {
      switch (updates.role) {
        case 'captain':
          newInvites[index].permissions = {
            canViewPassages: true,
            canCreatePassages: true,
            canEditPassages: true,
            canManageVessels: true,
            canInviteCrew: true,
            canViewFleetAnalytics: true
          }
          break
        case 'skipper':
          newInvites[index].permissions = {
            canViewPassages: true,
            canCreatePassages: true,
            canEditPassages: true,
            canManageVessels: false,
            canInviteCrew: false,
            canViewFleetAnalytics: true
          }
          break
        case 'crew':
          newInvites[index].permissions = {
            canViewPassages: true,
            canCreatePassages: false,
            canEditPassages: false,
            canManageVessels: false,
            canInviteCrew: false,
            canViewFleetAnalytics: false
          }
          break
        case 'guest':
          newInvites[index].permissions = {
            canViewPassages: true,
            canCreatePassages: false,
            canEditPassages: false,
            canManageVessels: false,
            canInviteCrew: false,
            canViewFleetAnalytics: false
          }
          break
      }
    }
    
    setInvites(newInvites)
  }

  const handleSubmit = async () => {
    // Validate
    const validInvites = invites.filter(invite => invite.email && invite.name)
    if (validInvites.length === 0) {
      toast.error('Please fill in at least one invitation')
      return
    }

    setLoading(true)
    try {
      // TODO: Call API to send invitations
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast.success(`${validInvites.length} invitation${validInvites.length > 1 ? 's' : ''} sent!`)
      onOpenChange(false)
      
      // Reset form
      setInvites([{
        email: '',
        name: '',
        role: 'crew' as CrewMember['role'],
        vessels: [],
        permissions: {
          canViewPassages: true,
          canCreatePassages: false,
          canEditPassages: false,
          canManageVessels: false,
          canInviteCrew: false,
          canViewFleetAnalytics: false
        }
      }])
    } catch (error) {
      toast.error('Failed to send invitations')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite Crew Members</DialogTitle>
          <DialogDescription>
            Send invitations to join your fleet. They'll receive an email with instructions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {invites.map((invite, index) => (
            <div key={index} className="space-y-4 p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <h4 className="font-medium">Crew Member {index + 1}</h4>
                {invites.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeInvite(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    placeholder="crew@example.com"
                    value={invite.email}
                    onChange={(e) => updateInvite(index, { email: e.target.value })}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    placeholder="John Doe"
                    value={invite.name}
                    onChange={(e) => updateInvite(index, { name: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select 
                  value={invite.role} 
                  onValueChange={(value) => updateInvite(index, { role: value })}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="captain">Captain</SelectItem>
                    <SelectItem value="skipper">Skipper</SelectItem>
                    <SelectItem value="crew">Crew</SelectItem>
                    <SelectItem value="guest">Guest</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {vessels.length > 0 && (
                <div className="space-y-2">
                  <Label>Vessel Access</Label>
                  <div className="space-y-2">
                    {vessels.map((vessel) => (
                      <div key={vessel.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`vessel-${vessel.id}-${index}`}
                          checked={invite.vessels.includes(vessel.id)}
                          onCheckedChange={(checked) => {
                            const newVessels = checked
                              ? [...invite.vessels, vessel.id]
                              : invite.vessels.filter(v => v !== vessel.id)
                            updateInvite(index, { vessels: newVessels })
                          }}
                          disabled={loading}
                        />
                        <Label 
                          htmlFor={`vessel-${vessel.id}-${index}`}
                          className="font-normal cursor-pointer"
                        >
                          {vessel.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addInvite}
            className="w-full"
            disabled={loading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another
          </Button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Invitations'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 