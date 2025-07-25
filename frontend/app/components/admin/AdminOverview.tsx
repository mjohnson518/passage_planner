'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Progress } from '../ui/progress'
import { Badge } from '../ui/badge'
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  TrendingDown,
  Activity,
  CreditCard,
  UserCheck,
  UserX,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { Line, Bar } from 'recharts'
import { 
  LineChart, 
  BarChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'

interface MetricCard {
  title: string
  value: string | number
  change: number
  changeLabel: string
  icon: any
  trend: 'up' | 'down' | 'neutral'
}

interface OverviewMetrics {
  revenue: {
    mrr: number
    arr: number
    growth: number
    churn: number
  }
  users: {
    total: number
    paid: number
    trial: number
    active: number
    newThisMonth: number
    churnedThisMonth: number
  }
  usage: {
    passagesPlanned: number
    apiCallsToday: number
    activeAgents: number
    avgResponseTime: number
  }
  health: {
    uptime: number
    errorRate: number
    queueDepth: number
  }
}

export function AdminOverview() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null)
  const [revenueChart, setRevenueChart] = useState<any[]>([])
  const [userChart, setUserChart] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/admin/metrics/overview', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setMetrics(data.metrics)
        setRevenueChart(data.revenueChart)
        setUserChart(data.userChart)
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  const metricCards: MetricCard[] = [
    {
      title: 'Monthly Recurring Revenue',
      value: `$${metrics.revenue.mrr.toLocaleString()}`,
      change: metrics.revenue.growth,
      changeLabel: 'from last month',
      icon: DollarSign,
      trend: metrics.revenue.growth > 0 ? 'up' : 'down'
    },
    {
      title: 'Total Users',
      value: metrics.users.total.toLocaleString(),
      change: ((metrics.users.newThisMonth - metrics.users.churnedThisMonth) / metrics.users.total) * 100,
      changeLabel: 'net growth',
      icon: Users,
      trend: metrics.users.newThisMonth > metrics.users.churnedThisMonth ? 'up' : 'down'
    },
    {
      title: 'Paid Users',
      value: metrics.users.paid.toLocaleString(),
      change: (metrics.users.paid / metrics.users.total) * 100,
      changeLabel: 'conversion rate',
      icon: CreditCard,
      trend: 'neutral'
    },
    {
      title: 'Active Users (30d)',
      value: metrics.users.active.toLocaleString(),
      change: (metrics.users.active / metrics.users.total) * 100,
      changeLabel: 'engagement rate',
      icon: Activity,
      trend: 'neutral'
    }
  ]

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric, index) => {
          const Icon = metric.icon
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  {metric.trend === 'up' ? (
                    <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                  ) : metric.trend === 'down' ? (
                    <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" />
                  ) : null}
                  <span className={
                    metric.trend === 'up' ? 'text-green-600' : 
                    metric.trend === 'down' ? 'text-red-600' : ''
                  }>
                    {Math.abs(metric.change).toFixed(1)}%
                  </span>
                  <span className="ml-1">{metric.changeLabel}</span>
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Monthly recurring revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `$${value / 1000}k`} />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="mrr" 
                  stroke="#8884d8" 
                  name="MRR"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="arr" 
                  stroke="#82ca9d" 
                  name="ARR"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>New vs churned users by month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={userChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="new" fill="#82ca9d" name="New Users" />
                <Bar dataKey="churned" fill="#ef4444" name="Churned" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Uptime</span>
                <span className="font-medium">{metrics.health.uptime.toFixed(2)}%</span>
              </div>
              <Progress value={metrics.health.uptime} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Error Rate</span>
                <span className="font-medium">{metrics.health.errorRate.toFixed(2)}%</span>
              </div>
              <Progress value={metrics.health.errorRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm">Passages Today</span>
              <Badge variant="secondary">{metrics.usage.passagesPlanned}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">API Calls</span>
              <Badge variant="secondary">{metrics.usage.apiCallsToday}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Avg Response</span>
              <Badge variant="secondary">{metrics.usage.avgResponseTime}ms</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm">
              View Error Logs
            </button>
            <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm">
              Export User Data
            </button>
            <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm">
              Send Newsletter
            </button>
            <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm">
              System Maintenance
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 