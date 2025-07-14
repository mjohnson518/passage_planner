'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { AgentStatus } from '../../types'
import { Activity, AlertCircle, CheckCircle, Clock } from 'lucide-react'

interface AgentNode {
  id: string
  name: string
  status: AgentStatus['status']
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface AgentLink {
  source: string
  target: string
  active: boolean
}

export function AgentVisualizer({ activeAgents }: { activeAgents: AgentStatus[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  useEffect(() => {
    if (!svgRef.current || activeAgents.length === 0) return

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)

    // Create nodes from active agents
    const orchestratorNode: AgentNode = {
      id: 'orchestrator',
      name: 'Orchestrator',
      status: 'active',
      fx: width / 2,
      fy: height / 2,
    }

    const agentNodes: AgentNode[] = [
      orchestratorNode,
      ...activeAgents.map((agent, index) => ({
        id: agent.id,
        name: agent.name,
        status: agent.status,
        x: width / 2 + Math.cos((2 * Math.PI * index) / activeAgents.length) * 200,
        y: height / 2 + Math.sin((2 * Math.PI * index) / activeAgents.length) * 200,
      })),
    ]

    // Create links from orchestrator to each agent
    const links: AgentLink[] = activeAgents.map(agent => ({
      source: 'orchestrator',
      target: agent.id,
      active: agent.status === 'processing',
    }))

    // Create force simulation
    const simulation = d3.forceSimulation<AgentNode>(agentNodes)
      .force('link', d3.forceLink<AgentNode, AgentLink>(links)
        .id(d => d.id)
        .distance(200))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50))

    // Create gradient definitions for active links
    const defs = svg.append('defs')
    
    const gradient = defs.append('linearGradient')
      .attr('id', 'link-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#0ea5e9')
      .attr('stop-opacity', 0.2)

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#0ea5e9')
      .attr('stop-opacity', 1)

    // Create links
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('class', d => d.active ? 'agent-link active' : 'agent-link')
      .attr('stroke', d => d.active ? 'url(#link-gradient)' : '#e5e7eb')
      .attr('stroke-width', d => d.active ? 3 : 2)

    // Create node groups
    const node = svg.append('g')
      .selectAll('g')
      .data(agentNodes)
      .enter().append('g')
      .attr('class', 'agent-node')
      .on('click', (event, d) => setSelectedAgent(d.id))
      .call(d3.drag<SVGGElement, AgentNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))

    // Add circles for nodes
    node.append('circle')
      .attr('r', d => d.id === 'orchestrator' ? 40 : 30)
      .attr('fill', d => getNodeColor(d.status))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    // Add icons
    node.each(function(d) {
      const g = d3.select(this)
      const iconSize = d.id === 'orchestrator' ? 24 : 18
      
      g.append('foreignObject')
        .attr('x', -iconSize / 2)
        .attr('y', -iconSize / 2)
        .attr('width', iconSize)
        .attr('height', iconSize)
        .append('xhtml:div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center')
        .style('width', '100%')
        .style('height', '100%')
        .html(() => getNodeIcon(d.status, iconSize))
    })

    // Add labels
    node.append('text')
      .attr('dy', d => d.id === 'orchestrator' ? 55 : 45)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-sm font-medium fill-gray-700')
      .text(d => d.name)

    // Add status indicators
    node.append('circle')
      .attr('r', 5)
      .attr('cx', d => d.id === 'orchestrator' ? 30 : 22)
      .attr('cy', d => d.id === 'orchestrator' ? -30 : -22)
      .attr('fill', d => getStatusColor(d.status))
      .attr('class', d => d.status === 'processing' ? 'animate-pulse' : '')

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => {
          const source = agentNodes.find(n => n.id === (d.source as any).id || d.source)
          return source?.x || 0
        })
        .attr('y1', d => {
          const source = agentNodes.find(n => n.id === (d.source as any).id || d.source)
          return source?.y || 0
        })
        .attr('x2', d => {
          const target = agentNodes.find(n => n.id === (d.target as any).id || d.target)
          return target?.x || 0
        })
        .attr('y2', d => {
          const target = agentNodes.find(n => n.id === (d.target as any).id || d.target)
          return target?.y || 0
        })

      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    function dragstarted(event: any, d: AgentNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: AgentNode) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: any, d: AgentNode) {
      if (!event.active) simulation.alphaTarget(0)
      if (d.id !== 'orchestrator') {
        d.fx = null
        d.fy = null
      }
    }

    return () => {
      simulation.stop()
    }
  }, [activeAgents])

  const getNodeColor = (status: AgentStatus['status']) => {
    switch (status) {
      case 'active':
        return '#10b981'
      case 'processing':
        return '#0ea5e9'
      case 'error':
        return '#ef4444'
      case 'idle':
      default:
        return '#6b7280'
    }
  }

  const getStatusColor = (status: AgentStatus['status']) => {
    switch (status) {
      case 'active':
        return '#10b981'
      case 'processing':
        return '#3b82f6'
      case 'error':
        return '#ef4444'
      case 'idle':
      default:
        return '#9ca3af'
    }
  }

  const getNodeIcon = (status: AgentStatus['status'], size: number) => {
    const className = `w-${size}px h-${size}px text-white`
    switch (status) {
      case 'active':
        return `<svg class="${className}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`
      case 'processing':
        return `<svg class="${className} animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>`
      case 'error':
        return `<svg class="${className}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
      default:
        return `<svg class="${className}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    }
  }

  const selectedAgentData = activeAgents.find(a => a.id === selectedAgent)

  return (
    <div className="flex h-full">
      <div className="flex-1 relative">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ background: '#fafafa' }}
        />
      </div>

      {/* Agent Details Panel */}
      <div className="w-80 bg-white border-l p-6 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Agent Network</h3>
        
        {selectedAgentData ? (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">{selectedAgentData.name}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`flex items-center gap-1 ${
                    selectedAgentData.status === 'active' ? 'text-green-600' :
                    selectedAgentData.status === 'processing' ? 'text-blue-600' :
                    selectedAgentData.status === 'error' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {selectedAgentData.status === 'active' && <CheckCircle className="h-4 w-4" />}
                    {selectedAgentData.status === 'processing' && <Activity className="h-4 w-4" />}
                    {selectedAgentData.status === 'error' && <AlertCircle className="h-4 w-4" />}
                    {selectedAgentData.status === 'idle' && <Clock className="h-4 w-4" />}
                    {selectedAgentData.status}
                  </span>
                </div>
                {selectedAgentData.currentOperation && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Operation</span>
                    <span className="text-gray-900">{selectedAgentData.currentOperation}</span>
                  </div>
                )}
                {selectedAgentData.performance && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Avg Response</span>
                      <span className="text-gray-900">{selectedAgentData.performance.averageResponseTime}ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Success Rate</span>
                      <span className="text-gray-900">{(selectedAgentData.performance.successRate * 100).toFixed(1)}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">
            <p className="mb-4">Click on an agent to view details</p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span>Active - Ready to process</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse"></div>
                <span>Processing - Working on request</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                <span>Idle - No current tasks</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span>Error - Needs attention</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t">
          <h4 className="font-medium text-gray-900 mb-3">Active Agents</h4>
          <div className="space-y-2">
            {activeAgents.map(agent => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedAgent === agent.id
                    ? 'bg-ocean-50 border border-ocean-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{agent.name}</span>
                  <div className={`w-2 h-2 rounded-full ${
                    agent.status === 'active' ? 'bg-green-500' :
                    agent.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                    agent.status === 'error' ? 'bg-red-500' :
                    'bg-gray-400'
                  }`} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 