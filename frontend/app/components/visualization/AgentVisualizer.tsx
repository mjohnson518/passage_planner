'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Activity, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react'
import { useStore } from '../../store'

interface AgentVisualizerProps {
  activeAgents: string[]
}

interface AgentNode {
  id: string
  name: string
  status: 'active' | 'idle' | 'processing' | 'error'
  type: 'orchestrator' | 'agent'
  lastActivity?: Date
  performance?: {
    avgResponseTime: number
    successRate: number
  }
}

interface AgentLink {
  source: string
  target: string
  strength: number
  active: boolean
}

export function AgentVisualizer({ activeAgents }: AgentVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null)
  const agentStatuses = useStore((state) => state.agentStatuses)
  const activeRequests = useStore((state) => state.activeRequests)
  
  // Convert agent data to D3 format
  const nodes: AgentNode[] = [
    {
      id: 'orchestrator',
      name: 'Orchestrator',
      status: 'active',
      type: 'orchestrator',
    },
    ...Object.entries(agentStatuses).map(([id, status]) => ({
      id,
      name: status.name || id,
      status: status.status,
      type: 'agent' as const,
      lastActivity: status.lastActivity,
      performance: status.performance,
    })),
  ]
  
  // Create links based on active requests
  const links: AgentLink[] = []
  activeRequests.forEach(request => {
    if (request.targetAgent) {
      links.push({
        source: 'orchestrator',
        target: request.targetAgent,
        strength: 1,
        active: true,
      })
    }
  })
  
  // Add static links for all registered agents
  nodes.forEach(node => {
    if (node.type === 'agent' && !links.find(l => l.target === node.id)) {
      links.push({
        source: 'orchestrator',
        target: node.id,
        strength: 0.5,
        active: false,
      })
    }
  })
  
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return
    
    // Update dimensions
    const updateDimensions = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        setDimensions({ width: rect.width, height: rect.height })
      }
    }
    
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])
  
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return
    
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    
    const { width, height } = dimensions
    
    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })
    
    svg.call(zoom)
    
    const g = svg.append('g')
    
    // Create force simulation
    const simulation = d3.forceSimulation<AgentNode>(nodes)
      .force('link', d3.forceLink<AgentNode, AgentLink>(links)
        .id(d => d.id)
        .distance(150)
        .strength(d => d.strength))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50))
    
    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('class', 'link')
      .attr('stroke', d => d.active ? '#3b82f6' : '#e5e7eb')
      .attr('stroke-width', d => d.active ? 3 : 1)
      .attr('stroke-dasharray', d => d.active ? '5,5' : 'none')
    
    // Animate active links
    link.filter(d => d.active)
      .append('animate')
      .attr('attributeName', 'stroke-dashoffset')
      .attr('values', '10;0')
      .attr('dur', '1s')
      .attr('repeatCount', 'indefinite')
    
    // Create node groups
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node')
      .call(d3.drag<SVGGElement, AgentNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('click', (event, d) => setSelectedAgent(d))
    
    // Add circles for nodes
    node.append('circle')
      .attr('r', d => d.type === 'orchestrator' ? 30 : 25)
      .attr('fill', d => {
        switch (d.status) {
          case 'active': return '#10b981'
          case 'processing': return '#3b82f6'
          case 'idle': return '#6b7280'
          case 'error': return '#ef4444'
          default: return '#6b7280'
        }
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
    
    // Add status ring animation for processing nodes
    node.filter(d => d.status === 'processing')
      .append('circle')
      .attr('r', 30)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('opacity', 0)
      .append('animate')
      .attr('attributeName', 'r')
      .attr('values', '25;35;25')
      .attr('dur', '2s')
      .attr('repeatCount', 'indefinite')
    
    node.filter(d => d.status === 'processing')
      .select('circle:last-child')
      .append('animate')
      .attr('attributeName', 'opacity')
      .attr('values', '1;0;1')
      .attr('dur', '2s')
      .attr('repeatCount', 'indefinite')
    
    // Add icons
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'white')
      .attr('font-size', '20px')
      .text(d => {
        if (d.type === 'orchestrator') return '🎯'
        switch (d.id) {
          case 'weather-agent': return '☁️'
          case 'wind-agent': return '💨'
          case 'tidal-agent': return '🌊'
          case 'port-agent': return '⚓'
          case 'safety-agent': return '🛡️'
          case 'route-agent': return '🧭'
          case 'agent-factory': return '🏭'
          default: return '🤖'
        }
      })
    
    // Add labels
    node.append('text')
      .attr('dy', 40)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-sm font-medium')
      .text(d => d.name)
    
    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y)
      
      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })
    
    // Drag functions
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
      d.fx = null
      d.fy = null
    }
    
    return () => {
      simulation.stop()
    }
  }, [nodes, links, dimensions])
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'processing': return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
      case 'idle': return <Clock className="w-4 h-4 text-gray-500" />
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />
      default: return null
    }
  }
  
  return (
    <div className="h-full flex">
      <div ref={containerRef} className="flex-1 relative">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full"
          style={{ cursor: 'grab' }}
        />
        
        {/* Legend */}
        <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-lg p-4 shadow-lg">
          <h3 className="font-semibold mb-2">Agent Status</h3>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded-full" />
              <span>Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
              <span>Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-500 rounded-full" />
              <span>Idle</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded-full" />
              <span>Error</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Agent Details Panel */}
      <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Agent Details</h3>
        
        {selectedAgent ? (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium flex items-center gap-2">
                {selectedAgent.name}
                {getStatusIcon(selectedAgent.status)}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ID: {selectedAgent.id}
              </p>
            </div>
            
            {selectedAgent.performance && (
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Avg Response Time</span>
                    <span className="font-medium">
                      {selectedAgent.performance.avgResponseTime.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (selectedAgent.performance.avgResponseTime / 1000) * 100)}%`
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Success Rate</span>
                    <span className="font-medium">
                      {(selectedAgent.performance.successRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        selectedAgent.performance.successRate > 0.95
                          ? 'bg-green-500'
                          : selectedAgent.performance.successRate > 0.8
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{
                        width: `${selectedAgent.performance.successRate * 100}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {selectedAgent.lastActivity && (
              <div className="text-sm">
                <span className="text-gray-600 dark:text-gray-400">Last Activity:</span>
                <p className="font-medium">
                  {new Date(selectedAgent.lastActivity).toLocaleString()}
                </p>
              </div>
            )}
            
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h5 className="font-medium mb-2">Active Requests</h5>
              {activeRequests
                .filter(req => req.targetAgent === selectedAgent.id)
                .map((req, idx) => (
                  <div key={idx} className="text-sm bg-blue-50 dark:bg-blue-900/20 rounded p-2 mb-2">
                    <p className="font-medium">{req.tool}</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Started: {new Date(req.startTime).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              }
              {activeRequests.filter(req => req.targetAgent === selectedAgent.id).length === 0 && (
                <p className="text-sm text-gray-500">No active requests</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Select an agent to view details</p>
        )}
        
        {/* System Stats */}
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="font-medium mb-3">System Overview</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total Agents</span>
              <span className="font-medium">{nodes.length - 1}</span>
            </div>
            <div className="flex justify-between">
              <span>Active Agents</span>
              <span className="font-medium text-green-600">
                {nodes.filter(n => n.status === 'active').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Processing</span>
              <span className="font-medium text-blue-600">
                {nodes.filter(n => n.status === 'processing').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Active Requests</span>
              <span className="font-medium">{activeRequests.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 