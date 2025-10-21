'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  Power, 
  Clock,
  Cpu,
  MemoryStick
} from 'lucide-react'
import { useSocket } from '../../contexts/SocketContext'
import { formatDistanceToNow } from '../../lib/utils'

interface AgentStatus {
  name: string
  status: 'stopped' | 'starting' | 'running' | 'crashed' | 'stopping'
  restartCount: number
  lastStartTime?: string
  lastHealthCheck?: string
  healthStatus?: {
    status: 'healthy' | 'unhealthy' | 'degraded'
    uptime?: number
    memoryUsage?: {
      heapUsed: number
      heapTotal: number
    }
    errors?: number
    requestsHandled?: number
    averageResponseTime?: number
  }
  pid?: number
}

export function AgentHealthDashboard() {
  const [agents, setAgents] = useState<Record<string, AgentStatus>>({})
  const [loading, setLoading] = useState(true)
  const { connected, agentStatuses } = useSocket()

  useEffect(() => {
    if (!connected) return
    
    // Update agents from socket context
    setAgents(agentStatuses)

    // Request initial status
    socket.emit('agents:status')

    // Listen for updates
    socket.on('agents:status', (status: Record<string, AgentStatus>) => {
      setAgents(status)
      setLoading(false)
    })

    socket.on('agent:started', ({ name }: { name: string }) => {
      setAgents(prev => ({
        ...prev,
        [name]: { ...prev[name], status: 'running' }
      }))
    })

    socket.on('agent:stopped', ({ name }: { name: string }) => {
      setAgents(prev => ({
        ...prev,
        [name]: { ...prev[name], status: 'stopped' }
      }))
    })

    socket.on('agent:crashed', ({ name }: { name: string }) => {
      setAgents(prev => ({
        ...prev,
        [name]: { ...prev[name], status: 'crashed' }
      }))
    })

    socket.on('agent:health', ({ name, health }: { name: string; health: any }) => {
      setAgents(prev => ({
        ...prev,
        [name]: { ...prev[name], healthStatus: health, lastHealthCheck: new Date().toISOString() }
      }))
    })

    return () => {
      socket.off('agents:status')
      socket.off('agent:started')
      socket.off('agent:stopped')
      socket.off('agent:crashed')
      socket.off('agent:health')
    }
  }, [socket, connected])

  const handleStartAgent = (name: string) => {
    if (socket) {
      socket.emit('agent:start', { name })
    }
  }

  const handleStopAgent = (name: string) => {
    if (socket) {
      socket.emit('agent:stop', { name })
    }
  }

  const handleRestartAgent = (name: string) => {
    if (socket) {
      socket.emit('agent:restart', { name })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500'
      case 'starting':
      case 'stopping':
        return 'bg-yellow-500'
      case 'stopped':
        return 'bg-gray-500'
      case 'crashed':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getHealthColor = (status?: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600'
      case 'degraded':
        return 'text-yellow-600'
      case 'unhealthy':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatUptime = (ms?: number) => {
    if (!ms) return 'N/A'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Agent Health Monitor</h2>
          <p className="text-muted-foreground">Monitor and manage passage planning agents</p>
        </div>
        <Badge variant={connected ? 'default' : 'secondary'}>
          {connected ? 'Connected' : 'Disconnected'}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(agents).map(([name, agent]) => (
          <Card key={name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg capitalize">{name} Agent</CardTitle>
                <div className={`h-3 w-3 rounded-full ${getStatusColor(agent.status)}`} />
              </div>
              <CardDescription>
                Status: <span className="font-medium">{agent.status}</span>
                {agent.pid && ` (PID: ${agent.pid})`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Health Status */}
              {agent.healthStatus && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className={`h-4 w-4 ${getHealthColor(agent.healthStatus.status)}`} />
                    <span className="text-sm font-medium">
                      Health: {agent.healthStatus.status}
                    </span>
                  </div>
                  
                  {agent.healthStatus.uptime && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Uptime: {formatUptime(agent.healthStatus.uptime)}
                    </div>
                  )}
                  
                  {agent.healthStatus.memoryUsage && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MemoryStick className="h-3 w-3" />
                      Memory: {formatBytes(agent.healthStatus.memoryUsage.heapUsed)} / {formatBytes(agent.healthStatus.memoryUsage.heapTotal)}
                    </div>
                  )}
                  
                  {agent.healthStatus.requestsHandled !== undefined && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Requests:</span> {agent.healthStatus.requestsHandled}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Errors:</span> {agent.healthStatus.errors || 0}
                      </div>
                    </div>
                  )}
                  
                  {agent.healthStatus.averageResponseTime !== undefined && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Avg Response:</span> {Math.round(agent.healthStatus.averageResponseTime)}ms
                    </div>
                  )}
                </div>
              )}

              {/* Restart Count */}
              {agent.restartCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  Restarted {agent.restartCount} time{agent.restartCount > 1 ? 's' : ''}
                </div>
              )}

              {/* Last Check Time */}
              {agent.lastHealthCheck && (
                <div className="text-xs text-muted-foreground">
                  Last checked {formatDistanceToNow(new Date(agent.lastHealthCheck))} ago
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {agent.status === 'stopped' && (
                  <Button 
                    size="sm" 
                    onClick={() => handleStartAgent(name)}
                    className="flex-1"
                  >
                    <Power className="mr-1 h-3 w-3" />
                    Start
                  </Button>
                )}
                
                {agent.status === 'running' && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleRestartAgent(name)}
                      className="flex-1"
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Restart
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleStopAgent(name)}
                      className="flex-1"
                    >
                      <Power className="mr-1 h-3 w-3" />
                      Stop
                    </Button>
                  </>
                )}
                
                {(agent.status === 'crashed' || agent.status === 'starting') && (
                  <Button 
                    size="sm" 
                    disabled
                    className="flex-1"
                  >
                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                    {agent.status === 'crashed' ? 'Crashed' : 'Starting...'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {Object.keys(agents).length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No agents registered</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 