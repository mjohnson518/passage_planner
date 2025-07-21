import { Card } from '../../ui/card'
import { Button } from '../../ui/button'
import { ArrowLeft, ArrowRight, MapPin, Calendar, Settings, Download } from 'lucide-react'

interface TutorialStepProps {
  onNext: () => void
  onPrevious: () => void
}

export function TutorialStep({ onNext, onPrevious }: TutorialStepProps) {
  const steps = [
    {
      icon: MapPin,
      number: '1',
      title: 'Enter your route',
      description: 'Simply type your departure and destination ports. You can also add waypoints for specific routes.'
    },
    {
      icon: Calendar,
      number: '2',
      title: 'Choose departure time',
      description: 'Select when you want to leave. We'll check weather, tides, and daylight for the best conditions.'
    },
    {
      icon: Settings,
      number: '3',
      title: 'Review & adjust',
      description: 'See your complete passage plan with weather, waypoints, and timing. Make adjustments as needed.'
    },
    {
      icon: Download,
      number: '4',
      title: 'Export & go',
      description: 'Download your plan as GPX for your chartplotter, or PDF for printing. Share with your crew.'
    }
  ]

  return (
    <Card className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">How to plan a passage</h2>
        <p className="text-muted-foreground">
          Planning a safe passage is easy with our intelligent system
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {steps.map((step, index) => (
          <div key={index} className="flex gap-4 p-4 rounded-lg bg-muted/30">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <span className="text-primary">Step {step.number}:</span>
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 mb-6">
        <h4 className="font-semibold mb-2">💡 Pro Tips</h4>
        <ul className="text-sm space-y-1">
          <li>• Check weather 24-48 hours before departure for the most accurate forecast</li>
          <li>• Save frequently used routes as templates for quick planning</li>
          <li>• Use the "avoid night sailing" option if you prefer daylight arrivals</li>
          <li>• Share your plan with someone ashore for safety</li>
        </ul>
      </div>

      <div className="text-center mb-6">
        <p className="text-sm text-muted-foreground">
          After setup, we'll show you a demo passage so you can see everything in action!
        </p>
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
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