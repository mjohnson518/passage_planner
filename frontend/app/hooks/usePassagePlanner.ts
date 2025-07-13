'use client'

import { useState, useCallback, useEffect } from 'react'
import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'
import { Message, PassagePlan, AgentStatus } from '../types'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { config } from '../config'

interface PassagePlannerStore {
  messages: Message[]
  currentPlan: PassagePlan | null
  activeAgents: AgentStatus[]
  isProcessing: boolean
  socket: Socket | null
  
  addMessage: (message: Message) => void
  setCurrentPlan: (plan: PassagePlan | null) => void
  updateAgentStatus: (agentId: string, status: Partial<AgentStatus>) => void
  setProcessing: (processing: boolean) => void
  setSocket: (socket: Socket | null) => void
  clearMessages: () => void
}

const usePassagePlannerStore = create<PassagePlannerStore>((set) => ({
  messages: [],
  currentPlan: null,
  activeAgents: [],
  isProcessing: false,
  socket: null,
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  setCurrentPlan: (plan) => set({ currentPlan: plan }),
  
  updateAgentStatus: (agentId, status) => set((state) => ({
    activeAgents: state.activeAgents.map(agent =>
      agent.id === agentId ? { ...agent, ...status } : agent
    )
  })),
  
  setProcessing: (processing) => set({ isProcessing: processing }),
  
  setSocket: (socket) => set({ socket }),
  
  clearMessages: () => set({ messages: [], currentPlan: null }),
}))

export function usePassagePlanner() {
  const store = usePassagePlannerStore()
  const [connected, setConnected] = useState(false)
  
  // Initialize WebSocket connection
  useEffect(() => {
    const socket = io(config.api.wsUrl, {
      transports: ['websocket'],
      autoConnect: true,
    })
    
    socket.on('connect', () => {
      setConnected(true)
      console.log('Connected to orchestrator')
    })
    
    socket.on('disconnect', () => {
      setConnected(false)
      console.log('Disconnected from orchestrator')
    })
    
    socket.on('agent:status', (status: AgentStatus) => {
      store.updateAgentStatus(status.id, status)
    })
    
    socket.on('processing:update', (data: { message: string; progress?: number }) => {
      store.addMessage({
        id: `system-${Date.now()}`,
        role: 'system',
        content: data.message,
        timestamp: new Date(),
      })
    })
    
    socket.on('plan:complete', (plan: PassagePlan) => {
      store.setCurrentPlan(plan)
      store.setProcessing(false)
    })
    
    socket.on('error', (error: any) => {
      toast.error(error.message || 'An error occurred')
      store.setProcessing(false)
    })
    
    store.setSocket(socket)
    
    return () => {
      socket.disconnect()
      store.setSocket(null)
    }
  }, [])
  
  // Plan passage mutation
  const planPassageMutation = useMutation({
    mutationFn: async (params: {
      departure: string
      destination: string
      departureTime: string
      preferences?: {
        avoidNightSailing?: boolean
        maxWindSpeed?: number
        maxWaveHeight?: number
      }
    }) => {
      const response = await fetch(`${config.api.url}/api/mcp/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'plan_passage',
          arguments: params,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to plan passage')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      if (data.content && data.content[0]) {
        const plan = JSON.parse(data.content[0].text) as PassagePlan
        store.setCurrentPlan(plan)
        
        store.addMessage({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: 'I\'ve created your passage plan. You can view the details in the map tab.',
          timestamp: new Date(),
          metadata: {
            plan,
            processingTime: data.processingTime,
            agentsUsed: data.agentsUsed,
          },
        })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
      store.addMessage({
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error: ${error.message}`,
        timestamp: new Date(),
      })
    },
  })
  
  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }
    store.addMessage(userMessage)
    
    // Parse the message to extract passage planning parameters
    const departureMatch = content.match(/from\s+([^to]+)\s+to/i)
    const destinationMatch = content.match(/to\s+([^on|departing|leaving]+)/i)
    const dateMatch = content.match(/on\s+(\d{4}-\d{2}-\d{2})/i)
    
    if (departureMatch && destinationMatch) {
      store.setProcessing(true)
      
      planPassageMutation.mutate({
        departure: departureMatch[1].trim(),
        destination: destinationMatch[1].trim(),
        departureTime: dateMatch ? dateMatch[1] : new Date().toISOString(),
      })
    } else {
      // Handle other types of queries
      store.addMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'I can help you plan a sailing passage. Try something like "Plan a passage from Boston to Portland on 2024-07-15"',
        timestamp: new Date(),
      })
    }
  }, [planPassageMutation, store])
  
  return {
    messages: store.messages,
    currentPlan: store.currentPlan,
    activeAgents: store.activeAgents,
    isProcessing: store.isProcessing,
    connected,
    sendMessage,
    clearMessages: store.clearMessages,
  }
} 