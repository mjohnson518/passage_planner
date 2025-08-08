'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { config } from '@/config'
import { AgentStatus } from '@/types'
import { useAuth } from './AuthContext'

interface SocketContextType {
  socket: Socket | null
  connected: boolean
  agentStatus: Record<string, AgentStatus>
  activeRequests: string[]
  subscribe: (event: string, handler: (data: any) => void) => void
  unsubscribe: (event: string, handler: (data: any) => void) => void
  emit: (event: string, data: any) => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [agentStatus, setAgentStatus] = useState<Record<string, AgentStatus>>({})
  const [activeRequests, setActiveRequests] = useState<string[]>([])
  const { session } = useAuth()

  useEffect(() => {
    if (!session?.access_token) {
      return
    }

    // Initialize socket connection
    const socketInstance = io(config.api.wsUrl, {
      auth: {
        token: session.access_token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    // Connection handlers
    socketInstance.on('connect', () => {
      console.log('Socket connected')
      setConnected(true)
    })

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected')
      setConnected(false)
    })

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
    })

    // Agent status updates
    socketInstance.on('agent:status', (payload: any) => {
      const { name, status } = payload || {}
      if (!name) return
      setAgentStatus(prev => ({
        ...prev,
        [name]: status,
      }))
    })

    // Request tracking
    socketInstance.on('request:start', (requestId: string) => {
      setActiveRequests(prev => [...prev, requestId])
    })

    socketInstance.on('request:complete', (requestId: string) => {
      setActiveRequests(prev => prev.filter(id => id !== requestId))
    })

    // Processing updates
    socketInstance.on('processing:update', (update: any) => {
      // Handle processing updates (could trigger UI updates)
      console.log('Processing update:', update)
    })

    setSocket(socketInstance)

    // Cleanup on unmount
    return () => {
      socketInstance.close()
    }
  }, [session])

  const subscribe = (event: string, handler: (data: any) => void) => {
    if (socket) {
      socket.on(event, handler)
    }
  }

  const unsubscribe = (event: string, handler: (data: any) => void) => {
    if (socket) {
      socket.off(event, handler)
    }
  }

  const emit = (event: string, data: any) => {
    if (socket && connected) {
      socket.emit(event, data)
    }
  }

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        agentStatus,
        activeRequests,
        subscribe,
        unsubscribe,
        emit,
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