'use client'

import { Card } from '../../ui/card'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { Sailboat, Ship, ArrowLeft, ArrowRight } from 'lucide-react'
import type { BoatProfile } from '../../../../../shared/src/types/boat'

interface BoatSetupStepProps {
  data: Partial<BoatProfile>
  onUpdate: (data: Partial<BoatProfile>) => void
  onNext: () => void
  onPrevious: () => void
}

export function BoatSetupStep({ data, onUpdate, onNext, onPrevious }: BoatSetupStepProps) {
  const handleChange = (field: keyof BoatProfile, value: any) => {
    onUpdate({
      ...data,
      [field]: value
    })
  }

  const isValid = () => {
    return data.name && data.type && data.length && data.draft
  }

  return (
    <Card className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Tell us about your boat</h2>
        <p className="text-muted-foreground">
          This helps us provide accurate passage planning for your vessel
        </p>
      </div>

      <div className="space-y-6">
        {/* Boat name */}
        <div>
          <Label htmlFor="boat-name">Boat Name *</Label>
          <Input
            id="boat-name"
            placeholder="e.g., Serenity"
            value={data.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            className="mt-1"
          />
        </div>

        {/* Boat type */}
        <div>
          <Label htmlFor="boat-type">Boat Type *</Label>
          <Tabs 
            value={data.type || 'sailboat'} 
            onValueChange={(value) => handleChange('type', value)}
            className="mt-1"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="sailboat" className="flex items-center gap-1">
                <Sailboat className="h-4 w-4" />
                <span className="hidden sm:inline">Sailboat</span>
              </TabsTrigger>
              <TabsTrigger value="motorboat" className="flex items-center gap-1">
                <Ship className="h-4 w-4" />
                <span className="hidden sm:inline">Motorboat</span>
              </TabsTrigger>
              <TabsTrigger value="catamaran">Catamaran</TabsTrigger>
              <TabsTrigger value="trimaran">Trimaran</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Length */}
          <div>
            <Label htmlFor="boat-length">Length (feet) *</Label>
            <Input
              id="boat-length"
              type="number"
              placeholder="35"
              value={data.length || ''}
              onChange={(e) => handleChange('length', parseFloat(e.target.value))}
              className="mt-1"
            />
          </div>

          {/* Draft */}
          <div>
            <Label htmlFor="boat-draft">Draft (feet) *</Label>
            <Input
              id="boat-draft"
              type="number"
              placeholder="5"
              value={data.draft || ''}
              onChange={(e) => handleChange('draft', parseFloat(e.target.value))}
              className="mt-1"
            />
          </div>
        </div>

        {/* Sail configuration (for sailboats) */}
        {(data.type === 'sailboat' || data.type === 'catamaran' || data.type === 'trimaran') && (
          <div>
            <Label htmlFor="sail-config">Sail Configuration</Label>
            <Select 
              value={data.sailConfiguration || ''} 
              onValueChange={(value) => handleChange('sailConfiguration', value)}
            >
              <SelectTrigger id="sail-config" className="mt-1">
                <SelectValue placeholder="Select sail configuration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sloop">Sloop</SelectItem>
                <SelectItem value="cutter">Cutter</SelectItem>
                <SelectItem value="ketch">Ketch</SelectItem>
                <SelectItem value="yawl">Yawl</SelectItem>
                <SelectItem value="schooner">Schooner</SelectItem>
                <SelectItem value="cat">Cat Rig</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Engine type (for motorboats) */}
        {data.type === 'motorboat' && (
          <div>
            <Label htmlFor="engine-type">Engine Type</Label>
            <Select 
              value={data.engineType || ''} 
              onValueChange={(value) => handleChange('engineType', value)}
            >
              <SelectTrigger id="engine-type" className="mt-1">
                <SelectValue placeholder="Select engine type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inboard">Inboard</SelectItem>
                <SelectItem value="outboard">Outboard</SelectItem>
                <SelectItem value="inboard/outboard">Inboard/Outboard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Beam */}
          <div>
            <Label htmlFor="boat-beam">Beam (feet)</Label>
            <Input
              id="boat-beam"
              type="number"
              placeholder="12"
              value={data.beam || ''}
              onChange={(e) => handleChange('beam', parseFloat(e.target.value))}
              className="mt-1"
            />
          </div>

          {/* Cruising speed */}
          <div>
            <Label htmlFor="cruising-speed">Cruising Speed (knots)</Label>
            <Input
              id="cruising-speed"
              type="number"
              placeholder="6"
              value={data.cruisingSpeed || ''}
              onChange={(e) => handleChange('cruisingSpeed', parseFloat(e.target.value))}
              className="mt-1"
            />
          </div>
        </div>

        {/* Optional details */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-3">
            Optional: Add more details for better planning
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                placeholder="e.g., Beneteau"
                value={data.manufacturer || ''}
                onChange={(e) => handleChange('manufacturer', e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                placeholder="e.g., Oceanis 35"
                value={data.model || ''}
                onChange={(e) => handleChange('model', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-8">
        <Button onClick={onPrevious} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!isValid()}>
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </Card>
  )
} 