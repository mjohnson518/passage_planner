import { Card } from '../../ui/card'
import { Button } from '../../ui/button'
import { ArrowLeft, CheckCircle, Sailboat, Compass, Star } from 'lucide-react'
import type { OnboardingData } from '../OnboardingFlow'

interface CompletionStepProps {
  data: OnboardingData
  onComplete: () => void
  onPrevious: () => void
}

export function CompletionStep({ data, onComplete, onPrevious }: CompletionStepProps) {
  return (
    <Card className="p-8">
      <div className="text-center mb-8">
        <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
        <h2 className="text-2xl font-bold mb-2">You're all set! 🎉</h2>
        <p className="text-muted-foreground">
          {data.boat.name} is ready for safe passage planning
        </p>
      </div>

      {/* Summary */}
      <div className="bg-muted/30 rounded-lg p-6 mb-6">
        <h3 className="font-semibold mb-4">Your setup summary:</h3>
        
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Sailboat className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">{data.boat.name}</p>
              <p className="text-sm text-muted-foreground">
                {data.boat.length}ft {data.boat.type}, {data.boat.draft}ft draft
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Compass className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Weather limits</p>
              <p className="text-sm text-muted-foreground">
                Max wind: {data.preferences.maxWindSpeed} kts, 
                Max waves: {data.preferences.maxWaveHeight}m
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Star className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Comfort level</p>
              <p className="text-sm text-muted-foreground capitalize">
                {data.preferences.comfortLevel} mode
                {data.preferences.avoidNight && ', avoiding night sailing'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* What's next */}
      <div className="mb-8">
        <h3 className="font-semibold mb-3">What happens next?</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>We'll take you to your dashboard to plan your first passage</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>Try our demo route from Boston to Portland to see all features</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>You can update your boat and preferences anytime in settings</span>
          </li>
        </ul>
      </div>

      {/* Trial info */}
      <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 mb-6">
        <p className="text-sm">
          <strong>🎁 Your 14-day free trial has started!</strong>
        </p>
        <p className="text-sm mt-1">
          Explore all features including weather routing, tide calculations, and passage optimization. 
          No credit card required.
        </p>
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button onClick={onPrevious} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onComplete} size="lg" className="px-8">
          Start Planning Passages
        </Button>
      </div>
    </Card>
  )
} 