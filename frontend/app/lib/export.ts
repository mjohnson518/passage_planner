// frontend/app/lib/export.ts
// Export utilities for various formats

interface Waypoint {
  name?: string
  coordinates: {
    latitude: number
    longitude: number
  }
  estimatedArrival?: Date | string
  notes?: string
}

interface PassagePlan {
  id: string
  departure: {
    name: string
    coordinates: {
      latitude: number
      longitude: number
    }
  }
  destination: {
    name: string
    coordinates: {
      latitude: number
      longitude: number
    }
  }
  waypoints: Waypoint[]
  departureTime: Date | string
  estimatedArrivalTime: Date | string
  distance: {
    total: number
    unit: string
  }
  weather?: any
  tides?: any[]
}

/**
 * Export passage plan as GPX (GPS Exchange Format)
 */
export function exportAsGPX(plan: PassagePlan): string {
  const waypoints = [
    { name: plan.departure.name, ...plan.departure },
    ...plan.waypoints,
    { name: plan.destination.name, ...plan.destination }
  ]
  
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Passage Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${plan.departure.name} to ${plan.destination.name}</name>
    <desc>Distance: ${plan.distance.total} ${plan.distance.unit}</desc>
    <author>
      <name>Passage Planner</name>
    </author>
    <time>${new Date().toISOString()}</time>
  </metadata>
  
  <!-- Waypoints -->
  ${waypoints.map((wp, i) => `
  <wpt lat="${wp.coordinates.latitude}" lon="${wp.coordinates.longitude}">
    <name>${wp.name || `Waypoint ${i}`}</name>
    ${wp.estimatedArrival ? `<time>${new Date(wp.estimatedArrival).toISOString()}</time>` : ''}
    ${wp.notes ? `<desc>${escapeXml(wp.notes)}</desc>` : ''}
    <sym>marina</sym>
  </wpt>`).join('')}
  
  <!-- Route -->
  <rte>
    <name>${plan.departure.name} to ${plan.destination.name}</name>
    <desc>Passage plan created on ${new Date().toLocaleDateString()}</desc>
    ${waypoints.map((wp, i) => `
    <rtept lat="${wp.coordinates.latitude}" lon="${wp.coordinates.longitude}">
      <name>${wp.name || `Waypoint ${i}`}</name>
      ${wp.estimatedArrival ? `<time>${new Date(wp.estimatedArrival).toISOString()}</time>` : ''}
      ${wp.notes ? `<desc>${escapeXml(wp.notes)}</desc>` : ''}
    </rtept>`).join('')}
  </rte>
  
  <!-- Track (for visualization) -->
  <trk>
    <name>${plan.departure.name} to ${plan.destination.name}</name>
    <trkseg>
      ${waypoints.map(wp => `
      <trkpt lat="${wp.coordinates.latitude}" lon="${wp.coordinates.longitude}">
        ${wp.estimatedArrival ? `<time>${new Date(wp.estimatedArrival).toISOString()}</time>` : ''}
      </trkpt>`).join('')}
    </trkseg>
  </trk>
</gpx>`
  
  return gpx
}

/**
 * Export passage plan as KML (Keyhole Markup Language)
 */
export function exportAsKML(plan: PassagePlan): string {
  const waypoints = [
    { name: plan.departure.name, ...plan.departure },
    ...plan.waypoints,
    { name: plan.destination.name, ...plan.destination }
  ]
  
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${plan.departure.name} to ${plan.destination.name}</name>
    <description>Passage plan - Distance: ${plan.distance.total} ${plan.distance.unit}</description>
    
    <!-- Styles -->
    <Style id="departure">
      <IconStyle>
        <color>ff00ff00</color>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>
    
    <Style id="destination">
      <IconStyle>
        <color>ff0000ff</color>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>
    
    <Style id="waypoint">
      <IconStyle>
        <color>ff00ffff</color>
        <scale>1.0</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/ylw-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>
    
    <Style id="route">
      <LineStyle>
        <color>ff0080ff</color>
        <width>4</width>
      </LineStyle>
    </Style>
    
    <!-- Folder for waypoints -->
    <Folder>
      <name>Waypoints</name>
      
      <!-- Departure -->
      <Placemark>
        <name>${plan.departure.name}</name>
        <description>Departure: ${new Date(plan.departureTime).toLocaleString()}</description>
        <styleUrl>#departure</styleUrl>
        <Point>
          <coordinates>${plan.departure.coordinates.longitude},${plan.departure.coordinates.latitude},0</coordinates>
        </Point>
      </Placemark>
      
      <!-- Waypoints -->
      ${plan.waypoints.map((wp, i) => `
      <Placemark>
        <name>${wp.name || `Waypoint ${i + 1}`}</name>
        <description>${wp.notes || ''}\nETA: ${wp.estimatedArrival ? new Date(wp.estimatedArrival).toLocaleString() : 'N/A'}</description>
        <styleUrl>#waypoint</styleUrl>
        <Point>
          <coordinates>${wp.coordinates.longitude},${wp.coordinates.latitude},0</coordinates>
        </Point>
      </Placemark>`).join('')}
      
      <!-- Destination -->
      <Placemark>
        <name>${plan.destination.name}</name>
        <description>Destination: ETA ${new Date(plan.estimatedArrivalTime).toLocaleString()}</description>
        <styleUrl>#destination</styleUrl>
        <Point>
          <coordinates>${plan.destination.coordinates.longitude},${plan.destination.coordinates.latitude},0</coordinates>
        </Point>
      </Placemark>
    </Folder>
    
    <!-- Route line -->
    <Placemark>
      <name>Route</name>
      <description>Total distance: ${plan.distance.total} ${plan.distance.unit}</description>
      <styleUrl>#route</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
          ${waypoints.map(wp => `${wp.coordinates.longitude},${wp.coordinates.latitude},0`).join('\n          ')}
        </coordinates>
      </LineString>
    </Placemark>
    
    <!-- Weather info overlay -->
    ${plan.weather && plan.weather.conditions && plan.weather.conditions.length > 0 ? `
    <Folder>
      <name>Weather Conditions</name>
      ${plan.weather.conditions.map((condition: any, i: number) => `
      <Placemark>
        <name>Weather ${i + 1}</name>
        <description>${condition.description}
Wind: ${condition.windDirection} ${condition.windSpeed} kts
Waves: ${condition.waveHeight} ft
Visibility: ${condition.visibility} nm</description>
        <Point>
          <coordinates>${waypoints[Math.floor(i * waypoints.length / plan.weather.conditions.length)].coordinates.longitude},${waypoints[Math.floor(i * waypoints.length / plan.weather.conditions.length)].coordinates.latitude},0</coordinates>
        </Point>
      </Placemark>`).join('')}
    </Folder>` : ''}
  </Document>
</kml>`
  
  return kml
}

