'use client'

import { useState } from 'react'
import { InteractiveMap } from './InteractiveMap'
import { Download, Share2, Layers, Route } from 'lucide-react'
import { useStore } from '../../store'
import { exportPassagePlan } from '../../lib/export'

interface PassageMapViewerProps {
  plan?: any
}

export function PassageMapViewer({ plan }: PassageMapViewerProps) {
  const [showAgentData, setShowAgentData] = useState(true)
  const [routeWaypoints, setRouteWaypoints] = useState<any[]>([])
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const socket = useStore((state) => state.socket)
  
  const handleRouteUpdate = (waypoints: any[]) => {
    setRouteWaypoints(waypoints)
    
    // Send updated route to server for recalculation
    if (socket) {
      socket.emit('route:update', {
        waypoints,
        planId: plan?.id
      })
    }
  }
  
  const handleExport = (format: 'gpx' | 'kml' | 'csv' | 'json') => {
    if (!plan) return
    
    try {
      exportPassagePlan(plan, format)
      setExportMenuOpen(false)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export passage plan')
    }
  }
  
  const shareRoute = async () => {
    if (!plan) return
    
    try {
      const shareData = {
        title: `Passage Plan: ${plan.departure.name} to ${plan.destination.name}`,
        text: `Check out my passage plan from ${plan.departure.name} to ${plan.destination.name}. Distance: ${plan.distance.total}nm, ETA: ${new Date(plan.estimatedArrivalTime).toLocaleString()}`,
        url: `${window.location.origin}/passage/${plan.id}`
      }
      
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        // Fallback - copy to clipboard
        await navigator.clipboard.writeText(shareData.url)
        alert('Link copied to clipboard!')
      }
    } catch (error) {
      console.error('Error sharing:', error)
    }
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold flex items-center">
              <Route className="w-5 h-5 mr-2" />
              {plan ? `${plan.departure.name} → ${plan.destination.name}` : 'Interactive Map'}
            </h2>
            {plan && (
              <div className="text-sm text-gray-500">
                {plan.distance.total} nm • {Math.round(plan.distance.total / 5)} hours @ 5kts
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAgentData(!showAgentData)}
              className={`btn-secondary ${showAgentData ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
              title="Toggle agent data layers"
            >
              <Layers className="w-4 h-4" />
            </button>
            
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="btn-secondary"
                disabled={!plan && routeWaypoints.length === 0}
                title="Export route"
              >
                <Download className="w-4 h-4" />
              </button>
              
              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                  <button
                    onClick={() => handleExport('gpx')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Export as GPX
                  </button>
                  <button
                    onClick={() => handleExport('kml')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Export as KML
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Export as JSON
                  </button>
                </div>
              )}
            </div>
            
            <button
              onClick={shareRoute}
              className="btn-secondary"
              disabled={!plan}
              title="Share route"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Map */}
      <div className="flex-1">
        <InteractiveMap 
          plan={plan} 
          onRouteUpdate={handleRouteUpdate}
          showAgentData={showAgentData}
        />
      </div>
      
      {/* Route info panel */}
      {(plan || routeWaypoints.length > 0) && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Route Details</h3>
              <p className="text-sm">
                {plan ? `${plan.waypoints.length} waypoints` : `${routeWaypoints.length} waypoints`}
              </p>
              {plan && (
                <p className="text-sm text-gray-500">
                  Departure: {new Date(plan.departureTime).toLocaleString()}
                </p>
              )}
            </div>
            
            {plan?.weather && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Weather</h3>
                <p className="text-sm">
                  {plan.weather.conditions[0]?.description}
                </p>
                <p className="text-sm text-gray-500">
                  Wind: {plan.weather.conditions[0]?.windDirection} {plan.weather.conditions[0]?.windSpeed}kts
                </p>
              </div>
            )}
            
            {plan?.tides && plan.tides.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Tides</h3>
                <p className="text-sm">
                  {plan.tides[0].location}: {plan.tides[0].predictions[0]?.type} at {new Date(plan.tides[0].predictions[0]?.time).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
          
          {!plan && routeWaypoints.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button className="btn-primary w-full">
                Calculate Passage Plan for This Route
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 