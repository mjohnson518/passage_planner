'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
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
import { Skeleton } from '../ui/skeleton'
import type { FleetAnalytics } from '../../../shared/src/types/fleet'

interface FleetAnalyticsDashboardProps {
  fleetId: string
}

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']

export function FleetAnalyticsDashboard({ fleetId }: FleetAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<FleetAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [fleetId])

  const fetchAnalytics = async () => {
    try {
      // Mock data for now
      setAnalytics({
        fleetId,
        totalVessels: 5,
        activeVessels: 4,
        totalCrew: 12,
        totalPassages: 156,
        totalDistance: 12450,
        averagePassageDistance: 79.8,
        vesselUtilization: [
          { vesselId: '1', name: 'Serenity', passagesCount: 45, totalDistance: 3200, lastUsed: new Date() },
          { vesselId: '2', name: 'Wind Dancer', passagesCount: 38, totalDistance: 2890, lastUsed: new Date() },
          { vesselId: '3', name: 'Blue Horizon', passagesCount: 32, totalDistance: 2410, lastUsed: new Date() },
          { vesselId: '4', name: 'Ocean Spirit', passagesCount: 28, totalDistance: 2150, lastUsed: new Date() },
          { vesselId: '5', name: 'Wave Runner', passagesCount: 13, totalDistance: 1800, lastUsed: new Date() }
        ],
        popularRoutes: [
          { departure: 'Boston', destination: 'Portland', count: 23 },
          { departure: 'Newport', destination: 'Block Island', count: 18 },
          { departure: 'Annapolis', destination: 'Norfolk', count: 15 },
          { departure: 'Miami', destination: 'Key West', count: 12 }
        ]
      })
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!analytics) return null

  // Prepare chart data
  const utilizationData = analytics.vesselUtilization.map(v => ({
    name: v.name,
    passages: v.passagesCount,
    distance: v.totalDistance
  }))

  const routeData = analytics.popularRoutes.map(r => ({
    route: `${r.departure} → ${r.destination}`,
    count: r.count
  }))

  const pieData = analytics.vesselUtilization.map(v => ({
    name: v.name,
    value: v.passagesCount
  }))

  // Monthly usage trend (mock data)
  const trendData = [
    { month: 'Jan', passages: 12 },
    { month: 'Feb', passages: 15 },
    { month: 'Mar', passages: 18 },
    { month: 'Apr', passages: 22 },
    { month: 'May', passages: 28 },
    { month: 'Jun', passages: 25 }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Vessel Utilization */}
      <Card>
        <CardHeader>
          <CardTitle>Vessel Utilization</CardTitle>
          <CardDescription>Passages per vessel</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={utilizationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="passages" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Popular Routes */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Routes</CardTitle>
          <CardDescription>Most frequently sailed passages</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={routeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="route" type="category" width={120} />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Fleet Usage Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Fleet Distribution</CardTitle>
          <CardDescription>Passage distribution across vessels</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Usage Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Trend</CardTitle>
          <CardDescription>Monthly passage count</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="passages" 
                stroke="#10b981" 
                fill="#10b981" 
                fillOpacity={0.3} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Fleet Summary</CardTitle>
          <CardDescription>Key performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">{analytics.totalPassages}</p>
              <p className="text-sm text-muted-foreground">Total Passages</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">{analytics.totalDistance.toLocaleString()} nm</p>
              <p className="text-sm text-muted-foreground">Total Distance</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">{analytics.averagePassageDistance.toFixed(1)} nm</p>
              <p className="text-sm text-muted-foreground">Avg Distance</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">
                {Math.round((analytics.activeVessels / analytics.totalVessels) * 100)}%
              </p>
              <p className="text-sm text-muted-foreground">Fleet Active</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 