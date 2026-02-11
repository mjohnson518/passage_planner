'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { DatePickerWithRange } from '../ui/date-picker'
import { DateRange } from 'react-day-picker'
import { Badge } from '../ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { Download, FileText, TrendingUp, TrendingDown, MapPin, Anchor, Wind, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { format, addDays } from 'date-fns'

interface AnalyticsData {
  passageStats: {
    total: number
    completed: number
    inProgress: number
    planned: number
    averageDistance: number
    averageDuration: number
  }
  userActivity: {
    dailyActiveUsers: Array<{ date: string; count: number }>
    weeklyActiveUsers: Array<{ week: string; count: number }>
    monthlyActiveUsers: Array<{ month: string; count: number }>
  }
  popularRoutes: Array<{
    from: string
    to: string
    count: number
    avgDistance: number
    avgDuration: number
  }>
  weatherConditions: Array<{
    condition: string
    count: number
    percentage: number
  }>
  userEngagement: {
    avgSessionDuration: number
    bounceRate: number
    pagesPerSession: number
    conversionRate: number
  }
  featureUsage: Array<{
    feature: string
    usage: number
    tier: 'free' | 'pro' | 'enterprise'
  }>
  performanceMetrics: {
    avgPlanningTime: number
    avgResponseTime: number
    successRate: number
    errorRate: number
  }
}

export function AnalyticsReports() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date()
  })
  const [reportType, setReportType] = useState('overview')

  useEffect(() => {
    fetchAnalyticsData()
  }, [dateRange, reportType])

  const fetchAnalyticsData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/analytics?from=${dateRange?.from?.toISOString()}&to=${dateRange?.to?.toISOString()}&type=${reportType}`)
      if (!response.ok) throw new Error('Failed to fetch analytics data')
      const data = await response.json()
      setData(data)
    } catch (error) {
      console.error('Failed to load analytics:', error)
      toast.error('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = async (exportFormat: 'csv' | 'pdf') => {
    try {
      const response = await fetch(`/api/admin/analytics/export?format=${exportFormat}&from=${dateRange?.from?.toISOString()}&to=${dateRange?.to?.toISOString()}&type=${reportType}`)
      if (!response.ok) throw new Error('Failed to export report')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-report-${dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : 'start'}-${dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : 'end'}.${exportFormat}`
      a.click()
      
      toast.success(`Report exported as ${exportFormat.toUpperCase()}`)
    } catch (error) {
      toast.error('Failed to export report')
    }
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

  if (loading || !data) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-64 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Analytics Reports</h2>
        <div className="flex items-center gap-4">
          <DatePickerWithRange
            date={dateRange}
            onDateChange={setDateRange}
          />
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="passages">Passages</SelectItem>
              <SelectItem value="users">Users</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => exportReport('csv')} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => exportReport('pdf')}>
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Passages</CardTitle>
            <Anchor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.passageStats.total.toLocaleString()}</div>
            <div className="mt-2 flex gap-2">
              <Badge variant="secondary">{data.passageStats.completed} completed</Badge>
              <Badge variant="outline">{data.passageStats.inProgress} active</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Distance</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.passageStats.averageDistance.toFixed(1)} nm</div>
            <p className="text-xs text-muted-foreground mt-1">
              Per passage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data.passageStats.averageDuration / 24).toFixed(1)} days</div>
            <p className="text-xs text-muted-foreground mt-1">
              Per passage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.performanceMetrics.successRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Planning success
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Activity Trends</CardTitle>
            <CardDescription>Daily active users over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.userActivity.dailyActiveUsers}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weather Conditions</CardTitle>
            <CardDescription>Passages by weather conditions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.weatherConditions}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ condition, percentage }) => `${condition}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {data.weatherConditions.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Popular Routes</CardTitle>
          <CardDescription>Most frequently planned passages</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Avg Distance</TableHead>
                <TableHead>Avg Duration</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.popularRoutes.slice(0, 10).map((route, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <div className="font-medium">{route.from} → {route.to}</div>
                  </TableCell>
                  <TableCell>{route.count}</TableCell>
                  <TableCell>{route.avgDistance.toFixed(1)} nm</TableCell>
                  <TableCell>{(route.avgDuration / 24).toFixed(1)} days</TableCell>
                  <TableCell>
                    {idx < 3 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : idx > 6 ? (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    ) : (
                      <Wind className="h-4 w-4 text-gray-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Feature Usage</CardTitle>
            <CardDescription>Usage by feature and subscription tier</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.featureUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="feature" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="usage" fill="#8884d8">
                  {data.featureUsage.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        entry.tier === 'enterprise' ? '#FF8042' :
                        entry.tier === 'pro' ? '#00C49F' : '#0088FE'
                      } 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Engagement</CardTitle>
            <CardDescription>Key engagement metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Avg Session Duration</span>
                <span className="text-sm font-bold">
                  {Math.floor(data.userEngagement.avgSessionDuration / 60)}m {data.userEngagement.avgSessionDuration % 60}s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Bounce Rate</span>
                <Badge variant={data.userEngagement.bounceRate > 50 ? 'destructive' : 'default'}>
                  {data.userEngagement.bounceRate}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Pages per Session</span>
                <span className="text-sm font-bold">{data.userEngagement.pagesPerSession.toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Conversion Rate</span>
                <Badge variant="default">
                  {data.userEngagement.conversionRate}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>System performance overview</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={[
              { metric: 'Planning Speed', value: 100 - data.performanceMetrics.avgPlanningTime },
              { metric: 'Response Time', value: 100 - data.performanceMetrics.avgResponseTime / 10 },
              { metric: 'Success Rate', value: data.performanceMetrics.successRate },
              { metric: 'Reliability', value: 100 - data.performanceMetrics.errorRate },
              { metric: 'User Satisfaction', value: 85 } // Placeholder
            ]}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar name="Performance" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
} 