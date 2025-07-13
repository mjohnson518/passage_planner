'use client'

import { useState } from 'react'
import { ChatInterface } from './components/chat/ChatInterface'
import { AgentVisualizer } from './components/visualization/AgentVisualizer'
import { PassageMapViewer } from './components/map/PassageMapViewer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { usePassagePlanner } from './hooks/usePassagePlanner'
import { Compass, Map, MessageSquare, Network } from 'lucide-react'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('chat')
  const { currentPlan, activeAgents } = usePassagePlanner()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Compass className="h-8 w-8 text-ocean-600" />
            <h1 className="text-xl font-bold text-gray-900">Passage Planner</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {activeAgents.length > 0 && `${activeAgents.length} agents active`}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-16 w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="px-6 py-4 bg-white border-b">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="map" className="flex items-center gap-2">
                <Map className="h-4 w-4" />
                Map
              </TabsTrigger>
              <TabsTrigger value="agents" className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                Agents
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="h-[calc(100%-4rem)]">
            <TabsContent value="chat" className="h-full m-0">
              <ChatInterface />
            </TabsContent>

            <TabsContent value="map" className="h-full m-0">
              <PassageMapViewer plan={currentPlan} />
            </TabsContent>

            <TabsContent value="agents" className="h-full m-0">
              <AgentVisualizer activeAgents={activeAgents} />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  )
} 