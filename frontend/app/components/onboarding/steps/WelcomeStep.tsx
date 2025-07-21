import { Button } from '../../ui/button'
import { Card } from '../../ui/card'
import { Sailboat, Compass, MapPin, Wind, Anchor } from 'lucide-react'

interface WelcomeStepProps {
  onNext: () => void
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const features = [
    {
      icon: Compass,
      title: 'Intelligent Route Planning',
      description: 'AI-powered route optimization considering weather, tides, and your preferences'
    },
    {
      icon: Wind,
      title: 'Real-time Weather',
      description: 'Up-to-date forecasts from multiple sources for safe passage planning'
    },
    {
      icon: MapPin,
      title: 'Port Information',
      description: 'Detailed information about marinas, anchorages, and facilities'
    },
    {
      icon: Anchor,
      title: 'Safety First',
      description: 'Navigation warnings, emergency contacts, and safety checklists'
    }
  ]

  return (
    <Card className="p-8">
      <div className="text-center mb-8">
        <Sailboat className="h-16 w-16 mx-auto mb-4 text-primary" />
        <h2 className="text-2xl font-bold mb-2">Welcome aboard! ⛵</h2>
        <p className="text-muted-foreground">
          Let's get you set up for safe and enjoyable passage planning
        </p>
      </div>

      <div className="grid gap-4 mb-8">
        {features.map((feature, index) => (
          <div key={index} className="flex gap-4">
            <div className="flex-shrink-0">
              <feature.icon className="h-5 w-5 text-primary mt-0.5" />
            </div>
            <div>
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 mb-6">
        <p className="text-sm">
          <strong>This quick setup will:</strong>
        </p>
        <ul className="text-sm mt-2 space-y-1 ml-4">
          <li>• Configure your boat details for accurate planning</li>
          <li>• Set your sailing preferences and limits</li>
          <li>• Show you how to plan your first passage</li>
        </ul>
        <p className="text-sm mt-2 text-muted-foreground">
          Takes about 3 minutes to complete
        </p>
      </div>

      <Button onClick={onNext} className="w-full" size="lg">
        Let's Get Started
      </Button>
    </Card>
  )
} 