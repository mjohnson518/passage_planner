'use client'

import React, { useEffect, useRef, useState } from 'react'
import { PassagePlan } from '../../types'
import { Download, Loader2 } from 'lucide-react'

interface PassageMapViewerProps {
  plan?: any
}

export function PassageMapViewer({ plan }: PassageMapViewerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mapInstance, setMapInstance] = useState<any>(null)
  const [L, setL] = useState<any>(null)

  useEffect(() => {
    // Dynamically import Leaflet to avoid SSR issues
    const initializeMap = async () => {
      if (typeof window !== 'undefined' && mapRef.current && !mapInstance) {
        const leaflet = await import('leaflet')
        await import('leaflet/dist/leaflet.css')
        
        setL(leaflet.default)
        
        // Fix Leaflet icon issue
        delete (leaflet.default.Icon.Default.prototype as any)._getIconUrl
        leaflet.default.Icon.Default.mergeOptions({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })

        const map = leaflet.default.map(mapRef.current).setView([42.3601, -71.0589], 8)
        
        // Add base layer
        leaflet.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
        }).addTo(map)

        setMapInstance(map)
        setIsLoading(false)
      }
    }

    initializeMap()

    return () => {
      if (mapInstance) {
        mapInstance.remove()
      }
    }
  }, [])

  useEffect(() => {
    if (mapInstance && L && plan) {
      // Clear existing layers
      mapInstance.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
          mapInstance.removeLayer(layer)
        }
      })

      // Add departure marker
      const departureMarker = L.marker([
        plan.departure.coordinates.latitude,
        plan.departure.coordinates.longitude
      ]).addTo(mapInstance)
      departureMarker.bindPopup(`<b>Departure:</b> ${plan.departure.name}`)

      // Add destination marker
      const destinationIcon = L.divIcon({
        html: '<div style="background-color: #ef4444; width: 25px; height: 25px; border-radius: 50%; border: 2px solid white;"></div>',
        className: 'custom-div-icon',
        iconSize: [25, 25],
        iconAnchor: [12, 12],
      })
      
      const destinationMarker = L.marker([
        plan.destination.coordinates.latitude,
        plan.destination.coordinates.longitude
      ], { icon: destinationIcon }).addTo(mapInstance)
      destinationMarker.bindPopup(`<b>Destination:</b> ${plan.destination.name}`)

      // Add waypoints
      const waypoints = [
        [plan.departure.coordinates.latitude, plan.departure.coordinates.longitude],
        ...plan.waypoints.map(wp => [wp.coordinates.latitude, wp.coordinates.longitude]),
        [plan.destination.coordinates.latitude, plan.destination.coordinates.longitude]
      ]

      // Draw route
      const route = L.polyline(waypoints as any, {
        color: '#0ea5e9',
        weight: 3,
        opacity: 0.8,
      }).addTo(mapInstance)

      // Add waypoint markers
      plan.waypoints.forEach((waypoint, index) => {
        const waypointIcon = L.divIcon({
          html: `<div style="background-color: #3b82f6; color: white; width: 25px; height: 25px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">${index + 1}</div>`,
          className: 'custom-div-icon',
          iconSize: [25, 25],
          iconAnchor: [12, 12],
        })
        
        const marker = L.marker([
          waypoint.coordinates.latitude,
          waypoint.coordinates.longitude
        ], { icon: waypointIcon }).addTo(mapInstance)
        
        marker.bindPopup(`<b>Waypoint ${index + 1}:</b> ${waypoint.name || 'Unnamed'}`)
      })

      // Fit map to route bounds
      mapInstance.fitBounds(route.getBounds().pad(0.1))
    }
  }, [plan, mapInstance, L])

  const exportGPX = () => {
    if (!plan) return

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Passage Planner">
  <metadata>
    <name>${plan.departure.name} to ${plan.destination.name}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <rte>
    <name>${plan.departure.name} to ${plan.destination.name}</name>
    <rtept lat="${plan.departure.coordinates.latitude}" lon="${plan.departure.coordinates.longitude}">
      <name>${plan.departure.name}</name>
    </rtept>
    ${plan.waypoints.map((wp, i) => `
    <rtept lat="${wp.coordinates.latitude}" lon="${wp.coordinates.longitude}">
      <name>WP${i + 1}: ${wp.name || 'Waypoint'}</name>
    </rtept>`).join('')}
    <rtept lat="${plan.destination.coordinates.latitude}" lon="${plan.destination.coordinates.longitude}">
      <name>${plan.destination.name}</name>
    </rtept>
  </rte>
</gpx>`

    const blob = new Blob([gpx], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `passage-${plan.departure.name}-${plan.destination.name}.gpx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full w-full relative">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-800 flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-ocean-600 mx-auto mb-2" />
            <p className="text-gray-600 dark:text-gray-400">Loading map...</p>
          </div>
        </div>
      )}
      
      <div ref={mapRef} className="h-full w-full" />
      
      {plan && (
        <div className="absolute top-4 right-4 z-[1000]">
          <button
            onClick={exportGPX}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 hover:shadow-xl transition-shadow"
          >
            <Download className="h-4 w-4" />
            <span className="text-sm font-medium">Export GPX</span>
          </button>
        </div>
      )}
      
      {plan && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-xs">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Route Summary</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Distance:</span>
              <span className="font-medium">{plan.distance.total} {plan.distance.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Waypoints:</span>
              <span className="font-medium">{plan.waypoints.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Weather:</span>
              <span className="font-medium text-success-600">{plan.weather.conditions[0]?.description || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 