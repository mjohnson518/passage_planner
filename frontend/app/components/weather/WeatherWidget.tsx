'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Skeleton } from '../ui/skeleton'
import { Button } from '../ui/button'
import { 
  Cloud, 
  Wind, 
  Droplets, 
  Waves, 
  Sun, 
  CloudRain,
  CloudSnow,
  CloudDrizzle,
  Navigation,
  RefreshCw,
  MapPin
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { deduplicatedFetch } from '../../lib/performance'

interface WeatherData {
  location: string
  current: {
    temperature: number
    feelsLike: number
    condition: string
    icon: 'sun' | 'cloud' | 'rain' | 'snow' | 'drizzle'
    wind: {
      speed: number
      direction: string
      degrees: number
    }
    humidity: number
    pressure: number
    visibility: number
    uvIndex: number
  }
  marine: {
    waveHeight: number
    wavePeriod: number
    waterTemp: number
    swellDirection: string
  }
  forecast: Array<{
    time: string
    temperature: number
    condition: string
    windSpeed: number
    precipitation: number
  }>
}

export function WeatherWidget() {
  const { user, session } = useAuth()
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    if (user && session) {
      loadWeatherData()
    }
  }, [user, session])

  const loadWeatherData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get user's default location or use Boston as fallback
      const location = 'Boston, MA' // TODO: Get from user profile
      
      const data = await deduplicatedFetch(
        `weather-widget-${user?.id}`,
        async () => {
          const response = await fetch('/api/weather/current', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ location })
          })
          
          if (!response.ok) {
            throw new Error('Failed to fetch weather data')
          }
          
          return response.json()
        },
        300000 // Cache for 5 minutes
      )
      
      setWeather(data)
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Weather data error:', err)
      setError('Unable to load weather data')
    } finally {
      setLoading(false)
    }
  }

  const getWeatherIcon = (icon: string) => {
    const iconMap = {
      sun: <Sun className="h-8 w-8 text-yellow-500" />,
      cloud: <Cloud className="h-8 w-8 text-gray-500" />,
      rain: <CloudRain className="h-8 w-8 text-blue-500" />,
      snow: <CloudSnow className="h-8 w-8 text-blue-300" />,
      drizzle: <CloudDrizzle className="h-8 w-8 text-blue-400" />
    }
    return iconMap[icon as keyof typeof iconMap] || iconMap.cloud
  }

  const getWindColor = (speed: number) => {
    if (speed < 10) return 'text-green-600'
    if (speed < 20) return 'text-yellow-600'
    if (speed < 30) return 'text-orange-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Weather Conditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !weather) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Weather Conditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">{error || 'No weather data available'}</p>
            <Button onClick={loadWeatherData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Weather Conditions
          </CardTitle>
          <Button
            onClick={loadWeatherData}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Refresh weather data"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {weather.location}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Conditions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getWeatherIcon(weather.current.icon)}
            <div>
              <div className="text-3xl font-bold">{weather.current.temperature}°F</div>
              <div className="text-sm text-muted-foreground">
                Feels like {weather.current.feelsLike}°F
              </div>
              <div className="text-sm font-medium">{weather.current.condition}</div>
            </div>
          </div>
          
          {/* Wind Info */}
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <Wind className={`h-5 w-5 ${getWindColor(weather.current.wind.speed)}`} />
              <span className={`text-lg font-semibold ${getWindColor(weather.current.wind.speed)}`}>
                {weather.current.wind.speed} kts
              </span>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
              <Navigation 
                className="h-3 w-3" 
                style={{ transform: `rotate(${weather.current.wind.degrees}deg)` }}
              />
              {weather.current.wind.direction}
            </div>
          </div>
        </div>

        {/* Marine Conditions */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-sm font-medium">Waves</div>
              <div className="text-sm text-muted-foreground">
                {weather.marine.waveHeight} ft @ {weather.marine.wavePeriod}s
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-sm font-medium">Water Temp</div>
              <div className="text-sm text-muted-foreground">
                {weather.marine.waterTemp}°F
              </div>
            </div>
          </div>
        </div>

        {/* Mini Forecast */}
        <div className="pt-4 border-t">
          <div className="text-sm font-medium mb-2">Next 12 Hours</div>
          <div className="grid grid-cols-4 gap-2">
            {weather.forecast.map((hour, idx) => (
              <div key={idx} className="text-center">
                <div className="text-xs text-muted-foreground">{hour.time}</div>
                <div className="text-sm font-medium">{hour.temperature}°</div>
                <div className="text-xs text-muted-foreground">{hour.windSpeed} kts</div>
                {hour.precipitation > 0 && (
                  <Badge variant="secondary" className="text-xs px-1 py-0 mt-1">
                    {hour.precipitation}%
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Last Update */}
        <div className="text-xs text-muted-foreground text-center pt-2">
          Updated {lastUpdate.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  )
}
