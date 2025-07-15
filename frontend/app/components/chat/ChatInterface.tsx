'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Anchor, AlertCircle, Map, Activity, Route, Cloud } from 'lucide-react'
import { usePassagePlanner } from '../../hooks/usePassagePlanner'
import { useStore } from '../../store'
import { formatDate } from '../../lib/utils'
import { Message } from '../../types'
import ReactMarkdown from 'react-markdown'

export function ChatInterface() {
  const { messages, sendMessage, isProcessing } = usePassagePlanner()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  // Real-time agent status
  const activeRequests = useStore((state) => state.activeRequests)
  const agentStatuses = useStore((state) => state.agentStatuses)
  const planningInProgress = useStore((state) => state.planningInProgress)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return

    const message = input.trim()
    setInput('')
    
    // Set planning in progress if it's a passage planning request
    if (message.toLowerCase().includes('plan') || message.toLowerCase().includes('passage')) {
      useStore.getState().setPlanningInProgress(true)
    }
    
    await sendMessage(message)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }
  
  // Get processing agents
  const processingAgents = Object.values(agentStatuses).filter(
    agent => agent.status === 'processing'
  )

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-16 animate-fade-in">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-gradient-ocean blur-2xl opacity-30 animate-pulse-slow"></div>
              <Anchor className="relative h-16 w-16 text-ocean-500 dark:text-ocean-400 animate-float" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              Welcome aboard, Captain!
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8">
              I'm your AI-powered passage planning assistant. I can help you plan safe routes, 
              check weather conditions, and navigate with confidence.
            </p>
            <div className="space-y-3 max-w-lg mx-auto">
              <button
                onClick={() => setInput('Plan a passage from Boston to Portland on July 15')}
                className="w-full p-4 text-left rounded-xl glass-hover hover:shadow-lg transition-all duration-200 group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-ocean-100 dark:bg-ocean-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <Map className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Plan a passage</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                "Plan a passage from Boston to Portland on July 15"
                    </p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setInput('What\'s the weather forecast for Cape Cod this weekend?')}
                className="w-full p-4 text-left rounded-xl glass-hover hover:shadow-lg transition-all duration-200 group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-ocean-100 dark:bg-ocean-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <AlertCircle className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Check weather</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                "What's the weather forecast for Cape Cod this weekend?"
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`animate-fade-up animation-delay-${Math.min(index * 100, 500)}`}
          >
            <MessageBubble message={message} />
          </div>
        ))}

        {isProcessing && (
          <div className="space-y-3">
            {/* Main processing indicator */}
            <div className="flex items-center gap-3 p-4 rounded-xl glass animate-fade-in">
              <div className="relative">
                <Loader2 className="h-5 w-5 text-ocean-600 dark:text-ocean-400 animate-spin" />
                <div className="absolute inset-0 bg-ocean-500 blur-xl opacity-30 animate-pulse"></div>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Planning your passage...
              </span>
            </div>
            
            {/* Active agents indicator */}
            {processingAgents.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4">
                {processingAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 animate-fade-in"
                  >
                    <Activity className="h-3 w-3 text-blue-600 dark:text-blue-400 animate-pulse" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      {agent.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Active requests */}
            {activeRequests.length > 0 && (
              <div className="px-4 space-y-1">
                {activeRequests.slice(0, 3).map((request) => (
                  <div
                    key={request.id}
                    className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2"
                  >
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                    <span>
                      {request.tool} → {agentStatuses[request.targetAgent]?.name || request.targetAgent}
                    </span>
                  </div>
                ))}
                {activeRequests.length > 3 && (
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    +{activeRequests.length - 3} more...
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Modern Input Area */}
      <form onSubmit={handleSubmit} className="p-4 glass border-t border-white/20 dark:border-gray-800/30">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about passages, weather, tides, or ports..."
              className="w-full resize-none rounded-xl input-modern pr-12"
            rows={1}
              disabled={isProcessing}
              style={{ minHeight: '48px', maxHeight: '120px' }}
          />
            <div className="absolute right-2 bottom-2 text-xs text-gray-400">
              {input.length > 0 && `${input.length}/1000`}
            </div>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="btn-primary rounded-xl px-4 py-3 min-w-[48px]"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isError = message.role === 'system' && message.content.includes('Error')

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div
        className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-soft transition-all duration-200 ${
          isUser
            ? 'bg-gradient-ocean text-white ml-12'
            : isError
            ? 'bg-danger-50 dark:bg-danger-900/20 text-danger-900 dark:text-danger-200 border border-danger-200 dark:border-danger-800 mr-12'
            : 'glass mr-12 hover:shadow-lg'
        }`}
      >
        <div className="text-sm">
          {isUser ? (
            message.content
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-gray">
            <ReactMarkdown
              components={{
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ocean-600 dark:text-ocean-400 hover:text-ocean-700 dark:hover:text-ocean-300 underline"
                  >
                    {children}
                  </a>
                ),
                p: ({ children }) => <p className="text-gray-900 dark:text-gray-100">{children}</p>,
                li: ({ children }) => <li className="text-gray-900 dark:text-gray-100">{children}</li>,
                strong: ({ children }) => <strong className="text-gray-900 dark:text-white font-semibold">{children}</strong>,
              }}
            >
              {message.content}
            </ReactMarkdown>
            </div>
          )}
        </div>
        
        {/* Timestamp and Metadata */}
        <div className={`mt-2 space-y-1 ${isUser ? 'text-right' : 'text-left'}`}>
          <div className={`text-xs ${
            isUser ? 'text-ocean-200/70' : 'text-gray-500 dark:text-gray-400'
          } opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
          {formatDate(message.timestamp)}
        </div>
          
        {message.metadata?.agentsUsed && (
            <div className="flex items-center gap-2 flex-wrap">
              {message.metadata.agentsUsed.map((agent, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium badge-ocean"
                >
                  {agent}
                </span>
              ))}
          </div>
        )}
        </div>
      </div>
    </div>
  )
} 