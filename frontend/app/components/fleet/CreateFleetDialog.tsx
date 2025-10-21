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
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Fleet } from '@/types/shared'

interface CreateFleetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (fleet: Fleet) => void
}

export function CreateFleetDialog({ open, onOpenChange, onSuccess }: CreateFleetDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    settings: {
      defaultPassageSharing: true,
      requireApprovalForPassages: false,
      allowCrewToInvite: false,
      vesselTrackingEnabled: true,
      maintenanceReminders: true
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('Fleet name is required')
      return
    }

    setLoading(true)
    try {
      // TODO: Call API to create fleet
      const mockFleet: Fleet = {
        id: Date.now().toString(),
        ownerId: 'user-id',
        name: formData.name,
        description: formData.description,
        vessels: [],
        crew: [],
        sharedPassages: [],
        settings: formData.settings,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      toast.success('Fleet created successfully!')
      onSuccess(mockFleet)
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        settings: {
          defaultPassageSharing: true,
          requireApprovalForPassages: false,
          allowCrewToInvite: false,
          vesselTrackingEnabled: true,
          maintenanceReminders: true
        }
      })
    } catch (error) {
      toast.error('Failed to create fleet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Fleet</DialogTitle>
            <DialogDescription>
              Set up your fleet to manage multiple vessels and coordinate with crew
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fleet-name">Fleet Name *</Label>
              <Input
                id="fleet-name"
                placeholder="e.g., Pacific Sailing Fleet"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fleet-description">Description (Optional)</Label>
              <Textarea
                id="fleet-description"
                placeholder="Describe your fleet..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                disabled={loading}
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Fleet Settings</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="passage-sharing">Default Passage Sharing</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically share passages with fleet members
                    </p>
                  </div>
                  <Switch
                    id="passage-sharing"
                    checked={formData.settings.defaultPassageSharing}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({
                        ...prev,
                        settings: { ...prev.settings, defaultPassageSharing: checked }
                      }))
                    }
                    disabled={loading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="vessel-tracking">Vessel Tracking</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable real-time vessel location tracking
                    </p>
                  </div>
                  <Switch
                    id="vessel-tracking"
                    checked={formData.settings.vesselTrackingEnabled}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({
                        ...prev,
                        settings: { ...prev.settings, vesselTrackingEnabled: checked }
                      }))
                    }
                    disabled={loading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="maintenance-reminders">Maintenance Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified about scheduled maintenance
                    </p>
                  </div>
                  <Switch
                    id="maintenance-reminders"
                    checked={formData.settings.maintenanceReminders}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({
                        ...prev,
                        settings: { ...prev.settings, maintenanceReminders: checked }
                      }))
                    }
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
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
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Fleet'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 