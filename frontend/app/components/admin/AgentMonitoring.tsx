'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Bot, Activity, RefreshCw, PauseCircle, PlayCircle, AlertCircle, CheckCircle2, XCircle, Cpu, Clock, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

interface Agent {
  id: string
  name: string
  type: 'weather' | 'tidal' | 'port' | 'routing' | 'safety' | 'meta'
  status: 'running' | 'stopped' | 'error' | 'starting'
  uptime: number
  lastHeartbeat: Date
  metrics: {
    requestsProcessed: number
    avgResponseTime: number
    errorRate: number
    cpuUsage: number
    memoryUsage: number
  }
  capabilities: string[]
  lastError?: string
}

interface AgentHistory {
  timestamp: string
  cpuUsage: number
  memoryUsage: number
  requestsPerMinute: number
  avgResponseTime: number
}

export function AgentMonitoring() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [agentHistory, setAgentHistory] = useState<AgentHistory[]>([])
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    fetchAgents()
    
    if (autoRefresh) {
      const interval = setInterval(fetchAgents, 10000) // Refresh every 10 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  useEffect(() => {
    if (selectedAgent) {
      fetchAgentHistory(selectedAgent)
    }
  }, [selectedAgent])

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents/health')
      if (!response.ok) throw new Error('Failed to fetch agents')
      const data = await response.json()
      setAgents(data.agents)
    } catch (error) {
      console.error('Failed to load agents:', error)
      toast.error('Failed to load agent status')
    } finally {
      setLoading(false)
    }
  }

  const fetchAgentHistory = async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/history`)
      if (!response.ok) throw new Error('Failed to fetch agent history')
      const data = await response.json()
      setAgentHistory(data.history)
    } catch (error) {
      console.error('Failed to load agent history:', error)
    }
  }

  const handleAgentAction = async (agentId: string, action: 'start' | 'stop' | 'restart') => {
    try {
      const response = await fetch(`/api/agents/${agentId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!response.ok) throw new Error(`Failed to ${action} agent`)
      
      toast.success(`Agent ${action} initiated`)
      fetchAgents()
    } catch (error) {
      toast.error(`Failed to ${action} agent`)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'stopped':
        return <PauseCircle className="h-4 w-4 text-gray-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'starting':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'default'
      case 'stopped':
        return 'secondary'
      case 'error':
        return 'destructive'
      case 'starting':
        return 'outline'
      default:
        return 'secondary'
    }
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

  const getAgentIcon = (type: string) => {
    const icons: Record<string, JSX.Element> = {
      weather: <Bot className="h-5 w-5 text-blue-500" />,
      tidal: <Bot className="h-5 w-5 text-cyan-500" />,
      port: <Bot className="h-5 w-5 text-green-500" />,
      routing: <Bot className="h-5 w-5 text-purple-500" />,
      safety: <Bot className="h-5 w-5 text-orange-500" />,
      meta: <Bot className="h-5 w-5 text-pink-500" />
    }
    return icons[type] || <Bot className="h-5 w-5" />
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  const runningAgents = agents.filter(a => a.status === 'running').length
  const totalAgents = agents.length
  const hasErrors = agents.some(a => a.status === 'error')

  return (
    <div className="space-y-6">
      {hasErrors && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Agent Errors Detected</AlertTitle>
          <AlertDescription>
            One or more agents are experiencing errors. Check the details below.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runningAgents} / {totalAgents}</div>
            <Progress value={(runningAgents / totalAgents) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents.reduce((sum, a) => sum + a.metrics.requestsProcessed, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(
                agents.reduce((sum, a) => sum + a.metrics.avgResponseTime, 0) / agents.length
              )}ms
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all agents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(agents.reduce((sum, a) => sum + a.metrics.errorRate, 0) / agents.length).toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average error rate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agent Status</CardTitle>
            <CardDescription>Current status and control of all agents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedAgent === agent.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedAgent(agent.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getAgentIcon(agent.type)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{agent.name}</span>
                          {getStatusIcon(agent.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Uptime: {formatUptime(agent.uptime)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusColor(agent.status)}>
                        {agent.status.toUpperCase()}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAgentAction(agent.id, agent.status === 'running' ? 'stop' : 'start')
                        }}
                      >
                        {agent.status === 'running' ? (
                          <PauseCircle className="h-4 w-4" />
                        ) : (
                          <PlayCircle className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAgentAction(agent.id, 'restart')
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">CPU:</span>
                      <span className="ml-1 font-medium">{agent.metrics.cpuUsage}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Memory:</span>
                      <span className="ml-1 font-medium">{agent.metrics.memoryUsage}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Requests:</span>
                      <span className="ml-1 font-medium">{agent.metrics.requestsProcessed}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Errors:</span>
                      <span className="ml-1 font-medium">{agent.metrics.errorRate}%</span>
                    </div>
                  </div>
                  
                  {agent.lastError && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {agent.lastError}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent Performance</CardTitle>
            <CardDescription>
              {selectedAgent 
                ? `Performance metrics for ${agents.find(a => a.id === selectedAgent)?.name}`
                : 'Select an agent to view performance metrics'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedAgent && agentHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={agentHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="cpuUsage"
                    stroke="#8884d8"
                    strokeWidth={2}
                    name="CPU %"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="memoryUsage"
                    stroke="#82ca9d"
                    strokeWidth={2}
                    name="Memory %"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgResponseTime"
                    stroke="#ffc658"
                    strokeWidth={2}
                    name="Response Time (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                Select an agent to view performance history
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Capabilities</CardTitle>
          <CardDescription>Overview of what each agent can do</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <div key={agent.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  {getAgentIcon(agent.type)}
                  <span className="font-medium">{agent.name}</span>
                </div>
                <div className="space-y-1">
                  {agent.capabilities.map((capability, idx) => (
                    <div key={idx} className="text-sm text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {capability}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 