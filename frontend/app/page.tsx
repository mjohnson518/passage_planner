'use client'

import { useState, useEffect } from 'react'
import { ChatInterface } from './components/chat/ChatInterface'
import { AgentVisualizer } from './components/visualization/AgentVisualizer'
import { PassageMapViewer } from './components/map/PassageMapViewer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { usePassagePlanner } from './hooks/usePassagePlanner'
import { Anchor, Map, MessageSquare, Network, Moon, Sun, Menu, X, Activity } from 'lucide-react'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('chat')
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { activeAgents } = usePassagePlanner()
  const currentPlan = null // Placeholder for now

  useEffect(() => {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    
    if (newMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-ocean-50 via-white to-sand-50 dark:from-gray-950 dark:via-gray-900 dark:to-ocean-950/20 transition-colors duration-500">
      {/* Modern Glass Header */}
      <header className="fixed top-0 left-0 right-0 h-16 glass z-50 border-b border-white/20 dark:border-gray-800/30">
        <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-ocean blur-xl opacity-50 animate-pulse-slow"></div>
              <div className="relative p-2.5 bg-gradient-ocean rounded-xl shadow-lg shadow-ocean-500/25">
                <Anchor className="h-6 w-6 text-white animate-float" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-ocean-600 to-ocean-800 dark:from-ocean-400 dark:to-ocean-600 bg-clip-text text-transparent">
                Passage Planner
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                AI-Powered Maritime Navigation
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            {/* Agent Status Badge */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full glass">
              <Activity className={`h-4 w-4 ${activeAgents.length > 0 ? 'text-success-500 animate-pulse' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {activeAgents.length} {activeAgents.length === 1 ? 'agent' : 'agents'} active
            </span>
          </div>
            
            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2.5 rounded-xl glass-hover hover:shadow-lg transition-all duration-200 focus-visible-ring"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5 text-amber-500" />
              ) : (
                <Moon className="h-5 w-5 text-ocean-600" />
              )}
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2.5 rounded-xl glass-hover transition-all duration-200"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 dark:border-gray-800/30 glass animate-fade-down">
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-gray-800/50">
                <span className="text-sm font-medium">Agent Status</span>
                <div className="flex items-center gap-2">
                  <Activity className={`h-4 w-4 ${activeAgents.length > 0 ? 'text-success-500 animate-pulse' : 'text-gray-400'}`} />
                  <span className="text-sm font-bold">
                    {activeAgents.length} active
                  </span>
                </div>
              </div>
              <button
                onClick={toggleDarkMode}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-colors"
              >
                <span className="text-sm font-medium">Dark Mode</span>
                {isDarkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-ocean-600" />}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content with Modern Tab Design */}
      <main className="flex-1 pt-16 w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="px-4 sm:px-6 lg:px-8 py-4 glass border-b border-white/20 dark:border-gray-800/30">
            <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3 bg-white/50 dark:bg-gray-800/50 p-1 rounded-xl">
              <TabsTrigger 
                value="chat" 
                className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-soft rounded-lg transition-all duration-200"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Chat</span>
              </TabsTrigger>
              <TabsTrigger 
                value="map" 
                className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-soft rounded-lg transition-all duration-200"
              >
                <Map className="h-4 w-4" />
                <span className="hidden sm:inline">Map</span>
              </TabsTrigger>
              <TabsTrigger 
                value="agents" 
                className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-soft rounded-lg transition-all duration-200"
              >
                <Network className="h-4 w-4" />
                <span className="hidden sm:inline">Agents</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="h-[calc(100%-5rem)] overflow-hidden">
            <TabsContent value="chat" className="h-full m-0 animate-fade-in">
              <div className="h-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="h-full card">
              <ChatInterface />
                </div>
              </div>
            </TabsContent>

                        <TabsContent value="map" className="h-full m-0 animate-fade-in">
              <div className="h-full p-4 sm:p-6 lg:p-8">
                <div className="h-full card overflow-hidden">
                  <PassageMapViewer plan={currentPlan || undefined} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="agents" className="h-full m-0 animate-fade-in">
              <div className="h-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="h-full card">
              <AgentVisualizer activeAgents={activeAgents} />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  )
} 