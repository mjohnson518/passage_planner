'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
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
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({})
  const [currentPlanningId, setCurrentPlanningId] = useState<string | null>(null)
  const handlersRef = useRef<Set<(update: PlanningUpdate) => void>>(new Set())

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('WebSocket connected to orchestrator');
      setConnected(true);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onmessage = (event) => {
      try {
        const update: PlanningUpdate = JSON.parse(event.data);
        
        // Handle different update types
        switch (update.type) {
          case 'planning_started':
            setCurrentPlanningId(update.planningId);
            setAgentStatuses({});
            break;
            
          case 'agent_active':
            if (update.agent) {
              setAgentStatuses(prev => ({
                ...prev,
                [update.agent!]: {
                  name: update.agent!,
                  status: 'active',
                  message: update.status
                }
              }));
            }
            break;
            
          case 'planning_completed':
            if (update.planningId === currentPlanningId) {
              // Mark all agents as complete
              setAgentStatuses(prev => {
                const updated = { ...prev };
                Object.keys(updated).forEach(key => {
                  updated[key].status = 'complete';
                });
                return updated;
              });
            }
            break;
            
          case 'planning_error':
            setAgentStatuses({});
            break;
        }
        
        // Notify all subscribed handlers
        handlersRef.current.forEach(handler => handler(update));
        
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  const subscribe = (handler: (update: PlanningUpdate) => void) => {
    handlersRef.current.add(handler);
  };

  const unsubscribe = (handler: (update: PlanningUpdate) => void) => {
    handlersRef.current.delete(handler);
  };

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