/**
 * Export as CSV for spreadsheet applications
 */
export function exportAsCSV(plan: PassagePlan): string {
  const waypoints = [
    { name: plan.departure.name, type: 'Departure', ...plan.departure },
    ...plan.waypoints.map((wp, i) => ({ ...wp, type: 'Waypoint', name: wp.name || `WP${i + 1}` })),
    { name: plan.destination.name, type: 'Destination', ...plan.destination }
  ]
  
  const headers = ['Name', 'Type', 'Latitude', 'Longitude', 'ETA', 'Notes']
  const rows = waypoints.map(wp => [
    wp.name,
    wp.type || 'Waypoint',
    wp.coordinates.latitude.toFixed(6),
    wp.coordinates.longitude.toFixed(6),
    wp.estimatedArrival ? new Date(wp.estimatedArrival).toLocaleString() : '',
    wp.notes || ''
  ])
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  return csv
}

/**
 * Export as JSON for data exchange
 */
export function exportAsJSON(plan: PassagePlan): string {
  return JSON.stringify(plan, null, 2)
}

/**
 * Download file utility
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export passage plan in specified format
 */
export function exportPassagePlan(plan: PassagePlan, format: 'gpx' | 'kml' | 'csv' | 'json') {
  let content: string
  let filename: string
  let mimeType: string
  
  const baseFilename = `passage-${plan.departure.name.replace(/\s+/g, '-')}-${plan.destination.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`
  
  switch (format) {
    case 'gpx':
      content = exportAsGPX(plan)
      filename = `${baseFilename}.gpx`
      mimeType = 'application/gpx+xml'
      break
      
    case 'kml':
      content = exportAsKML(plan)
      filename = `${baseFilename}.kml`
      mimeType = 'application/vnd.google-earth.kml+xml'
      break
      
    case 'csv':
      content = exportAsCSV(plan)
      filename = `${baseFilename}.csv`
      mimeType = 'text/csv'
      break
      
    case 'json':
      content = exportAsJSON(plan)
      filename = `${baseFilename}.json`
      mimeType = 'application/json'
      break
      
    default:
      throw new Error(`Unsupported format: ${format}`)
  }
  
  downloadFile(content, filename, mimeType)
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
} 