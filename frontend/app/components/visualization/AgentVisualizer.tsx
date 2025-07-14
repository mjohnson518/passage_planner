'use client'

import React from 'react'

interface AgentVisualizerProps {
  activeAgents: string[]
}

export function AgentVisualizer({ activeAgents }: AgentVisualizerProps) {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Agent Network</h2>
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
        <p className="text-gray-600 dark:text-gray-400">
          Active Agents: {activeAgents.length}
        </p>
        {activeAgents.length > 0 && (
          <ul className="mt-2 space-y-1">
            {activeAgents.map((agent, index) => (
              <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                • {agent}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
} 