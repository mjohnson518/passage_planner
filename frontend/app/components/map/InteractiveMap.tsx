'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import { useStore } from '../../store'
import { Anchor, Navigation, AlertTriangle, Fuel, Wind } from 'lucide-react'

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
})

interface InteractiveMapProps {
  plan?: any
  onRouteUpdate?: (waypoints: any[]) => void
  showAgentData?: boolean
}

export function InteractiveMap({ plan, onRouteUpdate, showAgentData = true }: InteractiveMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const routeLayerRef = useRef<L.FeatureGroup | null>(null)
  const agentLayersRef = useRef<Map<string, L.LayerGroup>>(new Map())
  const [isDrawing, setIsDrawing] = useState(false)
  const [waypoints, setWaypoints] = useState<L.LatLng[]>([])
  
  // Get agent data from store
  const agentStatuses = useStore((state) => state.agentStatuses)

  useEffect(() => {
    if (!mapRef.current) {
      // Initialize map
      const map = L.map('interactive-map').setView([41.5, -70.5], 8)
      
      // Add base layers
      const nauticalChart = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: 'Map data © OpenSeaMap contributors',
        maxZoom: 18,
      })
      
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)
      
      // Layer control
      const baseLayers = {
        'OpenStreetMap': osm,
        'Nautical Chart': nauticalChart,
      }
      
      L.control.layers(baseLayers).addTo(map)
      
      // Initialize route layer
      const routeLayer = new L.FeatureGroup()
      map.addLayer(routeLayer)
      routeLayerRef.current = routeLayer
      
      // Add draw control
      const drawControl = new (L.Control as any).Draw({
        position: 'topright',
        draw: {
          polyline: {
            shapeOptions: {
              color: '#3b82f6',
              weight: 4,
              opacity: 0.8
            },
            metric: false,
            feet: false,
            nautic: true
          },
          polygon: false,
          circle: false,
          rectangle: false,
          marker: {
            icon: L.divIcon({
              className: 'waypoint-marker',
              html: '<div class="bg-blue-500 w-6 h-6 rounded-full border-2 border-white"></div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })
          },
          circlemarker: false
        },
        edit: {
          featureGroup: routeLayer,
          remove: true
        }
      })
      
      map.addControl(drawControl)
      
      // Handle draw events
      map.on((L as any).Draw.Event.CREATED, (e: any) => {
        const layer = e.layer
        routeLayer.addLayer(layer)
        
        if (e.layerType === 'polyline') {
          const latlngs = layer.getLatLngs()
          setWaypoints(latlngs)
          onRouteUpdate?.(latlngs.map((ll: L.LatLng) => ({
            latitude: ll.lat,
            longitude: ll.lng
          })))
        } else if (e.layerType === 'marker') {
          const latlng = layer.getLatLng()
          setWaypoints(prev => [...prev, latlng])
          
          // Add waypoint popup
          layer.bindPopup(`
            <div class="p-2">
              <h3 class="font-bold">Waypoint ${waypoints.length + 1}</h3>
              <p>Lat: ${latlng.lat.toFixed(4)}</p>
              <p>Lon: ${latlng.lng.toFixed(4)}</p>
            </div>
          `)
        }
      })
      
      map.on((L as any).Draw.Event.EDITED, (e: any) => {
        const layers = e.layers
        const updatedWaypoints: L.LatLng[] = []
        
        layers.eachLayer((layer: any) => {
          if (layer instanceof L.Polyline) {
            const latlngs = layer.getLatLngs()
            updatedWaypoints.push(...latlngs)
          } else if (layer instanceof L.Marker) {
            updatedWaypoints.push(layer.getLatLng())
          }
        })
        
        setWaypoints(updatedWaypoints)
        onRouteUpdate?.(updatedWaypoints.map(ll => ({
          latitude: ll.lat,
          longitude: ll.lng
        })))
      })
      
      map.on((L as any).Draw.Event.DRAWSTART, () => {
        setIsDrawing(true)
      })
      
      map.on((L as any).Draw.Event.DRAWSTOP, () => {
        setIsDrawing(false)
      })
      
      mapRef.current = map
    }
    
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])
  
  // Update map with passage plan
  useEffect(() => {
    if (!mapRef.current || !routeLayerRef.current || !plan) return
    
    // Clear existing route
    routeLayerRef.current.clearLayers()
    
    // Add departure marker
    if (plan.departure) {
      const depMarker = L.marker([
        plan.departure.coordinates.latitude,
        plan.departure.coordinates.longitude
      ], {
        icon: L.divIcon({
          className: 'departure-marker',
          html: `<div class="bg-green-500 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
            </svg>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      }).addTo(routeLayerRef.current)
      
      depMarker.bindPopup(`<strong>Departure:</strong> ${plan.departure.name}`)
    }
    
    // Add destination marker
    if (plan.destination) {
      const destMarker = L.marker([
        plan.destination.coordinates.latitude,
        plan.destination.coordinates.longitude
      ], {
        icon: L.divIcon({
          className: 'destination-marker',
          html: `<div class="bg-red-500 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clip-rule="evenodd"/>
            </svg>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      }).addTo(routeLayerRef.current)
      
      destMarker.bindPopup(`<strong>Destination:</strong> ${plan.destination.name}`)
    }
    
    // Add waypoints and route
    if (plan.waypoints && plan.waypoints.length > 0) {
      const routeCoords = plan.waypoints.map((wp: any) => [
        wp.coordinates.latitude,
        wp.coordinates.longitude
      ])
      
      // Add route line
      const routeLine = L.polyline(routeCoords, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.8,
        smoothFactor: 1
      }).addTo(routeLayerRef.current)
      
      // Add waypoint markers
      plan.waypoints.forEach((wp: any, index: number) => {
        if (wp.name) {
          const marker = L.marker([
            wp.coordinates.latitude,
            wp.coordinates.longitude
          ], {
            icon: L.divIcon({
              className: 'waypoint-marker',
              html: `<div class="bg-blue-500 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs text-white font-bold">${index + 1}</div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })
          }).addTo(routeLayerRef.current)
          
          marker.bindPopup(`
            <div class="p-2">
              <h3 class="font-bold">${wp.name}</h3>
              <p>ETA: ${new Date(wp.estimatedArrival).toLocaleString()}</p>
              ${wp.notes ? `<p class="text-sm">${wp.notes}</p>` : ''}
            </div>
          `)
        }
      })
      
      // Fit map to route
      mapRef.current.fitBounds(routeLine.getBounds().pad(0.1))
    }
  }, [plan])
  
  // Update agent data layers
  useEffect(() => {
    if (!mapRef.current || !showAgentData) return
    
    // Weather layer
    if (agentStatuses['weather-agent']?.status === 'active') {
      updateWeatherLayer()
    }
    
    // Anchorages layer
    if (agentStatuses['anchorages-agent']?.status === 'active') {
      updateAnchoragesLayer()
    }
    
    // Fuel stops layer
    if (agentStatuses['fuel-agent']?.status === 'active') {
      updateFuelLayer()
    }
    
    // Hazards layer
    if (agentStatuses['safety-agent']?.status === 'active') {
      updateHazardsLayer()
    }
  }, [agentStatuses, showAgentData])
  
  const updateWeatherLayer = () => {
    if (!mapRef.current) return
    
    // Remove existing layer
    const existingLayer = agentLayersRef.current.get('weather')
    if (existingLayer) {
      mapRef.current.removeLayer(existingLayer)
    }
    
    // Create new weather layer
    const weatherLayer = L.layerGroup()
    
    // Add wind barbs (simplified)
    const bounds = mapRef.current.getBounds()
    const gridSize = 0.5 // degrees
    
    for (let lat = Math.floor(bounds.getSouth()); lat <= Math.ceil(bounds.getNorth()); lat += gridSize) {
      for (let lng = Math.floor(bounds.getWest()); lng <= Math.ceil(bounds.getEast()); lng += gridSize) {
        // Mock wind data - in production would come from weather agent
        const windSpeed = Math.random() * 20 + 5
        const windDir = Math.random() * 360
        
        const windMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'wind-barb',
            html: `<div class="transform rotate-[${windDir}deg]">
              <Wind class="w-6 h-6 text-blue-600" />
              <span class="text-xs">${Math.round(windSpeed)}</span>
            </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        })
        
        windMarker.bindPopup(`Wind: ${Math.round(windSpeed)}kts from ${Math.round(windDir)}°`)
        weatherLayer.addLayer(windMarker)
      }
    }
    
    agentLayersRef.current.set('weather', weatherLayer)
    mapRef.current.addLayer(weatherLayer)
  }
  
  const updateAnchoragesLayer = () => {
    if (!mapRef.current) return
    
    const existingLayer = agentLayersRef.current.get('anchorages')
    if (existingLayer) {
      mapRef.current.removeLayer(existingLayer)
    }
    
    const anchoragesLayer = L.layerGroup()
    
    // Mock anchorages - in production would come from anchorages agent
    const anchorages = [
      { name: 'Cuttyhunk Pond', lat: 41.4142, lng: -70.9005, protection: 'All' },
      { name: 'Block Island', lat: 41.1633, lng: -71.5783, protection: 'All' },
      { name: 'Point Judith Harbor', lat: 41.3617, lng: -71.4811, protection: 'E,S' }
    ]
    
    anchorages.forEach(anch => {
      const marker = L.marker([anch.lat, anch.lng], {
        icon: L.divIcon({
          className: 'anchorage-marker',
          html: '<div class="bg-purple-500 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center"><Anchor class="w-3 h-3 text-white" /></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      })
      
      marker.bindPopup(`
        <div class="p-2">
          <h3 class="font-bold">${anch.name}</h3>
          <p>Protection: ${anch.protection}</p>
        </div>
      `)
      
      anchoragesLayer.addLayer(marker)
    })
    
    agentLayersRef.current.set('anchorages', anchoragesLayer)
    mapRef.current.addLayer(anchoragesLayer)
  }
  
  const updateFuelLayer = () => {
    if (!mapRef.current) return
    
    const existingLayer = agentLayersRef.current.get('fuel')
    if (existingLayer) {
      mapRef.current.removeLayer(existingLayer)
    }
    
    const fuelLayer = L.layerGroup()
    
    // Mock fuel stops - in production would come from fuel agent
    const fuelStops = [
      { name: 'Boston Yacht Haven', lat: 42.3601, lng: -71.0500 },
      { name: 'Portland Yacht Services', lat: 43.6591, lng: -70.2468 }
    ]
    
    fuelStops.forEach(fuel => {
      const marker = L.marker([fuel.lat, fuel.lng], {
        icon: L.divIcon({
          className: 'fuel-marker',
          html: '<div class="bg-orange-500 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center"><Fuel class="w-3 h-3 text-white" /></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      })
      
      marker.bindPopup(`<strong>Fuel:</strong> ${fuel.name}`)
      fuelLayer.addLayer(marker)
    })
    
    agentLayersRef.current.set('fuel', fuelLayer)
    mapRef.current.addLayer(fuelLayer)
  }
  
  const updateHazardsLayer = () => {
    if (!mapRef.current) return
    
    const existingLayer = agentLayersRef.current.get('hazards')
    if (existingLayer) {
      mapRef.current.removeLayer(existingLayer)
    }
    
    const hazardsLayer = L.layerGroup()
    
    // Mock hazards - in production would come from safety agent
    const hazards = [
      { name: 'Submerged Rock', lat: 41.5, lng: -70.8, type: 'rock' },
      { name: 'Strong Current', lat: 41.3, lng: -71.2, type: 'current' }
    ]
    
    hazards.forEach(hazard => {
      const marker = L.marker([hazard.lat, hazard.lng], {
        icon: L.divIcon({
          className: 'hazard-marker',
          html: '<div class="bg-red-600 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center"><AlertTriangle class="w-3 h-3 text-white" /></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      })
      
      marker.bindPopup(`<strong>⚠️ ${hazard.name}</strong>`)
      hazardsLayer.addLayer(marker)
    })
    
    agentLayersRef.current.set('hazards', hazardsLayer)
    mapRef.current.addLayer(hazardsLayer)
  }
  
  return (
    <div className="relative h-full">
      <div id="interactive-map" className="h-full w-full" />
      
      {isDrawing && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
          Click on the map to add waypoints or draw a route
        </div>
      )}
      
      <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg">
        <h3 className="text-sm font-semibold mb-2">Map Layers</h3>
        <div className="space-y-1">
          <label className="flex items-center space-x-2 text-sm">
            <input type="checkbox" defaultChecked onChange={(e) => {
              const layer = agentLayersRef.current.get('weather')
              if (layer && mapRef.current) {
                if (e.target.checked) {
                  mapRef.current.addLayer(layer)
                } else {
                  mapRef.current.removeLayer(layer)
                }
              }
            }} />
            <span>Weather</span>
          </label>
          <label className="flex items-center space-x-2 text-sm">
            <input type="checkbox" defaultChecked onChange={(e) => {
              const layer = agentLayersRef.current.get('anchorages')
              if (layer && mapRef.current) {
                if (e.target.checked) {
                  mapRef.current.addLayer(layer)
                } else {
                  mapRef.current.removeLayer(layer)
                }
              }
            }} />
            <span>Anchorages</span>
          </label>
          <label className="flex items-center space-x-2 text-sm">
            <input type="checkbox" defaultChecked onChange={(e) => {
              const layer = agentLayersRef.current.get('fuel')
              if (layer && mapRef.current) {
                if (e.target.checked) {
                  mapRef.current.addLayer(layer)
                } else {
                  mapRef.current.removeLayer(layer)
                }
              }
            }} />
            <span>Fuel Stops</span>
          </label>
          <label className="flex items-center space-x-2 text-sm">
            <input type="checkbox" defaultChecked onChange={(e) => {
              const layer = agentLayersRef.current.get('hazards')
              if (layer && mapRef.current) {
                if (e.target.checked) {
                  mapRef.current.addLayer(layer)
                } else {
                  mapRef.current.removeLayer(layer)
                }
              }
            }} />
            <span>Hazards</span>
          </label>
        </div>
      </div>
      
      <style jsx global>{`
        .leaflet-draw-toolbar {
          margin-top: 0 !important;
        }
        
        .wind-barb {
          background: transparent;
          border: none;
        }
      `}</style>
    </div>
  )
} 