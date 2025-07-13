'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Anchor, AlertCircle } from 'lucide-react'
import { usePassagePlanner } from '@/app/hooks/usePassagePlanner'
import { formatDate } from '@/app/lib/utils'
import { Message } from '@/app/types'
import ReactMarkdown from 'react-markdown'

export function ChatInterface() {
  const { messages, sendMessage, isProcessing, connected } = usePassagePlanner()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    await sendMessage(message)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Connection status */}
      {!connected && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-yellow-800">
            <AlertCircle className="h-4 w-4" />
            <span>Connecting to passage planner service...</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Anchor className="h-12 w-12 mx-auto text-ocean-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Welcome to Passage Planner
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              I can help you plan safe sailing passages. Try asking:
            </p>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => setInput('Plan a passage from Boston to Portland on July 15')}
                className="text-sm text-ocean-600 hover:text-ocean-700"
              >
                "Plan a passage from Boston to Portland on July 15"
              </button>
              <br />
              <button
                onClick={() => setInput('What\'s the weather forecast for Cape Cod this weekend?')}
                className="text-sm text-ocean-600 hover:text-ocean-700"
              >
                "What's the weather forecast for Cape Cod this weekend?"
              </button>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Planning your passage...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about passages, weather, tides, or ports..."
            className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 focus:border-ocean-500 focus:outline-none focus:ring-1 focus:ring-ocean-500"
            rows={1}
            disabled={isProcessing || !connected}
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing || !connected}
            className="rounded-lg bg-ocean-600 px-4 py-2 text-white hover:bg-ocean-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-ocean-600 text-white'
            : isError
            ? 'bg-red-50 text-red-900 border border-red-200'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        <div className="text-sm">
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              className="prose prose-sm max-w-none"
              components={{
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ocean-600 hover:text-ocean-700 underline"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        <div
          className={`text-xs mt-1 ${
            isUser ? 'text-ocean-100' : 'text-gray-500'
          }`}
        >
          {formatDate(message.timestamp)}
        </div>
        {message.metadata?.agentsUsed && (
          <div className="text-xs mt-1 text-gray-500">
            Agents: {message.metadata.agentsUsed.join(', ')}
          </div>
        )}
      </div>
    </div>
  )
} 