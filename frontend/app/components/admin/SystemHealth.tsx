'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Activity, Database, HardDrive, Cpu, MemoryStick, Network, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'

interface SystemMetrics {
  cpu: {
    usage: number
    cores: number
    load: number[]
  }
  memory: {
    used: number
    total: number
    percentage: number
  }
  disk: {
    used: number
    total: number
    percentage: number
  }
  database: {
    connections: number
    maxConnections: number
    avgQueryTime: number
    slowQueries: number
  }
  redis: {
    connected: boolean
    memory: number
    keys: number
    hitRate: number
  }
  api: {
    uptime: number
    requestsPerMinute: number
    avgResponseTime: number
    errorRate: number
  }
  services: Array<{
    name: string
    status: 'healthy' | 'degraded' | 'down'
    uptime: number
    lastCheck: Date
  }>
  performanceHistory: Array<{
    time: string
    cpu: number
    memory: number
    requests: number
    responseTime: number
  }>
}

export function SystemHealth() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    fetchSystemMetrics()
    
    if (autoRefresh) {
      const interval = setInterval(fetchSystemMetrics, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const fetchSystemMetrics = async () => {
    try {
      const response = await fetch('/api/admin/system/health')
      if (!response.ok) throw new Error('Failed to fetch system metrics')
      const data = await response.json()
      setMetrics(data)
    } catch (error) {
      console.error('Failed to load system metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500'
      case 'degraded':
        return 'text-yellow-500'
      case 'down':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'down':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    const parts: string[] = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)

    return parts.join(' ') || '0m'
  }

  if (loading || !metrics) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  const overallHealth = metrics.services.every(s => s.status === 'healthy') ? 'healthy' : 
                       metrics.services.some(s => s.status === 'down') ? 'critical' : 'degraded'

  return (
    <div className="space-y-6">
      {overallHealth !== 'healthy' && (
        <Alert variant={overallHealth === 'critical' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>System Health Warning</AlertTitle>
          <AlertDescription>
            {overallHealth === 'critical' 
              ? 'Critical services are down. Immediate attention required.'
              : 'Some services are experiencing degraded performance.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.cpu.usage}%</div>
            <Progress value={metrics.cpu.usage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.cpu.cores} cores | Load: {metrics.cpu.load.join(', ')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.memory.percentage}%</div>
            <Progress value={metrics.memory.percentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.disk.percentage}%</div>
            <Progress value={metrics.disk.percentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {formatBytes(metrics.disk.used)} / {formatBytes(metrics.disk.total)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Uptime</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUptime(metrics.api.uptime)}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.api.requestsPerMinute} req/min
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>CPU and Memory usage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.performanceHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="CPU %"
                />
                <Line
                  type="monotone"
                  dataKey="memory"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  name="Memory %"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Performance</CardTitle>
            <CardDescription>Request volume and response times</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={metrics.performanceHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="requests"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                  name="Requests"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="responseTime"
                  stroke="#ff7300"
                  strokeWidth={2}
                  name="Response Time (ms)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Database Health</CardTitle>
            <CardDescription>PostgreSQL performance metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Connections</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">
                  {metrics.database.connections} / {metrics.database.maxConnections}
                </div>
                <Progress 
                  value={(metrics.database.connections / metrics.database.maxConnections) * 100} 
                  className="w-24 mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Avg Query Time</span>
              <Badge variant={metrics.database.avgQueryTime > 100 ? 'destructive' : 'default'}>
                {metrics.database.avgQueryTime}ms
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Slow Queries</span>
              <Badge variant={metrics.database.slowQueries > 10 ? 'destructive' : 'secondary'}>
                {metrics.database.slowQueries}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Redis Cache</CardTitle>
            <CardDescription>Cache performance and usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge variant={metrics.redis.connected ? 'default' : 'destructive'}>
                {metrics.redis.connected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Memory Usage</span>
              <span className="text-sm">{formatBytes(metrics.redis.memory)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Keys</span>
              <span className="text-sm">{metrics.redis.keys.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cache Hit Rate</span>
              <Badge variant={metrics.redis.hitRate > 90 ? 'default' : 'destructive'}>
                {metrics.redis.hitRate}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
          <CardDescription>Health status of all system services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.services.map((service) => (
              <div key={service.name} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <div className="font-medium">{service.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Uptime: {formatUptime(service.uptime)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={getStatusColor(service.status)} variant="outline">
                    {service.status.toUpperCase()}
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    Last check: {new Date(service.lastCheck).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 