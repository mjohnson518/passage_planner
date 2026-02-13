'use client'

import { Label } from '../../ui/label'
import { Input } from '../../ui/input'
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group'
import { Card, CardContent } from '../../ui/card'
import { Sailboat, Anchor, Ship } from 'lucide-react'

export interface BoatSetupStepProps {
  data: any
  onUpdate: (data: any) => void
  onNext?: () => void
  onPrevious?: () => void
}

const boatTypes = [
  {
    value: 'sailboat',
    label: 'Sailboat',
    icon: Sailboat,
    description: 'Monohull sailing vessel',
  },
  {
    value: 'powerboat',
    label: 'Powerboat',
    icon: Ship,
    description: 'Motor-powered vessel',
  },
  {
    value: 'catamaran',
    label: 'Catamaran',
    icon: Anchor,
    description: 'Multi-hull sailing vessel',
  },
]

const experienceLevels = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'New to sailing or limited experience',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'Comfortable with day sailing and short passages',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Experienced with offshore and overnight passages',
  },
  {
    value: 'professional',
    label: 'Professional',
    description: 'Licensed captain or extensive blue water experience',
  },
]

export function BoatSetupStep({ data, onUpdate, onNext, onPrevious }: BoatSetupStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Tell us about your vessel</h2>
        <p className="text-muted-foreground">
          This helps us provide better passage recommendations
        </p>
      </div>

      {/* Boat Type Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Vessel Type</Label>
        <RadioGroup
          value={data.boatType || ''}
          onValueChange={(value) => onUpdate({ boatType: value })}
        >
          <div className="grid gap-3">
            {boatTypes.map((type) => {
              const Icon = type.icon
              return (
                <label
                  key={type.value}
                  htmlFor={type.value}
                  className="cursor-pointer"
                >
                  <Card
                    className={`transition-all ${
                      data.boatType === type.value
                        ? 'ring-2 ring-primary'
                        : 'hover:shadow-md'
                    }`}
                  >
                    <CardContent className="flex items-center p-4">
                      <RadioGroupItem
                        value={type.value}
                        id={type.value}
                        className="sr-only"
                      />
                      <Icon className="h-6 w-6 mr-3 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium">{type.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {type.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </label>
              )
            })}
          </div>
        </RadioGroup>
      </div>

      {/* Boat Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="boatName">Vessel Name</Label>
          <Input
            id="boatName"
            value={data.boatName || ''}
            onChange={(e) => onUpdate({ boatName: e.target.value })}
            placeholder="e.g., Serenity"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="boatLength">Length (feet)</Label>
          <Input
            id="boatLength"
            type="number"
            value={data.boatLength || ''}
            onChange={(e) =>
              onUpdate({ boatLength: parseFloat(e.target.value) || undefined })
            }
            placeholder="e.g., 40"
            step="0.1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="boatDraft">Draft (feet) *</Label>
          <Input
            id="boatDraft"
            type="number"
            value={data.boatDraft || ''}
            onChange={(e) =>
              onUpdate({ boatDraft: parseFloat(e.target.value) || undefined })
            }
            placeholder="e.g., 5.5"
            step="0.1"
            min="0.5"
            max="40"
          />
          <p className="text-xs text-muted-foreground">
            Critical for safety — used for under-keel clearance calculations
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="boatBeam">Beam (feet)</Label>
          <Input
            id="boatBeam"
            type="number"
            value={data.boatBeam || ''}
            onChange={(e) =>
              onUpdate({ boatBeam: parseFloat(e.target.value) || undefined })
            }
            placeholder="e.g., 12"
            step="0.1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fuelCapacity">Fuel Capacity (gallons)</Label>
          <Input
            id="fuelCapacity"
            type="number"
            value={data.fuelCapacity || ''}
            onChange={(e) =>
              onUpdate({ fuelCapacity: parseFloat(e.target.value) || undefined })
            }
            placeholder="e.g., 80"
            step="1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="waterCapacity">Water Capacity (gallons)</Label>
          <Input
            id="waterCapacity"
            type="number"
            value={data.waterCapacity || ''}
            onChange={(e) =>
              onUpdate({ waterCapacity: parseFloat(e.target.value) || undefined })
            }
            placeholder="e.g., 100"
            step="1"
          />
        </div>
      </div>

      {/* Home Port */}
      <div className="space-y-2">
        <Label htmlFor="homePort">Home Port</Label>
        <Input
          id="homePort"
          value={data.homePort || ''}
          onChange={(e) => onUpdate({ homePort: e.target.value })}
          placeholder="e.g., Boston, MA"
        />
        <p className="text-sm text-muted-foreground">
          Your primary sailing location
        </p>
      </div>

      {/* Experience Level */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Sailing Experience</Label>
        <RadioGroup
          value={data.sailingExperience || ''}
          onValueChange={(value) => onUpdate({ sailingExperience: value })}
        >
          <div className="grid gap-3">
            {experienceLevels.map((level) => (
              <label
                key={level.value}
                htmlFor={`exp-${level.value}`}
                className="cursor-pointer"
              >
                <Card
                  className={`transition-all ${
                    data.sailingExperience === level.value
                      ? 'ring-2 ring-primary'
                      : 'hover:shadow-md'
                  }`}
                >
                  <CardContent className="flex items-center p-4">
                    <RadioGroupItem
                      value={level.value}
                      id={`exp-${level.value}`}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{level.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {level.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </label>
            ))}
          </div>
        </RadioGroup>
      </div>

      {(onPrevious || onNext) && (
        <div className="flex justify-between pt-4">
          <button className="btn btn-outline" onClick={onPrevious} disabled={!onPrevious}>Back</button>
          <button className="btn btn-primary" onClick={onNext} disabled={!onNext}>Continue</button>
        </div>
      )}
    </div>
  )
} 