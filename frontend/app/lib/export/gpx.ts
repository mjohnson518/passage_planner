// Import types - shared package not available, using any for now
// TODO: Add shared package to frontend dependencies or define types locally

/**
 * Convert a passage plan to GPX format
 * GPX (GPS Exchange Format) is widely supported by chartplotters and navigation apps
 */
export function passageToGPX(passage: any): string {
  const timestamp = new Date().toISOString()
  
  // Build waypoints
  const waypointsXML = buildWaypoints(passage)
  
  // Build route
  const routeXML = buildRoute(passage)
  
  // Build track (actual path with intermediate points)
  const trackXML = buildTrack(passage)
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Helmwise - helmwise.co"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXML(passage.name)}</name>
    <desc>Passage from ${escapeXML(passage.departure.name)} to ${escapeXML(passage.destination.name)}</desc>
    <author>
      <name>Helmwise</name>
      <link href="https://helmwise.co">
        <text>Helmwise</text>
      </link>
    </author>
    <time>${timestamp}</time>
  </metadata>
  
  ${waypointsXML}
  ${routeXML}
  ${trackXML}
</gpx>`
}

function buildWaypoints(passage: any): string {
  const waypoints: string[] = []
  
  // Add departure
  waypoints.push(createWaypointXML(
    passage.departure.coordinates,
    passage.departure.name,
    'Departure',
    'flag'
  ))
  
  // Add intermediate waypoints
  passage.waypoints.forEach((wp, index) => {
    waypoints.push(createWaypointXML(
      wp.coordinates,
      wp.name,
      wp.notes || `Waypoint ${index + 1}`,
      getWaypointSymbol(wp.type)
    ))
  })
  
  // Add destination
  waypoints.push(createWaypointXML(
    passage.destination.coordinates,
    passage.destination.name,
    'Destination',
    'flag'
  ))
  
  return waypoints.join('\n  ')
}

function buildRoute(passage: any): string {
  const routePoints: string[] = []
  
  // Add all points in order
  const allPoints = [
    { name: passage.departure.name, coords: passage.departure.coordinates },
    ...passage.waypoints.map(wp => ({ name: wp.name, coords: wp.coordinates })),
    { name: passage.destination.name, coords: passage.destination.coordinates }
  ]
  
  allPoints.forEach(point => {
    routePoints.push(`    <rtept lat="${point.coords.lat}" lon="${point.coords.lng}">
      <name>${escapeXML(point.name)}</name>
    </rtept>`)
  })
  
  return `  <rte>
    <name>${escapeXML(passage.name)}</name>
    <desc>Distance: ${passage.distance.toFixed(1)} nm, ETA: ${formatDuration(passage.estimatedDuration)}</desc>
${routePoints.join('\n')}
  </rte>`
}

function buildTrack(passage: any): string {
  if (!passage.route || passage.route.length === 0) {
    return ''
  }
  
  const trackPoints: string[] = []
  let currentTime = new Date(passage.departureTime)
  
  passage.route.forEach((segment, index) => {
    // Add start point of segment
    trackPoints.push(`      <trkpt lat="${segment.from.lat}" lon="${segment.from.lng}">
        <time>${currentTime.toISOString()}</time>
        <course>${segment.bearing}</course>
        <speed>${segment.estimatedSpeed}</speed>
      </trkpt>`)
    
    // Update time for next point
    currentTime = new Date(currentTime.getTime() + segment.estimatedTime * 3600000)
    
    // Add end point of last segment
    if (index === passage.route.length - 1) {
      trackPoints.push(`      <trkpt lat="${segment.to.lat}" lon="${segment.to.lng}">
        <time>${currentTime.toISOString()}</time>
      </trkpt>`)
    }
  })
  
  return `  <trk>
    <name>${escapeXML(passage.name)} - Track</name>
    <desc>Planned route track</desc>
    <trkseg>
${trackPoints.join('\n')}
    </trkseg>
  </trk>`
}

function createWaypointXML(
  coords: any, 
  name: string, 
  description?: string,
  symbol?: string
): string {
  return `  <wpt lat="${coords.lat}" lon="${coords.lng}">
    <name>${escapeXML(name)}</name>
    ${description ? `<desc>${escapeXML(description)}</desc>` : ''}
    ${symbol ? `<sym>${symbol}</sym>` : ''}
  </wpt>`
}

function getWaypointSymbol(type?: string): string {
  switch (type) {
    case 'anchorage':
      return 'anchor'
    case 'marina':
      return 'marina'
    case 'fuel':
      return 'fuel'
    default:
      return 'circle'
  }
}

function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatDuration(hours: number): string {
  const days = Math.floor(hours / 24)
  const remainingHours = Math.floor(hours % 24)
  const minutes = Math.floor((hours % 1) * 60)
  
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (remainingHours > 0) parts.push(`${remainingHours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  
  return parts.join(' ')
}

/**
 * Download GPX file
 */
export function downloadGPX(passage: any): void {
  const gpxContent = passageToGPX(passage)
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `${passage.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_passage.gpx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
} 