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
import { Textarea } from '../ui/textarea'
import { Ship } from 'lucide-react'

interface AddVesselDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: VesselFormData) => Promise<void>
}

interface VesselFormData {
  name: string
  type: 'sailboat' | 'powerboat' | 'catamaran'
  length: number
  beam?: number
  draft?: number
  registration?: string
  homePort?: string
}

export function AddVesselDialog({ open, onOpenChange, onSubmit }: AddVesselDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<VesselFormData>({
    name: '',
    type: 'sailboat',
    length: 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.length) {
      return
    }

    setLoading(true)
    try {
      await onSubmit(formData)
      // Reset form
      setFormData({
        name: '',
        type: 'sailboat',
        length: 0,
      })
    } catch (error) {
      console.error('Failed to add vessel:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              Add Vessel to Fleet
            </DialogTitle>
            <DialogDescription>
              Add a new vessel to your fleet. You can assign crew members to specific vessels.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Vessel Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Windward"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sailboat">Sailboat</SelectItem>
                    <SelectItem value="powerboat">Powerboat</SelectItem>
                    <SelectItem value="catamaran">Catamaran</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="length">Length (ft) *</Label>
                <Input
                  id="length"
                  type="number"
                  value={formData.length || ''}
                  onChange={(e) => setFormData({ ...formData, length: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 42"
                  step="0.1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="beam">Beam (ft)</Label>
                <Input
                  id="beam"
                  type="number"
                  value={formData.beam || ''}
                  onChange={(e) => setFormData({ ...formData, beam: parseFloat(e.target.value) || undefined })}
                  placeholder="e.g., 14"
                  step="0.1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="draft">Draft (ft)</Label>
                <Input
                  id="draft"
                  type="number"
                  value={formData.draft || ''}
                  onChange={(e) => setFormData({ ...formData, draft: parseFloat(e.target.value) || undefined })}
                  placeholder="e.g., 6.5"
                  step="0.1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="registration">Registration Number</Label>
              <Input
                id="registration"
                value={formData.registration || ''}
                onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
                placeholder="e.g., US1234AB"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="homePort">Home Port</Label>
              <Input
                id="homePort"
                value={formData.homePort || ''}
                onChange={(e) => setFormData({ ...formData, homePort: e.target.value })}
                placeholder="e.g., Boston, MA"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name || !formData.length}>
              {loading ? 'Adding...' : 'Add Vessel'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 