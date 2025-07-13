'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { PassagePlan } from '@/app/types'
import { formatDistance, formatDuration } from '@/app/lib/utils'
import { Navigation, Wind, Waves, AlertTriangle, Download } from 'lucide-react'

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
})

interface Props {
  plan: PassagePlan | null
}

export function PassageMapViewer({ plan }: Props) {
  const mapRef = useRef<L.Map | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map('passage-map').setView([41.5, -70.5], 7)

      // Add base layers
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      })

      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
      })

      const nauticalLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: '© OpenSeaMap contributors',
        opacity: 0.8,
      })

      osmLayer.addTo(mapRef.current)

      // Add layer control
      L.control.layers(
        {
          'Street Map': osmLayer,
          'Satellite': satelliteLayer,
        },
        {
          'Nautical Charts': nauticalLayer,
        }
      ).addTo(mapRef.current)

      // Add scale
      L.control.scale({ imperial: false, nautical: true }).addTo(mapRef.current)

      // Initialize route layer group
      routeLayerRef.current = L.layerGroup().addTo(mapRef.current)
    }

    // Clear previous route
    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers()
    }

    // Draw passage plan if available
    if (plan && routeLayerRef.current) {
      const waypoints = [
        plan.departure.coordinates,
        ...plan.waypoints.map(w => w.coordinates),
        plan.destination.coordinates,
      ]

      // Create route polyline
      const routeCoords = waypoints.map(wp => [wp.latitude, wp.longitude] as L.LatLngTuple)
      const route = L.polyline(routeCoords, {
        color: '#0ea5e9',
        weight: 3,
        opacity: 0.8,
      }).addTo(routeLayerRef.current)

      // Add departure marker
      const departureIcon = L.divIcon({
        html: `<div class="flex items-center justify-center w-8 h-8 bg-green-500 rounded-full border-2 border-white shadow-lg">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      L.marker([plan.departure.coordinates.latitude, plan.departure.coordinates.longitude], {
        icon: departureIcon,
      })
        .bindPopup(`<b>Departure: ${plan.departure.name}</b><br>${plan.departure.country}`)
        .addTo(routeLayerRef.current)

      // Add destination marker
      const destinationIcon = L.divIcon({
        html: `<div class="flex items-center justify-center w-8 h-8 bg-red-500 rounded-full border-2 border-white shadow-lg">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
        </div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      L.marker([plan.destination.coordinates.latitude, plan.destination.coordinates.longitude], {
        icon: destinationIcon,
      })
        .bindPopup(`<b>Destination: ${plan.destination.name}</b><br>${plan.destination.country}`)
        .addTo(routeLayerRef.current)

      // Add waypoint markers
      plan.waypoints.forEach((waypoint, index) => {
        const waypointIcon = L.divIcon({
          html: `<div class="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg text-white text-xs font-bold">
            ${index + 1}
          </div>`,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })

        L.marker([waypoint.coordinates.latitude, waypoint.coordinates.longitude], {
          icon: waypointIcon,
        })
          .bindPopup(`<b>Waypoint ${index + 1}</b><br>${waypoint.name || 'Unnamed'}<br>ETA: ${new Date(waypoint.estimatedArrival).toLocaleString()}`)
          .addTo(routeLayerRef.current)
      })

      // Add hazard markers if any
      plan.safety.hazards.forEach((hazard) => {
        const hazardIcon = L.divIcon({
          html: `<div class="flex items-center justify-center w-6 h-6 bg-yellow-500 rounded-full border-2 border-white shadow-lg">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>`,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })

        L.marker([hazard.location.latitude, hazard.location.longitude], {
          icon: hazardIcon,
        })
          .bindPopup(`<b>⚠️ ${hazard.type}</b><br>${hazard.description}`)
          .addTo(routeLayerRef.current)
      })

      // Fit map to route bounds
      mapRef.current.fitBounds(route.getBounds().pad(0.1))
    }

    return () => {
      // Cleanup on unmount
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        routeLayerRef.current = null
      }
    }
  }, [plan])

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

  if (!plan) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <Navigation className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Passage Plan</h3>
          <p className="text-gray-500">Create a passage plan to see it on the map</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Map Container */}
      <div className="flex-1 relative">
        <div id="passage-map" className="w-full h-full" />
        
        {/* Map Controls */}
        <div className="absolute top-4 right-4 z-[1000] space-y-2">
          <button
            onClick={exportGPX}
            className="bg-white rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            <span className="text-sm">Export GPX</span>
          </button>
        </div>
      </div>

      {/* Passage Details Panel */}
      <div className="w-80 bg-white border-l p-6 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Passage Details</h3>

        {/* Route Summary */}
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Route Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Distance</span>
                <span className="font-medium">{formatDistance(plan.distance.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium">
                  {formatDuration(
                    (new Date(plan.estimatedArrivalTime).getTime() - 
                     new Date(plan.departureTime).getTime()) / (1000 * 60 * 60)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Waypoints</span>
                <span className="font-medium">{plan.waypoints.length}</span>
              </div>
            </div>
          </div>

          {/* Weather Summary */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Wind className="h-4 w-4" />
              Weather Conditions
            </h4>
            {plan.weather.conditions.slice(0, 2).map((condition, index) => (
              <div key={index} className="mb-2 last:mb-0">
                <div className="text-sm font-medium text-gray-700">
                  {new Date(condition.timeWindow.start).toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-600">
                  Wind: {condition.windSpeed}kt {condition.windDirection}
                </div>
                <div className="text-xs text-gray-600">
                  Waves: {condition.waveHeight}m
                </div>
              </div>
            ))}
          </div>

          {/* Safety Information */}
          {(plan.weather.warnings.length > 0 || plan.safety.hazards.length > 0) && (
            <div className="p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                Safety Alerts
              </h4>
              <div className="space-y-2">
                {plan.weather.warnings.map((warning, index) => (
                  <div key={index} className="text-sm text-yellow-800">
                    • {warning}
                  </div>
                ))}
                {plan.safety.hazards.map((hazard, index) => (
                  <div key={index} className="text-sm text-yellow-800">
                    • {hazard.type}: {hazard.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emergency Contacts */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Emergency Contacts</h4>
            <div className="space-y-2 text-sm">
              {plan.safety.emergencyContacts.map((contact, index) => (
                <div key={index}>
                  <div className="font-medium text-gray-700">{contact.type}</div>
                  {contact.phone && (
                    <div className="text-gray-600">📞 {contact.phone}</div>
                  )}
                  {contact.vhfChannel && (
                    <div className="text-gray-600">📻 VHF Ch. {contact.vhfChannel}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 