'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Checkbox } from '../ui/checkbox'
import { ScrollArea } from '../ui/scroll-area'
import { Share2, Route, Calendar, Ship, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { FleetVessel, CrewMember } from '@/types/shared'

interface SharePassageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fleetId: string
  vessels: FleetVessel[]
  members: CrewMember[]
}

interface UserPassage {
  id: string
  departure: string
  destination: string
  departureTime: string
  distance?: number
  createdAt: string
}

export function SharePassageDialog({ 
  open, 
  onOpenChange, 
  fleetId,
  vessels,
  members 
}: SharePassageDialogProps) {
  const [loading, setLoading] = useState(false)
  const [passages, setPassages] = useState<UserPassage[]>([])
  const [selectedPassage, setSelectedPassage] = useState<string>('')
  const [selectedVessels, setSelectedVessels] = useState<string[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [shareWithAll, setShareWithAll] = useState(true)

  useEffect(() => {
    if (open) {
      fetchUserPassages()
    }
  }, [open])

  const fetchUserPassages = async () => {
    try {
      const response = await fetch('/api/passages', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setPassages(data.passages || [])
      }
    } catch (error) {
      console.error('Failed to fetch passages:', error)
      toast.error('Failed to load passages')
    }
  }

  const handleSubmit = async () => {
    if (!selectedPassage) {
      toast.error('Please select a passage to share')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/fleet/${fleetId}/passages/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          passageId: selectedPassage,
          vesselIds: shareWithAll ? undefined : selectedVessels,
          memberIds: shareWithAll ? undefined : selectedMembers,
        })
      })

      if (!response.ok) {
        throw new Error('Failed to share passage')
      }

      toast.success('Passage shared successfully!')
      onOpenChange(false)
      
      // Reset form
      setSelectedPassage('')
      setSelectedVessels([])
      setSelectedMembers([])
      setShareWithAll(true)
    } catch (error) {
      toast.error('Failed to share passage')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Passage with Fleet
          </DialogTitle>
          <DialogDescription>
            Share one of your passage plans with your fleet members
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Passage</Label>
            <Select value={selectedPassage} onValueChange={setSelectedPassage}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a passage to share" />
              </SelectTrigger>
              <SelectContent>
                {passages.map((passage) => (
                  <SelectItem key={passage.id} value={passage.id}>
                    <div className="flex items-center gap-2">
                      <Route className="h-4 w-4" />
                      <span>
                        {passage.departure} → {passage.destination}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        ({formatDate(passage.departureTime)})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="shareWithAll"
                checked={shareWithAll}
                onCheckedChange={(checked) => setShareWithAll(checked as boolean)}
              />
              <Label htmlFor="shareWithAll">
                Share with entire fleet
              </Label>
            </div>
          </div>

          {!shareWithAll && (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Ship className="h-4 w-4" />
                  Select Vessels
                </Label>
                <ScrollArea className="h-32 border rounded-md p-3">
                  {vessels.map((vessel) => (
                    <div key={vessel.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`vessel-${vessel.id}`}
                        checked={selectedVessels.includes(vessel.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedVessels([...selectedVessels, vessel.id])
                          } else {
                            setSelectedVessels(selectedVessels.filter(id => id !== vessel.id))
                          }
                        }}
                      />
                      <Label htmlFor={`vessel-${vessel.id}`} className="font-normal cursor-pointer">
                        {vessel.name} {vessel.callSign && `(${vessel.callSign})`}
                      </Label>
                    </div>
                  ))}
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Select Crew Members
                </Label>
                <ScrollArea className="h-32 border rounded-md p-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`member-${member.id}`}
                        checked={selectedMembers.includes(member.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedMembers([...selectedMembers, member.id])
                          } else {
                            setSelectedMembers(selectedMembers.filter(id => id !== member.id))
                          }
                        }}
                      />
                      <Label htmlFor={`member-${member.id}`} className="font-normal cursor-pointer">
                        {member.name} ({member.role})
                      </Label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !selectedPassage}
          >
            {loading ? 'Sharing...' : 'Share Passage'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 