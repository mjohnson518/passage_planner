'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'

// Map will be implemented with Leaflet
// This is a placeholder component for now
interface InteractiveMapProps {
  passages?: any[]
  vessels?: any[]
  center?: [number, number]
  zoom?: number
}

export default function InteractiveMap({
  passages = [],
  vessels = [],
  center = [0, 0],
  zoom = 2
}: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // TODO: Initialize Leaflet map here
    // For now, return placeholder
  }, [center, zoom])

  return (
    <div 
      ref={mapRef}
      className="w-full h-full bg-blue-50 dark:bg-blue-950/20 rounded-lg flex items-center justify-center"
    >
      <div className="text-center p-8">
        <svg 
          className="w-16 h-16 mx-auto mb-4 text-blue-500" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
          />
        </svg>
        <h3 className="text-lg font-semibold mb-2">Interactive Map</h3>
        <p className="text-sm text-muted-foreground">
          Map visualization will be available soon
        </p>
      </div>
    </div>
  )
} 