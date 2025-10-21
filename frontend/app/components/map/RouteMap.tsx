'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
})

interface RouteMapProps {
  waypoints?: Array<{
    latitude: number
    longitude: number
    name?: string
  }>
  center?: [number, number]
  zoom?: number
  height?: string
}

export default function RouteMap({
  waypoints = [],
  center = [42.3601, -71.0589], // Boston default
  zoom = 8,
  height = '500px'
}: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const routeLayerRef = useRef<L.Polyline | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Initialize map
    const map = L.map(mapRef.current).setView(center, zoom)

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Update waypoints and route
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clear existing markers and route
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []
    
    if (routeLayerRef.current) {
      routeLayerRef.current.remove()
      routeLayerRef.current = null
    }

    if (waypoints.length === 0) return

    // Add waypoint markers
    const latLngs: L.LatLng[] = []
    waypoints.forEach((wp, index) => {
      const latLng = L.latLng(wp.latitude, wp.longitude)
      latLngs.push(latLng)

      const marker = L.marker(latLng)
        .bindPopup(`
          <div class="text-sm">
            <strong>${wp.name || `Waypoint ${index + 1}`}</strong><br/>
            ${wp.latitude.toFixed(4)}°, ${wp.longitude.toFixed(4)}°
          </div>
        `)
        .addTo(map)

      markersRef.current.push(marker)
    })

    // Draw route line
    if (latLngs.length > 1) {
      const polyline = L.polyline(latLngs, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.7,
      }).addTo(map)

      routeLayerRef.current = polyline

      // Fit map to show entire route
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] })
    } else if (latLngs.length === 1) {
      map.setView(latLngs[0], 10)
    }
  }, [waypoints])

  return (
    <div 
      ref={mapRef} 
      style={{ height, width: '100%' }}
      className="rounded-lg border border-border overflow-hidden"
    />
  )
}

