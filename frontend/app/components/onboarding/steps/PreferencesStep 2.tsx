'use client'

import { Label } from '../../ui/label'
import { Slider } from '../../ui/slider'
import { Switch } from '../../ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Wind, Waves, Moon, Bell, AlertTriangle, Mail, Shield } from 'lucide-react'

interface PreferencesStepProps {
  data: any
  onUpdate: (data: any) => void
}

export function PreferencesStep({ data, onUpdate }: PreferencesStepProps) {
  const updatePreference = (key: string, value: any) => {
    onUpdate({
      preferences: {
        ...data.preferences,
        [key]: value,
      },
    })
  }

  const updateNotification = (key: string, value: boolean) => {
    onUpdate({
      preferences: {
        ...data.preferences,
        notificationPreferences: {
          ...data.preferences.notificationPreferences,
          [key]: value,
        },
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Set your sailing preferences</h2>
        <p className="text-muted-foreground">
          We'll use these to suggest safer and more comfortable passages
        </p>
      </div>

      {/* Sailing Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Sailing Conditions</CardTitle>
          <CardDescription>
            Set your comfort levels for various conditions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Night Sailing */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Moon className="h-5 w-5 text-muted-foreground" />
              <Label htmlFor="night-sailing" className="font-normal">
                Avoid night sailing when possible
              </Label>
            </div>
            <Switch
              id="night-sailing"
              checked={data.preferences.avoidNightSailing}
              onCheckedChange={(checked) =>
                updatePreference('avoidNightSailing', checked)
              }
            />
          </div>

          {/* Max Wind Speed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wind className="h-5 w-5 text-muted-foreground" />
                <Label>Maximum wind speed</Label>
              </div>
              <span className="text-sm font-medium">
                {data.preferences.maxWindSpeed} knots
              </span>
            </div>
            <Slider
              value={[data.preferences.maxWindSpeed]}
              onValueChange={([value]) => updatePreference('maxWindSpeed', value)}
              min={10}
              max={40}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10 kt (Light)</span>
              <span>25 kt (Moderate)</span>
              <span>40 kt (Strong)</span>
            </div>
          </div>

          {/* Max Wave Height */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Waves className="h-5 w-5 text-muted-foreground" />
                <Label>Maximum wave height</Label>
              </div>
              <span className="text-sm font-medium">
                {data.preferences.maxWaveHeight} feet
              </span>
            </div>
            <Slider
              value={[data.preferences.maxWaveHeight]}
              onValueChange={([value]) => updatePreference('maxWaveHeight', value)}
              min={2}
              max={12}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>2 ft (Calm)</span>
              <span>6 ft (Moderate)</span>
              <span>12 ft (Rough)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Choose what updates you'd like to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <Label htmlFor="weather-alerts" className="font-normal">
                  Weather alerts
                </Label>
                <p className="text-sm text-muted-foreground">
                  Severe weather warnings for your routes
                </p>
              </div>
            </div>
            <Switch
              id="weather-alerts"
              checked={data.preferences.notificationPreferences.weatherAlerts}
              onCheckedChange={(checked) =>
                updateNotification('weatherAlerts', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="passage-reminders" className="font-normal">
                  Passage reminders
                </Label>
                <p className="text-sm text-muted-foreground">
                  Departure reminders and updates
                </p>
              </div>
            </div>
            <Switch
              id="passage-reminders"
              checked={data.preferences.notificationPreferences.passageReminders}
              onCheckedChange={(checked) =>
                updateNotification('passageReminders', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="safety-updates" className="font-normal">
                  Safety updates
                </Label>
                <p className="text-sm text-muted-foreground">
                  Navigation warnings and safety notices
                </p>
              </div>
            </div>
            <Switch
              id="safety-updates"
              checked={data.preferences.notificationPreferences.safetyUpdates}
              onCheckedChange={(checked) =>
                updateNotification('safetyUpdates', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="marketing" className="font-normal">
                  Product updates
                </Label>
                <p className="text-sm text-muted-foreground">
                  New features and sailing tips
                </p>
              </div>
            </div>
            <Switch
              id="marketing"
              checked={data.preferences.notificationPreferences.marketing}
              onCheckedChange={(checked) =>
                updateNotification('marketing', checked)
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 