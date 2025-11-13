import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { PassagePlan, PassagePlanRequest } from '@/types/shared'
import { analytics } from '../lib/analytics'

interface UsePassagePlannerReturn {
  planPassage: (request: PassagePlanRequest) => Promise<void>
  currentPlan: PassagePlan | null
  loading: boolean
  error: string | null
  progress: number
  status: string
  agentActivity: AgentActivity[]
  cancelPlanning: () => void
  exportPlan: (format: 'gpx' | 'pdf' | 'kml') => Promise<void>
}

interface AgentActivity {
  agentId: string
  agentName: string
  status: 'pending' | 'active' | 'completed' | 'error'
  message?: string
  timestamp: Date
}

export function usePassagePlanner(): UsePassagePlannerReturn {
  const [currentPlan, setCurrentPlan] = useState<PassagePlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('idle')
  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([])
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
  
  const { user } = useAuth()
  const { connected } = useSocket()

  // Listen for real-time updates
  // TODO: Implement WebSocket-based real-time updates
  // The socket.io client code needs to be replaced with WebSocket API
  useEffect(() => {
    if (!connected || !currentRequestId) return
    
    // WebSocket implementation placeholder
    // This will be implemented when the WebSocket protocol is finalized
  }, [connected, currentRequestId])

  const planPassage = useCallback(async (request: PassagePlanRequest) => {
    if (!user) {
      setError('You must be logged in to plan a passage')
      return
    }

    setLoading(true)
    setError(null)
    setProgress(0)
    setStatus('initializing')
    setAgentActivity([])
    setCurrentPlan(null)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/mcp/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          tool: 'plan_passage',
          arguments: request,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        
        // Handle subscription limits
        if (response.status === 403 && data.upgradeUrl) {
          throw new Error(`${data.error}. Please upgrade your subscription.`)
        }
        
        throw new Error(data.error || 'Failed to plan passage')
      }

      const data = await response.json()
      setCurrentRequestId(data.requestId)
      
      // If WebSocket is not connected, poll for updates
      if (!connected) {
        await pollForUpdates(data.requestId)
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
      setStatus('error')
    }
  }, [user, connected])

  const pollForUpdates = async (requestId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/passages/${requestId}/status`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            },
          }
        )

        if (!response.ok) throw new Error('Failed to get status')

        const data = await response.json()
        
        setProgress(data.progress)
        setStatus(data.status)
        
        if (data.status === 'completed') {
          setCurrentPlan(data.passagePlan)
          setLoading(false)
          clearInterval(pollInterval)
        } else if (data.status === 'error') {
          setError(data.error)
          setLoading(false)
          clearInterval(pollInterval)
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 2000)

    // Clear interval after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000)
  }

  const cancelPlanning = useCallback(() => {
    // TODO: Implement cancellation via WebSocket or API
    if (currentRequestId) {
      console.log('Cancel passage:', currentRequestId)
    }
    
    setLoading(false)
    setStatus('cancelled')
    setCurrentRequestId(null)
  }, [currentRequestId])

  const exportPlan = useCallback(async (format: 'gpx' | 'pdf' | 'kml') => {
    if (!currentPlan) {
      setError('No passage plan to export')
      return
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/passages/${currentPlan.id}/export`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify({ format }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        
        // Handle feature gating
        if (response.status === 403) {
          throw new Error(`${format.toUpperCase()} export requires a premium subscription`)
        }
        
        throw new Error(data.error || 'Export failed')
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `passage-plan-${currentPlan.id}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      // Track successful export
      analytics.trackRouteExported({
        format: format as 'gpx' | 'kml' | 'csv',
        waypoint_count: currentPlan.route?.waypoints?.length || 0,
        distance_nm: currentPlan.summary?.totalDistance,
      });
    } catch (err: any) {
      setError(err.message)
    }
  }, [currentPlan])

  return {
    planPassage,
    currentPlan,
    loading,
    error,
    progress,
    status,
    agentActivity,
    cancelPlanning,
    exportPlan,
  }
} 