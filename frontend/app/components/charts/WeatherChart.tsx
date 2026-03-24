'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { useChartColors } from '@/lib/chart-colors'

interface WeatherDataPoint {
  time: string | Date
  windSpeed?: number
  windGust?: number
  waveHeight?: number
  temperature?: number
  pressure?: number
}

interface WeatherChartProps {
  data?: WeatherDataPoint[]
  showWind?: boolean
  showWaves?: boolean
  showTemperature?: boolean
  showPressure?: boolean
}

export default function WeatherChart({
  data = [],
  showWind = true,
  showWaves = true,
  showTemperature = false,
  showPressure = false
}: WeatherChartProps) {
  const colors = useChartColors()

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[300px] bg-muted/20 rounded-lg flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No weather data available
        </p>
      </div>
    )
  }

  const chartData = data.map(point => ({
    ...point,
    time: typeof point.time === 'string'
      ? point.time
      : format(new Date(point.time), 'HH:mm')
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="time"
          className="text-xs"
          tick={{ fontSize: 12 }}
        />
        <YAxis
          className="text-xs"
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
        />
        <Legend />

        {showWind && (
          <>
            <Line
              type="monotone"
              dataKey="windSpeed"
              stroke={colors.primary}
              name="Wind Speed (kt)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="windGust"
              stroke={colors.primary}
              name="Gusts (kt)"
              strokeWidth={1}
              strokeDasharray="5 5"
              strokeOpacity={0.6}
              dot={{ r: 2 }}
            />
          </>
        )}

        {showWaves && (
          <Line
            type="monotone"
            dataKey="waveHeight"
            stroke={colors.secondary}
            name="Wave Height (ft)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        )}

        {showTemperature && (
          <Line
            type="monotone"
            dataKey="temperature"
            stroke={colors.tertiary}
            name="Temperature (°F)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        )}

        {showPressure && (
          <Line
            type="monotone"
            dataKey="pressure"
            stroke={colors.quaternary}
            name="Pressure (mb)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
