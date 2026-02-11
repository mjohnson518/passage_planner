'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format } from 'date-fns'

interface TideDataPoint {
  time: string | Date
  height: number // feet or meters
  type?: 'high' | 'low' | 'rising' | 'falling'
}

interface TideChartProps {
  data?: TideDataPoint[]
  unit?: 'feet' | 'meters'
  showCurrentTime?: boolean
}

export default function TideChart({ 
  data = [], 
  unit = 'feet',
  showCurrentTime = true
}: TideChartProps) {
  
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[300px] bg-muted/20 rounded-lg flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No tidal data available
        </p>
      </div>
    )
  }

  // Format data for Recharts
  const chartData = data.map(point => ({
    ...point,
    time: typeof point.time === 'string' 
      ? point.time 
      : format(new Date(point.time), 'HH:mm'),
    displayTime: typeof point.time === 'string'
      ? new Date(point.time).getTime()
      : new Date(point.time).getTime()
  }))

  const currentTime = showCurrentTime ? new Date().getTime() : null

  // Calculate min/max for better Y-axis scaling
  const heights = data.map(d => d.height)
  const minHeight = Math.min(...heights)
  const maxHeight = Math.max(...heights)
  const padding = (maxHeight - minHeight) * 0.1

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="tideGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        
        <XAxis 
          dataKey="time" 
          className="text-xs"
          tick={{ fontSize: 12 }}
        />
        
        <YAxis 
          className="text-xs"
          tick={{ fontSize: 12 }}
          domain={[minHeight - padding, maxHeight + padding]}
          label={{ 
            value: `Height (${unit})`, 
            angle: -90, 
            position: 'insideLeft',
            style: { fontSize: 12 }
          }}
        />
        
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
          labelFormatter={(value) => `Time: ${value}`}
          formatter={(value: any, name: string) => {
            if (name === 'height') {
              return [`${value.toFixed(2)} ${unit}`, 'Tide Height']
            }
            return [value, name]
          }}
        />
        
        {showCurrentTime && currentTime && (
          <ReferenceLine 
            x={currentTime} 
            stroke="#ef4444" 
            strokeDasharray="3 3"
            label={{ value: 'Now', position: 'top', fontSize: 12 }}
          />
        )}
        
        <Area 
          type="monotone" 
          dataKey="height" 
          stroke="#06b6d4" 
          strokeWidth={2}
          fill="url(#tideGradient)"
          dot={(props: any) => {
            const { cx, cy, payload } = props
            if (!payload.type) return <circle r={0} />

            return (
              <circle
                cx={cx}
                cy={cy}
                r={4}
                fill={payload.type === 'high' ? '#22c55e' : '#ef4444'}
                stroke="white"
                strokeWidth={2}
              />
            )
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
