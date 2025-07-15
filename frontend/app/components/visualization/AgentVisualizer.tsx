'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useStore } from '../../store'
import { Activity, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react'

interface AgentVisualizerProps {
  activeAgents: any[]
}

interface Node {
  id: string
  name: string
  status: 'active' | 'idle' | 'processing' | 'error'
  group: 'orchestrator' | 'agent'
  capabilities?: string[]
  lastActivity?: Date
  performance?: {
    avgResponseTime: number
    successRate: number
  }
}

interface Link {
  source: string
  target: string
  type: 'request' | 'response' | 'error'
  timestamp: Date
  duration?: number
}

export function AgentVisualizer({ activeAgents }: AgentVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  
  // Get real-time data from store
  const agentStatuses = useStore((state) => state.agentStatuses)
  const activeRequests = useStore((state) => state.activeRequests)
  const socket = useStore((state) => state.socket)
  
  useEffect(() => {
    if (!svgRef.current) return
    
    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove()
    
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    
    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
    
    // Create nodes from agent data
    const nodes: Node[] = [
      {
        id: 'orchestrator',
        name: 'Orchestrator',
        status: 'active',
        group: 'orchestrator'
      },
      ...Object.entries(agentStatuses).map(([id, agent]) => ({
        id,
        name: agent.name,
        status: agent.status,
        group: 'agent' as const,
        capabilities: (agent as any).capabilities || [],
        lastActivity: agent.lastActivity,
        performance: agent.performance
      }))
    ]
    
    // Create links based on active requests
    const links: Link[] = activeRequests.map(request => ({
      source: 'orchestrator',
      target: request.targetAgent,
      type: 'request' as const,
      timestamp: request.startTime,
      duration: request.estimatedDuration
    }))
    
    // Add some mock historical links for visualization
    const mockLinks: Link[] = [
      { source: 'orchestrator', target: 'weather-agent', type: 'response', timestamp: new Date(Date.now() - 5000) },
      { source: 'orchestrator', target: 'tidal-agent', type: 'response', timestamp: new Date(Date.now() - 8000) },
      { source: 'orchestrator', target: 'route-agent', type: 'request', timestamp: new Date() }
    ]
    
    const allLinks = [...links, ...mockLinks]
    
    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(allLinks).id((d: any) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(50))
    
    // Add gradient definitions
    const defs = svg.append("defs")
    
    // Status gradients
    const statusGradients = {
      active: ['#10b981', '#059669'],
      idle: ['#6b7280', '#4b5563'],
      processing: ['#3b82f6', '#2563eb'],
      error: ['#ef4444', '#dc2626']
    }
    
    Object.entries(statusGradients).forEach(([status, colors]) => {
      const gradient = defs.append("linearGradient")
        .attr("id", `gradient-${status}`)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "100%")
      
      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colors[0])
      
      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colors[1])
    })
    
    // Add arrow markers for links
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 30)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .append("svg:path")
      .attr("d", "M 0,-5 L 10,0 L 0,5")
      .attr("fill", "#999")
    
    // Create link elements
    const link = svg.append("g")
      .selectAll("line")
      .data(allLinks)
      .join("line")
      .attr("stroke", d => {
        if (d.type === 'error') return '#ef4444'
        if (d.type === 'request') return '#3b82f6'
        return '#10b981'
      })
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => d.type === 'request' ? 3 : 2)
      .attr("marker-end", "url(#arrowhead)")
    
    // Create node groups
    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(d3.drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
    
    // Add circles for nodes
    node.append("circle")
      .attr("r", d => d.group === 'orchestrator' ? 35 : 25)
      .attr("fill", d => `url(#gradient-${d.status})`)
      .attr("stroke", "#fff")
      .attr("stroke-width", 3)
      .attr("filter", "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))")
    
    // Add status indicator ring
    node.append("circle")
      .attr("r", d => d.group === 'orchestrator' ? 40 : 30)
      .attr("fill", "none")
      .attr("stroke", d => {
        if (d.status === 'processing') return '#3b82f6'
        if (d.status === 'error') return '#ef4444'
        return 'transparent'
      })
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5")
      .attr("opacity", 0.8)
      .style("animation", d => d.status === 'processing' ? 'rotate 2s linear infinite' : 'none')
    
    // Add icons
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", d => d.group === 'orchestrator' ? "20px" : "16px")
      .attr("fill", "white")
      .text(d => {
        if (d.group === 'orchestrator') return '🎯'
        if (d.id.includes('weather')) return '☁️'
        if (d.id.includes('tidal')) return '🌊'
        if (d.id.includes('port')) return '⚓'
        if (d.id.includes('route')) return '🧭'
        if (d.id.includes('safety')) return '⚠️'
        if (d.id.includes('wind')) return '💨'
        if (d.id.includes('currents')) return '🌀'
        if (d.id.includes('anchorages')) return '⛵'
        if (d.id.includes('fuel')) return '⛽'
        return '🤖'
      })
    
    // Add labels
    node.append("text")
      .attr("x", 0)
      .attr("y", d => d.group === 'orchestrator' ? 50 : 40)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("fill", "#374151")
      .text(d => d.name)
    
    // Add performance indicator
    node.filter(d => d.performance && d.performance.successRate < 100)
      .append("text")
      .attr("x", 20)
      .attr("y", -20)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#ef4444")
      .text(d => `${d.performance?.successRate}%`)
    
    // Handle click events
    node.on("click", (event, d) => {
      setSelectedNode(d as Node)
    })
    
    // Add hover effects
    node.on("mouseenter", function(event, d) {
      d3.select(this).select("circle").transition().duration(200).attr("r", (d: any) => 
        d.group === 'orchestrator' ? 40 : 30
      )
    }).on("mouseleave", function(event, d) {
      d3.select(this).select("circle").transition().duration(200).attr("r", (d: any) => 
        d.group === 'orchestrator' ? 35 : 25
      )
    })
    
    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)
      
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`)
    })
    
    // Drag functions
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }
    
    function dragged(event: any, d: any) {
      d.fx = event.x
      d.fy = event.y
    }
    
    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }
    
    // Animate active requests
    const animateRequests = () => {
      activeRequests.forEach(request => {
        const sourceNode = nodes.find(n => n.id === 'orchestrator')
        const targetNode = nodes.find(n => n.id === request.targetAgent)
        
        if (sourceNode && targetNode) {
          const particle = svg.append("circle")
            .attr("r", 4)
            .attr("fill", "#3b82f6")
            .attr("cx", sourceNode.x || 0)
            .attr("cy", sourceNode.y || 0)
          
          particle.transition()
            .duration(1000)
            .attr("cx", targetNode.x || 0)
            .attr("cy", targetNode.y || 0)
            .remove()
        }
      })
    }
    
    // Run animation periodically
    const animationInterval = setInterval(animateRequests, 2000)
    
    return () => {
      clearInterval(animationInterval)
      simulation.stop()
    }
  }, [agentStatuses, activeRequests])
  
  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return
    
    const handleAgentActivity = (data: any) => {
      setRecentActivity(prev => [data, ...prev.slice(0, 9)])
    }
    
    socket.on('agent:activity', handleAgentActivity)
    
    return () => {
      socket.off('agent:activity', handleAgentActivity)
    }
  }, [socket])
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'processing':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }
  
  return (
    <div className="h-full flex">
      {/* Main visualization */}
      <div className="flex-1 relative">
        <svg ref={svgRef} className="w-full h-full" />
        
        {/* Legend */}
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg">
          <h3 className="text-sm font-semibold mb-2">Status Legend</h3>
          <div className="space-y-1 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-green-600"></div>
              <span>Active</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"></div>
              <span>Processing</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-gray-500 to-gray-600"></div>
              <span>Idle</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-600"></div>
              <span>Error</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Side panel */}
      <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
        {/* Selected node details */}
        {selectedNode ? (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center justify-between">
              {selectedNode.name}
              {getStatusIcon(selectedNode.status)}
            </h3>
            
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Status:</span>
                <span className={`ml-2 font-medium ${
                  selectedNode.status === 'active' ? 'text-green-600' :
                  selectedNode.status === 'processing' ? 'text-blue-600' :
                  selectedNode.status === 'error' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {selectedNode.status}
                </span>
              </div>
              
              {selectedNode.capabilities && selectedNode.capabilities.length > 0 && (
                <div>
                  <span className="text-gray-500">Capabilities:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedNode.capabilities.map((cap, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs rounded">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedNode.performance && (
                <>
                  <div>
                    <span className="text-gray-500">Avg Response Time:</span>
                    <span className="ml-2 font-medium">{selectedNode.performance.avgResponseTime}ms</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Success Rate:</span>
                    <span className={`ml-2 font-medium ${
                      selectedNode.performance.successRate >= 95 ? 'text-green-600' :
                      selectedNode.performance.successRate >= 80 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {selectedNode.performance.successRate}%
                    </span>
                  </div>
                </>
              )}
              
              {selectedNode.lastActivity && (
                <div>
                  <span className="text-gray-500">Last Activity:</span>
                  <span className="ml-2 font-medium">
                    {new Date(selectedNode.lastActivity).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-6 text-center text-gray-500 text-sm">
            Click on an agent to see details
          </div>
        )}
        
        {/* Recent activity */}
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <Zap className="w-4 h-4 mr-2" />
            Recent Activity
          </h3>
          
          <div className="space-y-2">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, i) => (
                <div key={i} className="p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{activity.agent}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {activity.action}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 text-sm">
                No recent activity
              </div>
            )}
          </div>
        </div>
        
        {/* Active requests */}
        {activeRequests.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Active Requests</h3>
            <div className="space-y-2">
              {activeRequests.map((request, i) => (
                <div key={request.id} className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{request.tool}</span>
                    <Activity className="w-3 h-3 text-blue-500 animate-pulse" />
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Target: {request.targetAgent}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <style jsx global>{`
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
} 