'use client'

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface AnalyticsChartProps {
  title: string
  data: any[]
  type?: 'line' | 'bar' | 'pie'
}

export default function AnalyticsChart({ 
  title, 
  data = [], 
  type = 'line' 
}: AnalyticsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full bg-muted/20 rounded-lg flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            {type.charAt(0).toUpperCase() + type.slice(1)} chart visualization
          </p>
        </div>
      </CardContent>
    </Card>
  )
} 