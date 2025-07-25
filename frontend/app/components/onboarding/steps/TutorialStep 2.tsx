'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Map, MessageSquare, FileDown, Users, BarChart3, Zap } from 'lucide-react'

const features = [
  {
    icon: MessageSquare,
    title: 'Natural Language Planning',
    description: 'Simply describe your sailing plans in plain English, and our AI agents will handle the rest.',
    example: '"Plan a passage from Boston to Portland next Tuesday"',
  },
  {
    icon: Map,
    title: 'Interactive Route Map',
    description: 'View your planned route on an interactive map with weather overlays and waypoint details.',
    example: 'Drag waypoints to adjust your route',
  },
  {
    icon: FileDown,
    title: 'Export to Navigation Apps',
    description: 'Download your passage plan as GPX or KML files for use in chartplotters and navigation apps.',
    example: 'Compatible with Navionics, OpenCPN, and more',
  },
  {
    icon: Users,
    title: 'Fleet Management (Pro)',
    description: 'Manage multiple vessels and share passage plans with your crew.',
    example: 'Perfect for sailing clubs and charter companies',
  },
  {
    icon: BarChart3,
    title: 'Weather Analytics',
    description: 'Get detailed weather forecasts with wind, wave, and current predictions.',
    example: '7-day forecasts with 3-hour intervals',
  },
  {
    icon: Zap,
    title: 'Real-time Updates',
    description: 'Receive alerts about weather changes and safety notices for your planned routes.',
    example: 'Push notifications for significant changes',
  },
]

export function TutorialStep() {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Key Features</h2>
        <p className="text-muted-foreground">
          Here's what you can do with Passage Planner
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  {feature.description}
                </p>
                <p className="text-xs italic text-muted-foreground">
                  {feature.example}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-center">Pro Tip</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm">
            Start by planning a familiar route to see how the AI agents work together 
            to create your perfect passage plan. You can always adjust the suggestions!
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 