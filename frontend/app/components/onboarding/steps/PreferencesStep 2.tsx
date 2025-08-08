'use client'

import { Card } from '../../ui/card'
import { Button } from '../../ui/button'
import { Label } from '../../ui/label'
import { Slider } from '../../ui/slider'
import { Switch } from '../../ui/switch'
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group'
import { ArrowLeft, ArrowRight, Wind, Waves, Moon, Shield } from 'lucide-react'
import type { PassagePreferences } from '../../../../../shared/src/types/boat'

interface PreferencesStepProps {
  data: Partial<PassagePreferences>
  boatType?: string
  onUpdate: (data: Partial<PassagePreferences>) => void
  onNext: () => void
  onPrevious: () => void
}

export function PreferencesStep({ data, boatType, onUpdate, onNext, onPrevious }: PreferencesStepProps) {
  const handleChange = (field: keyof PassagePreferences, value: any) => {
    onUpdate({
      ...data,
      [field]: value
    })
  }

  return (
    <Card className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Set your sailing preferences</h2>
        <p className="text-muted-foreground">
          We'll use these to plan safe and comfortable passages for you
        </p>
      </div>

      <div className="space-y-6">
        {/* Weather Limits */}
        <div>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Wind className="h-5 w-5 text-primary" />
            Weather Limits
          </h3>
          
          <div className="space-y-4">
            {/* Max Wind Speed */}
            <div>
              <div className="flex justify-between mb-2">
                <Label>Maximum Wind Speed</Label>
                <span className="text-sm font-medium">{data.maxWindSpeed || 25} knots</span>
              </div>
              <Slider
                value={[data.maxWindSpeed || 25]}
                onValueChange={([value]) => handleChange('maxWindSpeed', value)}
                min={10}
                max={40}
                step={5}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>10 kts (calm)</span>
                <span>25 kts (moderate)</span>
                <span>40 kts (strong)</span>
              </div>
            </div>

            {/* Max Wave Height */}
            <div>
              <div className="flex justify-between mb-2">
                <Label>Maximum Wave Height</Label>
                <span className="text-sm font-medium">{data.maxWaveHeight || 2}m</span>
              </div>
              <Slider
                value={[data.maxWaveHeight || 2]}
                onValueChange={([value]) => handleChange('maxWaveHeight', value)}
                min={0.5}
                max={5}
                step={0.5}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0.5m</span>
                <span>2.5m</span>
                <span>5m</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sailing Preferences */}
        <div>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Moon className="h-5 w-5 text-primary" />
            Sailing Preferences
          </h3>
          
          <div className="space-y-4">
            {/* Avoid Night Sailing */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="avoid-night">Avoid night sailing</Label>
                <p className="text-sm text-muted-foreground">
                  Plan arrivals during daylight hours
                </p>
              </div>
              <Switch
                id="avoid-night"
                checked={data.avoidNight ?? true}
                onCheckedChange={(checked) => handleChange('avoidNight', checked)}
              />
            </div>

            {/* Prefer Motoring (for sailboats) */}
            {boatType === 'sailboat' && (
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="prefer-motoring">Prefer motoring</Label>
                  <p className="text-sm text-muted-foreground">
                    Use engine when wind is light or contrary
                  </p>
                </div>
                <Switch
                  id="prefer-motoring"
                  checked={data.preferMotoring ?? false}
                  onCheckedChange={(checked) => handleChange('preferMotoring', checked)}
                />
              </div>
            )}

            {/* Max Daily Hours */}
            <div>
              <div className="flex justify-between mb-2">
                <Label>Maximum daily sailing hours</Label>
                <span className="text-sm font-medium">{data.maxDailyHours || 8} hours</span>
              </div>
              <Slider
                value={[data.maxDailyHours || 8]}
                onValueChange={([value]) => handleChange('maxDailyHours', value)}
                min={4}
                max={12}
                step={1}
                className="mt-2"
              />
            </div>
          </div>
        </div>

        {/* Comfort Level */}
        <div>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Comfort Level
          </h3>
          
          <RadioGroup
            value={data.comfortLevel || 'cruising'}
            onValueChange={(value) => handleChange('comfortLevel', value)}
          >
            <div className="space-y-2">
              <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent">
                <RadioGroupItem value="racing" id="racing" className="mt-1" />
                <Label htmlFor="racing" className="cursor-pointer flex-1">
                  <span className="font-medium">Racing</span>
                  <p className="text-sm text-muted-foreground">
                    Optimize for speed, willing to sail in challenging conditions
                  </p>
                </Label>
              </div>
              
              <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent">
                <RadioGroupItem value="cruising" id="cruising" className="mt-1" />
                <Label htmlFor="cruising" className="cursor-pointer flex-1">
                  <span className="font-medium">Cruising</span>
                  <p className="text-sm text-muted-foreground">
                    Balance speed and comfort, avoid rough conditions
                  </p>
                </Label>
              </div>
              
              <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent">
                <RadioGroupItem value="comfort" id="comfort" className="mt-1" />
                <Label htmlFor="comfort" className="cursor-pointer flex-1">
                  <span className="font-medium">Comfort</span>
                  <p className="text-sm text-muted-foreground">
                    Prioritize smooth sailing, only sail in ideal conditions
                  </p>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-8">
        <Button onClick={onPrevious} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext}>
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </Card>
  )
} 