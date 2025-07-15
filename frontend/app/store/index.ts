import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { PassagePlan, UIPreferences, ChatMessage, MapViewport, RouteLayer } from '../types'

interface AppState {
  // Passage plans
  passagePlans: PassagePlan[]
  currentPlanId: string | null
  addPassagePlan: (plan: PassagePlan) => void
  setCurrentPlan: (planId: string | null) => void
  updatePassagePlan: (planId: string, updates: Partial<PassagePlan>) => void
  deletePassagePlan: (planId: string) => void
  
  // Chat interface
  messages: ChatMessage[]
  addMessage: (message: ChatMessage) => void
  clearMessages: () => void
  
  // Map state
  viewport: MapViewport
  setViewport: (viewport: MapViewport) => void
  layers: RouteLayer[]
  toggleLayer: (layerId: string) => void
  addLayer: (layer: RouteLayer) => void
  removeLayer: (layerId: string) => void
  
  // UI preferences
  preferences: UIPreferences
  updatePreferences: (updates: Partial<UIPreferences>) => void
  
  // Offline queue
  offlineQueue: any[]
  addToOfflineQueue: (action: any) => void
  clearOfflineQueue: () => void
  
  // Session state
  lastSync: Date | null
  setLastSync: (date: Date) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Passage plans
      passagePlans: [],
      currentPlanId: null,
      
      addPassagePlan: (plan) =>
        set((state) => ({
          passagePlans: [...state.passagePlans, plan].slice(-5), // Keep last 5 plans
          currentPlanId: plan.id,
        })),
        
      setCurrentPlan: (planId) =>
        set({ currentPlanId: planId }),
        
      updatePassagePlan: (planId, updates) =>
        set((state) => ({
          passagePlans: state.passagePlans.map((plan) =>
            plan.id === planId ? { ...plan, ...updates } : plan
          ),
        })),
        
      deletePassagePlan: (planId) =>
        set((state) => ({
          passagePlans: state.passagePlans.filter((plan) => plan.id !== planId),
          currentPlanId: state.currentPlanId === planId ? null : state.currentPlanId,
        })),
      
      // Chat interface
      messages: [],
      
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message].slice(-50), // Keep last 50 messages
        })),
        
      clearMessages: () =>
        set({ messages: [] }),
      
      // Map state
      viewport: {
        latitude: 42.3601,
        longitude: -71.0589,
        zoom: 8,
      },
      
      setViewport: (viewport) =>
        set({ viewport }),
        
      layers: [
        { id: 'route', name: 'Route', visible: true, type: 'route', data: null },
        { id: 'weather', name: 'Weather', visible: true, type: 'weather', data: null },
        { id: 'tidal', name: 'Tides', visible: false, type: 'tidal', data: null },
        { id: 'safety', name: 'Safety', visible: false, type: 'safety', data: null },
      ],
      
      toggleLayer: (layerId) =>
        set((state) => ({
          layers: state.layers.map((layer) =>
            layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
          ),
        })),
        
      addLayer: (layer) =>
        set((state) => ({
          layers: [...state.layers, layer],
        })),
        
      removeLayer: (layerId) =>
        set((state) => ({
          layers: state.layers.filter((layer) => layer.id !== layerId),
        })),
      
      // UI preferences
      preferences: {
        theme: 'system',
        units: 'imperial',
        mapStyle: 'nautical',
        language: 'en',
        timezone: 'UTC',
      },
      
      updatePreferences: (updates) =>
        set((state) => ({
          preferences: { ...state.preferences, ...updates },
        })),
      
      // Offline queue
      offlineQueue: [],
      
      addToOfflineQueue: (action) =>
        set((state) => ({
          offlineQueue: [...state.offlineQueue, action],
        })),
        
      clearOfflineQueue: () =>
        set({ offlineQueue: [] }),
      
      // Session state
      lastSync: null,
      
      setLastSync: (date) =>
        set({ lastSync: date }),
    }),
    {
      name: 'passage-planner-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist certain parts of the state
        passagePlans: state.passagePlans,
        preferences: state.preferences,
        viewport: state.viewport,
        layers: state.layers.map(l => ({ ...l, data: null })), // Don't persist layer data
        offlineQueue: state.offlineQueue,
      }),
    }
  )
)

// Selectors
export const useCurrentPlan = () => {
  const currentPlanId = useStore((state) => state.currentPlanId)
  const passagePlans = useStore((state) => state.passagePlans)
  return passagePlans.find((plan) => plan.id === currentPlanId) || null
}

export const useVisibleLayers = () => {
  return useStore((state) => state.layers.filter((layer) => layer.visible))
}

export const useOfflineMode = () => {
  const offlineQueue = useStore((state) => state.offlineQueue)
  const lastSync = useStore((state) => state.lastSync)
  return {
    hasOfflineData: offlineQueue.length > 0,
    queueSize: offlineQueue.length,
    lastSync,
  }
} 