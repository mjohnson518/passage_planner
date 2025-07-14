import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'

interface AgentStatus {
  id: string
  name: string
  status: 'active' | 'idle' | 'processing' | 'error'
  lastActivity?: Date
  performance?: {
    avgResponseTime: number
    successRate: number
  }
}

interface ActiveRequest {
  id: string
  tool: string
  targetAgent: string
  startTime: Date
  estimatedDuration?: number
}

interface PassagePlan {
  id: string
  departure: string
  destination: string
  waypoints: any[]
  distance: number
  estimatedDuration: number
  weather?: any
  tides?: any[]
  safety?: any
}

interface StoreState {
  // WebSocket connection
  socket: Socket | null
  connected: boolean
  
  // Agent states
  agentStatuses: Record<string, AgentStatus>
  activeRequests: ActiveRequest[]
  
  // Passage planning
  currentPlan: PassagePlan | null
  planningInProgress: boolean
  
  // Actions
  connectSocket: () => void
  disconnectSocket: () => void
  updateAgentStatus: (agentId: string, status: Partial<AgentStatus>) => void
  addActiveRequest: (request: ActiveRequest) => void
  removeActiveRequest: (requestId: string) => void
  setCurrentPlan: (plan: PassagePlan | null) => void
  setPlanningInProgress: (inProgress: boolean) => void
}

export const useStore = create<StoreState>((set, get) => ({
  // Initial state
  socket: null,
  connected: false,
  agentStatuses: {},
  activeRequests: [],
  currentPlan: null,
  planningInProgress: false,
  
  // Actions
  connectSocket: () => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8080', {
      transports: ['websocket'],
    })
    
    socket.on('connect', () => {
      console.log('Connected to orchestrator')
      set({ connected: true })
    })
    
    socket.on('disconnect', () => {
      console.log('Disconnected from orchestrator')
      set({ connected: false })
    })
    
    // Agent status updates
    socket.on('agent:status', (data: { agentId: string; status: Partial<AgentStatus> }) => {
      get().updateAgentStatus(data.agentId, data.status)
    })
    
    // Request tracking
    socket.on('request:start', (data: ActiveRequest) => {
      get().addActiveRequest(data)
    })
    
    socket.on('request:complete', (data: { requestId: string }) => {
      get().removeActiveRequest(data.requestId)
    })
    
    // Passage plan updates
    socket.on('plan:update', (data: { plan: PassagePlan }) => {
      set({ currentPlan: data.plan })
    })
    
    socket.on('plan:processing', (data: { agent: string; status: string }) => {
      // Update the specific agent's status to processing
      get().updateAgentStatus(data.agent, { status: 'processing' })
    })
    
    socket.on('plan:complete', (data: { plan: PassagePlan }) => {
      set({ 
        currentPlan: data.plan,
        planningInProgress: false 
      })
      
      // Reset all agents to idle
      const statuses = get().agentStatuses
      Object.keys(statuses).forEach(agentId => {
        get().updateAgentStatus(agentId, { status: 'idle' })
      })
    })
    
    socket.on('error', (error: any) => {
      console.error('Socket error:', error)
    })
    
    set({ socket })
  },
  
  disconnectSocket: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, connected: false })
    }
  },
  
  updateAgentStatus: (agentId: string, status: Partial<AgentStatus>) => {
    set((state) => ({
      agentStatuses: {
        ...state.agentStatuses,
        [agentId]: {
          id: agentId,
          name: agentId,
          ...state.agentStatuses[agentId],
          ...status,
          lastActivity: new Date(),
        },
      },
    }))
  },
  
  addActiveRequest: (request: ActiveRequest) => {
    set((state) => ({
      activeRequests: [...state.activeRequests, request],
    }))
    
    // Update agent status to processing
    get().updateAgentStatus(request.targetAgent, { status: 'processing' })
  },
  
  removeActiveRequest: (requestId: string) => {
    set((state) => {
      const request = state.activeRequests.find(r => r.id === requestId)
      if (request) {
        // Update agent status back to active
        get().updateAgentStatus(request.targetAgent, { status: 'active' })
      }
      
      return {
        activeRequests: state.activeRequests.filter(r => r.id !== requestId),
      }
    })
  },
  
  setCurrentPlan: (plan: PassagePlan | null) => {
    set({ currentPlan: plan })
  },
  
  setPlanningInProgress: (inProgress: boolean) => {
    set({ planningInProgress: inProgress })
  },
})) 