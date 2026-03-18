'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

interface PlanningUpdate {
  type: 'planning_started' | 'agent_active' | 'planning_completed' | 'planning_error';
  planningId: string;
  agent?: string;
  status?: string;
  plan?: any;
  error?: string;
  request?: any;
}

interface AgentStatus {
  name: string;
  status: string;
  message?: string;
}

interface SocketContextType {
  connected: boolean
  agentStatuses: Record<string, AgentStatus>
  currentPlanningId: string | null
  subscribe: (handler: (update: PlanningUpdate) => void) => void
  unsubscribe: (handler: (update: PlanningUpdate) => void) => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [connected, setConnected] = useState(false)
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({})
  const [currentPlanningId, setCurrentPlanningId] = useState<string | null>(null)
  const handlersRef = useRef<Set<(update: PlanningUpdate) => void>>(new Set())
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:8080'

    const socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000,
      withCredentials: true,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error.message)
    })

    socket.on('authenticated', () => {
    })

    socket.on('authentication_error', () => {
      console.warn('Socket.IO authentication failed')
    })

    // Planning event handlers (matches server.ts orchestrator event forwarding)
    const handlePlanningUpdate = (update: PlanningUpdate) => {
      switch (update.type) {
        case 'planning_started':
          setCurrentPlanningId(update.planningId)
          setAgentStatuses({})
          break

        case 'agent_active':
          if (update.agent) {
            setAgentStatuses(prev => ({
              ...prev,
              [update.agent!]: {
                name: update.agent!,
                status: 'active',
                message: update.status,
              },
            }))
          }
          break

        case 'planning_completed':
          setAgentStatuses(prev => {
            const updated = { ...prev }
            Object.keys(updated).forEach(key => {
              updated[key] = { ...updated[key], status: 'complete' }
            })
            return updated
          })
          break

        case 'planning_error':
          setAgentStatuses({})
          break
      }

      // Notify all subscribed handlers
      handlersRef.current.forEach(handler => handler(update))
    }

    // The server emits planning updates as JSON messages on the 'message' event
    // and structured updates on named events
    socket.on('planning_update', handlePlanningUpdate)
    socket.on('agent_status', handlePlanningUpdate)
    socket.on('progress', handlePlanningUpdate)

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const subscribe = (handler: (update: PlanningUpdate) => void) => {
    handlersRef.current.add(handler)
  }

  const unsubscribe = (handler: (update: PlanningUpdate) => void) => {
    handlersRef.current.delete(handler)
  }

  return (
    <SocketContext.Provider
      value={{
        connected,
        agentStatuses,
        currentPlanningId,
        subscribe,
        unsubscribe,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
