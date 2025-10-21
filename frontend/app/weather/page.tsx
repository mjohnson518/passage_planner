export const dynamic = 'force-dynamic'

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { Slider } from '../components/ui/slider'
import { Skeleton } from '../components/ui/skeleton'
import { 
  Cloud, 
  Wind, 
  Waves, 
  Eye,
  AlertTriangle,
  MapPin,
  RefreshCw,
  Download,
  Info,
  Navigation,
  Droplets,
  ThermometerSun
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAnalytics } from '../hooks/useAnalytics'

interface WeatherLayer {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  available: boolean
}

interface WeatherData {
  windSpeed: number
  windDirection: number
  waveHeight: number
  wavePeriod: number
  precipitation: number
  temperature: number
  pressure: number
  visibility: number
}

interface MarineWarning {
  id: string
  type: 'gale' | 'storm' | 'hurricane' | 'small-craft'
  severity: 'watch' | 'warning'
  area: string
  description: string
  validFrom: string
  validUntil: string
}

export default function WeatherPage() {
  const { user } = useAuth()
  const { track, trackFeature } = useAnalytics()
  const [selectedLayer, setSelectedLayer] = useState('wind')
  const [region, setRegion] = useState('northeast-atlantic')
  const [forecastHour, setForecastHour] = useState(0)
  const [loading, setLoading] = useState(false)
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [warnings, setWarnings] = useState<MarineWarning[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const weatherLayers: WeatherLayer[] = [
    {
      id: 'wind',
      name: 'Wind',
      icon: <Wind className="h-4 w-4" />,
      description: 'Wind speed and direction',
      available: true
    },
    {
      id: 'waves',
      name: 'Waves',
      icon: <Waves className="h-4 w-4" />,
      description: 'Wave height and period',
      available: true
    },
    {
      id: 'precipitation',
      name: 'Precipitation',
      icon: <Droplets className="h-4 w-4" />,
      description: 'Rain and snow forecast',
      available: true
    },
    {
      id: 'temperature',
      name: 'Temperature',
      icon: <ThermometerSun className="h-4 w-4" />,
      description: 'Air and sea temperature',
      available: true
    },
    {
      id: 'pressure',
      name: 'Pressure',
      icon: <Cloud className="h-4 w-4" />,
      description: 'Atmospheric pressure',
      available: true
    },
    {
      id: 'visibility',
      name: 'Visibility',
      icon: <Eye className="h-4 w-4" />,
      description: 'Visibility conditions',
      available: false
    }
  ]

  const regions = [
    { value: 'northeast-atlantic', label: 'Northeast Atlantic' },
    { value: 'northwest-atlantic', label: 'Northwest Atlantic' },
    { value: 'caribbean', label: 'Caribbean' },
    { value: 'mediterranean', label: 'Mediterranean' },
    { value: 'north-pacific', label: 'North Pacific' },
    { value: 'south-pacific', label: 'South Pacific' }
  ]

  useEffect(() => {
    track('page_view', { page: 'weather' })
    loadWeatherData()
    loadWarnings()
  }, [])

  useEffect(() => {
    if (selectedLayer || region) {
      loadWeatherData()
    }
  }, [selectedLayer, region, forecastHour])

  const loadWeatherData = async () => {
    setLoading(true)
    try {
      // Mock weather data - in production this would call the weather API
      const mockData: WeatherData = {
        windSpeed: 15 + Math.random() * 10,
        windDirection: Math.floor(Math.random() * 360),
        waveHeight: 1.5 + Math.random() * 2,
        wavePeriod: 6 + Math.random() * 4,
        precipitation: Math.random() * 10,
        temperature: 65 + Math.random() * 15,
        pressure: 1010 + Math.random() * 20,
        visibility: 8 + Math.random() * 2
      }
      
      setWeatherData(mockData)
      setLastUpdate(new Date())
      
      trackFeature('weather_layer_viewed', { 
        layer: selectedLayer, 
        region, 
        forecastHour 
      })
    } catch (error) {
      console.error('Failed to load weather data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadWarnings = async () => {
    try {
      // Mock warnings data
      const mockWarnings: MarineWarning[] = [
        {
          id: '1',
          type: 'small-craft',
          severity: 'warning',
          area: 'Cape Cod to Maine',
          description: 'Small craft advisory for hazardous seas',
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          type: 'gale',
          severity: 'watch',
          area: 'Georges Bank',
          description: 'Gale watch for increasing winds',
          validFrom: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          validUntil: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString()
        }
      ]
      
      setWarnings(mockWarnings)
    } catch (error) {
      console.error('Failed to load warnings:', error)
    }
  }

  const handleExport = () => {
    trackFeature('weather_map_exported', { layer: selectedLayer, region })
    // TODO: Implement export functionality
  }

  const getWarningColor = (type: string, severity: string) => {
    if (severity === 'warning') {
      return type === 'hurricane' ? 'destructive' : 'default'
    }
    return 'secondary'
  }

  const formatForecastTime = (hours: number) => {
    const date = new Date(Date.now() + hours * 60 * 60 * 1000)
    if (hours === 0) return 'Now'
    if (hours < 24) return `+${hours}h`
    return date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric' })
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Weather Maps</h2>
          <p className="text-muted-foreground">
            Interactive marine weather visualization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadWeatherData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Marine Warnings */}
      {warnings.length > 0 && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Marine Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {warnings.map((warning) => (
                <div key={warning.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                  <Badge variant={getWarningColor(warning.type, warning.severity)}>
                    {warning.type.replace('-', ' ').toUpperCase()}
                  </Badge>
                  <div className="flex-1">
                    <p className="font-medium">{warning.area}</p>
                    <p className="text-sm text-muted-foreground">{warning.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Valid until {new Date(warning.validUntil).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Region</label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Weather Layer</label>
              <Select value={selectedLayer} onValueChange={setSelectedLayer}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weatherLayers.filter(l => l.available).map((layer) => (
                    <SelectItem key={layer.id} value={layer.id}>
                      <div className="flex items-center gap-2">
                        {layer.icon}
                        {layer.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                Forecast: {formatForecastTime(forecastHour)}
              </label>
              <Slider
                value={[forecastHour]}
                onValueChange={([value]) => setForecastHour(value)}
                min={0}
                max={120}
                step={3}
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card className="h-[600px]">
            <CardContent className="p-0 h-full">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <Skeleton className="w-full h-full" />
                </div>
              ) : (
                <div className="h-full relative bg-gradient-to-b from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800">
                  {/* Placeholder for actual map */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Cloud className="h-16 w-16 text-muted-foreground mb-4 mx-auto" />
                      <p className="text-lg font-medium">Weather Map Visualization</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Interactive map will be rendered here
                      </p>
                      <p className="text-xs text-muted-foreground mt-4">
                        Showing: {weatherLayers.find(l => l.id === selectedLayer)?.name} layer
                      </p>
                    </div>
                  </div>
                  
                  {/* Map controls overlay */}
                  <div className="absolute top-4 right-4 space-y-2">
                    <Button size="sm" variant="secondary">
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="secondary">
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Legend overlay */}
                  <div className="absolute bottom-4 left-4 bg-background/90 p-3 rounded-lg">
                    <p className="text-xs font-medium mb-2">Legend</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500" />
                        <span className="text-xs">Light (0-10 kts)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-500" />
                        <span className="text-xs">Moderate (10-20 kts)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-500" />
                        <span className="text-xs">Strong (20-30 kts)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500" />
                        <span className="text-xs">Gale (30+ kts)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Weather Details Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Conditions</CardTitle>
              <CardDescription>
                Click on map for point forecast
              </CardDescription>
            </CardHeader>
            <CardContent>
              {weatherData ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Wind</span>
                      <div className="flex items-center gap-1">
                        <Wind className="h-4 w-4" />
                        <span className="font-medium">
                          {Math.round(weatherData.windSpeed)} kts
                        </span>
                        <Navigation 
                          className="h-4 w-4" 
                          style={{ transform: `rotate(${weatherData.windDirection}deg)` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Waves</span>
                      <div className="flex items-center gap-1">
                        <Waves className="h-4 w-4" />
                        <span className="font-medium">
                          {weatherData.waveHeight.toFixed(1)} ft @ {Math.round(weatherData.wavePeriod)}s
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Visibility</span>
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        <span className="font-medium">
                          {weatherData.visibility.toFixed(1)} nm
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pressure</span>
                      <span className="font-medium">
                        {Math.round(weatherData.pressure)} mb
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Click on map for details</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Layer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-4 w-4" />
                Layer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {weatherLayers.map((layer) => (
                  <div
                    key={layer.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedLayer === layer.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted'
                    } ${!layer.available ? 'opacity-50' : ''}`}
                    onClick={() => layer.available && setSelectedLayer(layer.id)}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      {layer.icon}
                      {layer.name}
                      {!layer.available && (
                        <Badge variant="secondary" className="text-xs">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {layer.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Last Update */}
      <div className="text-center text-sm text-muted-foreground">
        Last updated: {lastUpdate.toLocaleString()}
      </div>
    </div>
  )
}

// Add missing imports
import { Plus, Minus } from 'lucide-react'
