'use client'

import { useEffect, useState } from 'react'
import { MetricCard } from './MetricCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Skeleton } from '../ui/skeleton'
import { useSocket } from '../../contexts/SocketContext'

interface BusinessMetrics {
  mrr: number
  arr: number
  totalUsers: number
  paidUsers: number
  trialUsers: number
  churnRate: number
  averageRevenuePerUser: number
  monthlyActiveUsers: number
  conversionRate: number
  mrrGrowth?: number
  userGrowth?: number
}

interface ChartData {
  mrrHistory: Array<{ date: string; value: number }>
  userGrowth: Array<{ date: string; total: number; paid: number; trial: number }>
  featureUsage: Array<{ feature: string; count: number }>
  subscriptionDistribution: Array<{ name: string; value: number }>
  cohortRetention: Array<{ week: number; retention: number }>
}

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']

export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null)
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [timeRange, setTimeRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const { connected } = useSocket()

  useEffect(() => {
    fetchAnalytics()
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchAnalytics, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [timeRange])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/analytics/metrics?range=${timeRange}`)
      const data = await response.json()
      
      setMetrics(data.metrics)
      setChartData(data.charts)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Monthly Recurring Revenue"
          value={metrics?.mrr || 0}
          prefix="$"
          change={metrics?.mrrGrowth}
          trend={metrics?.mrrGrowth && metrics.mrrGrowth > 0 ? 'up' : 'down'}
        />
        <MetricCard
          title="Total Users"
          value={metrics?.totalUsers || 0}
          change={metrics?.userGrowth}
          trend={metrics?.userGrowth && metrics.userGrowth > 0 ? 'up' : 'down'}
        />
        <MetricCard
          title="Paid Users"
          value={metrics?.paidUsers || 0}
          suffix={` (${metrics?.totalUsers ? Math.round((metrics.paidUsers / metrics.totalUsers) * 100) : 0}%)`}
        />
        <MetricCard
          title="Churn Rate"
          value={metrics?.churnRate?.toFixed(1) || 0}
          suffix="%"
          trend={metrics?.churnRate && metrics.churnRate > 5 ? 'down' : 'up'}
        />
        <MetricCard
          title="ARPU"
          value={metrics?.averageRevenuePerUser?.toFixed(2) || 0}
          prefix="$"
        />
        <MetricCard
          title="MAU"
          value={metrics?.monthlyActiveUsers || 0}
        />
        <MetricCard
          title="Trial → Paid"
          value={metrics?.conversionRate?.toFixed(1) || 0}
          suffix="%"
          trend="up"
        />
        <MetricCard
          title="ARR"
          value={metrics?.arr || 0}
          prefix="$"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* MRR Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>MRR Growth</CardTitle>
            <CardDescription>Monthly recurring revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData?.mrrHistory || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value}`} />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#0ea5e9" 
                  fill="#0ea5e9" 
                  fillOpacity={0.3} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>User acquisition and conversion</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData?.userGrowth || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#0ea5e9" 
                  name="Total Users"
                />
                <Line 
                  type="monotone" 
                  dataKey="paid" 
                  stroke="#10b981" 
                  name="Paid Users"
                />
                <Line 
                  type="monotone" 
                  dataKey="trial" 
                  stroke="#f59e0b" 
                  name="Trial Users"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Feature Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Usage</CardTitle>
            <CardDescription>Most used features in the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData?.featureUsage || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="feature" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Subscription Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Distribution</CardTitle>
            <CardDescription>Breakdown by plan type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData?.subscriptionDistribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData?.subscriptionDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cohort Retention */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Cohort Retention</CardTitle>
            <CardDescription>User retention by week after signup</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData?.cohortRetention || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" label={{ value: 'Weeks after signup', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Retention %', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Area 
                  type="monotone" 
                  dataKey="retention" 
                  stroke="#8b5cf6" 
                  fill="#8b5cf6" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 