'use client'

import { useEffect } from 'react'

interface WeatherOverlayProps {
  enabled: boolean
  mapRef?: any
}

export default function WeatherOverlay({ enabled, mapRef }: WeatherOverlayProps) {
  useEffect(() => {
    if (!enabled || !mapRef) return
    
    // TODO: Implement weather overlay using NOAA data
    // This will add weather tiles/markers to the map
    
    return () => {
      // Cleanup weather layers
    }
  }, [enabled, mapRef])
  
  return null // This component adds layers to the map, doesn't render anything itself
} 