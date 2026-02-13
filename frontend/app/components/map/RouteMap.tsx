'use client'

import { useEffect, useRef, useState } from 'react'
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
  const [activeLayer, setActiveLayer] = useState<'street' | 'nautical' | 'satellite'>('nautical')

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Initialize map
    const map = L.map(mapRef.current).setView(center, zoom)

    // Base layers
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    })

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri &mdash; Sources: Esri, DigitalGlobe, Earthstar Geographics',
      maxZoom: 18,
    })

    // OpenSeaMap nautical chart overlay (seamarks, buoys, lights, channels)
    const seamarkLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openseamap.org">OpenSeaMap</a> contributors',
      maxZoom: 18,
      opacity: 1,
    })

    // NOAA nautical chart raster tiles (US waters only)
    const noaaChartLayer = L.tileLayer('https://tileservice.charts.noaa.gov/tiles/50000_1/{z}/{x}/{y}.png', {
      attribution: '&copy; NOAA Office of Coast Survey',
      maxZoom: 18,
      opacity: 0.7,
    })

    // Default: nautical view (street + seamarks)
    streetLayer.addTo(map)
    seamarkLayer.addTo(map)

    // Layer control
    const baseLayers: Record<string, L.TileLayer> = {
      'Street Map': streetLayer,
      'Satellite': satelliteLayer,
    }

    const overlays: Record<string, L.TileLayer> = {
      'Seamarks (OpenSeaMap)': seamarkLayer,
      'NOAA Charts (US)': noaaChartLayer,
    }

    L.control.layers(baseLayers, overlays, { position: 'topright' }).addTo(map)

    // Scale bar in nautical miles
    L.control.scale({ imperial: true, metric: true, position: 'bottomleft' }).addTo(map)

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

    // Add waypoint markers with nautical styling
    const latLngs: L.LatLng[] = []
    waypoints.forEach((wp, index) => {
      const latLng = L.latLng(wp.latitude, wp.longitude)
      latLngs.push(latLng)

      const isFirst = index === 0
      const isLast = index === waypoints.length - 1

      const marker = L.marker(latLng, {
        icon: L.divIcon({
          className: 'custom-waypoint-icon',
          html: `<div style="
            background: ${isFirst ? '#22c55e' : isLast ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${isFirst ? 'D' : isLast ? 'A' : index}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })
      })
        .bindPopup(`
          <div class="text-sm">
            <strong>${wp.name || (isFirst ? 'Departure' : isLast ? 'Arrival' : `Waypoint ${index}`)}</strong><br/>
            ${wp.latitude.toFixed(4)}°N, ${Math.abs(wp.longitude).toFixed(4)}°${wp.longitude < 0 ? 'W' : 'E'}
          </div>
        `)
        .addTo(map)

      markersRef.current.push(marker)
    })

    // Draw route line with nautical styling
    if (latLngs.length > 1) {
      const polyline = L.polyline(latLngs, {
        color: '#dc2626',
        weight: 3,
        opacity: 0.8,
        dashArray: '10, 6',
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
