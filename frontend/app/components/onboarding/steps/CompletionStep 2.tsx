'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { CheckCircle2, Sailboat, Compass, Settings, Sparkles } from 'lucide-react'

interface CompletionStepProps {
  data: any
}

export function CompletionStep({ data }: CompletionStepProps) {
  const experienceLabels = {
    beginner: 'Beginner Sailor',
    intermediate: 'Intermediate Sailor',
    advanced: 'Advanced Sailor',
    professional: 'Professional Captain',
  }

  const boatTypeIcons = {
    sailboat: '⛵',
    powerboat: '🚤',
    catamaran: '⛵',
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">You're all set!</h2>
        <p className="text-muted-foreground">
          Here's your profile summary
        </p>
      </div>

      {/* Profile Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sailboat className="h-5 w-5" />
            Your Vessel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.boatName && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">
                {boatTypeIcons[data.boatType]} {data.boatName}
              </span>
            </div>
          )}
          {data.boatType && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="secondary">
                {data.boatType.charAt(0).toUpperCase() + data.boatType.slice(1)}
              </Badge>
            </div>
          )}
          {data.boatLength && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Length</span>
              <span className="font-medium">{data.boatLength} feet</span>
            </div>
          )}
          {data.homePort && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Home Port</span>
              <span className="font-medium">{data.homePort}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Experience & Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Compass className="h-5 w-5" />
            Experience & Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.sailingExperience && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Experience Level</span>
              <Badge>{experienceLabels[data.sailingExperience]}</Badge>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Night Sailing</span>
            <span className="font-medium">
              {data.preferences.avoidNightSailing ? 'Prefer to avoid' : 'Comfortable with'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Max Wind</span>
            <span className="font-medium">{data.preferences.maxWindSpeed} knots</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Max Waves</span>
            <span className="font-medium">{data.preferences.maxWaveHeight} feet</span>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            You'll receive these updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.preferences.notificationPreferences.weatherAlerts && (
              <Badge variant="outline">Weather Alerts</Badge>
            )}
            {data.preferences.notificationPreferences.passageReminders && (
              <Badge variant="outline">Passage Reminders</Badge>
            )}
            {data.preferences.notificationPreferences.safetyUpdates && (
              <Badge variant="outline">Safety Updates</Badge>
            )}
            {data.preferences.notificationPreferences.marketing && (
              <Badge variant="outline">Product Updates</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ready to set sail?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Click "Start Planning" below to create your first passage plan. 
            Our AI agents are standing by to help you plan the perfect voyage!
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 