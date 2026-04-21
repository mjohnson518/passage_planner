import { Button } from "../../ui/button";
import { Sailboat, Compass, MapPin, Wind, Anchor } from "lucide-react";

interface WelcomeStepProps {
  onNext?: () => void;
  userName?: string;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const features = [
    {
      icon: Compass,
      title: "Intelligent Route Planning",
      description:
        "AI-powered route optimization considering weather, tides, and your preferences",
    },
    {
      icon: Wind,
      title: "Real-time Weather",
      description:
        "Up-to-date forecasts from multiple sources for safe passage planning",
    },
    {
      icon: MapPin,
      title: "Port Information",
      description:
        "Detailed information about marinas, anchorages, and facilities",
    },
    {
      icon: Anchor,
      title: "Safety First",
      description:
        "Navigation warnings, emergency contacts, and safety checklists",
    },
  ];

  return (
    <div className="card-nautical p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
          <Sailboat className="h-8 w-8" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-2">
          Welcome aboard! ⛵
        </h2>
        <p className="text-muted-foreground">
          Let&apos;s get you set up for safe and enjoyable passage planning
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
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 mb-6">
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

      <Button onClick={onNext} className="btn-brass w-full h-12" size="lg">
        Let&apos;s Get Started
      </Button>
    </div>
  );
}
