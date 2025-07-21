import { Passage, Waypoint, Coordinates } from '../../../shared/src/types/passage'

/**
 * Convert a passage plan to KML format
 * KML (Keyhole Markup Language) is used by Google Earth and many marine apps
 */
export function passageToKML(passage: Passage): string {
  // Build styles
  const styles = buildStyles()
  
  // Build placemarks for waypoints
  const placemarks = buildPlacemarks(passage)
  
  // Build line string for route
  const lineString = buildLineString(passage)
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXML(passage.name)}</name>
    <description>Passage from ${escapeXML(passage.departure.name)} to ${escapeXML(passage.destination.name)}</description>
    
    ${styles}
    
    <Folder>
      <name>Waypoints</name>
      ${placemarks}
    </Folder>
    
    <Folder>
      <name>Route</name>
      ${lineString}
    </Folder>
    
    ${buildWeatherOverlay(passage)}
  </Document>
</kml>`
}

function buildStyles(): string {
  return `
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
    
    <Style id="anchorage">
      <IconStyle>
        <scale>1.0</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/anchor.png</href>
        </Icon>
      </IconStyle>
    </Style>
    
    <Style id="marina">
      <IconStyle>
        <scale>1.0</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/marina.png</href>
        </Icon>
      </IconStyle>
    </Style>
    
    <Style id="route">
      <LineStyle>
        <color>ff0080ff</color>
        <width>3</width>
      </LineStyle>
    </Style>`
}

function buildPlacemarks(passage: Passage): string {
  const placemarks: string[] = []
  
  // Departure
  placemarks.push(createPlacemark(
    passage.departure.coordinates,
    passage.departure.name,
    `Departure: ${new Date(passage.departureTime).toLocaleString()}`,
    'departure'
  ))
  
  // Waypoints
  passage.waypoints.forEach((wp, index) => {
    const eta = wp.arrivalTime ? `\nETA: ${new Date(wp.arrivalTime).toLocaleString()}` : ''
    placemarks.push(createPlacemark(
      wp.coordinates,
      wp.name,
      `${wp.notes || `Waypoint ${index + 1}`}${eta}`,
      getStyleId(wp.type)
    ))
  })
  
  // Destination
  placemarks.push(createPlacemark(
    passage.destination.coordinates,
    passage.destination.name,
    `Arrival: ${new Date(passage.estimatedArrivalTime).toLocaleString()}\nDistance: ${passage.distance.toFixed(1)} nm`,
    'destination'
  ))
  
  return placemarks.join('\n      ')
}

function buildLineString(passage: Passage): string {
  const coordinates: string[] = []
  
  // Add all coordinates in order
  coordinates.push(formatCoordinate(passage.departure.coordinates))
  passage.waypoints.forEach(wp => {
    coordinates.push(formatCoordinate(wp.coordinates))
  })
  coordinates.push(formatCoordinate(passage.destination.coordinates))
  
  return `
      <Placemark>
        <name>Route</name>
        <description>Total distance: ${passage.distance.toFixed(1)} nm</description>
        <styleUrl>#route</styleUrl>
        <LineString>
          <extrude>0</extrude>
          <tessellate>1</tessellate>
          <altitudeMode>clampToGround</altitudeMode>
          <coordinates>
            ${coordinates.join('\n            ')}
          </coordinates>
        </LineString>
      </Placemark>`
}

function buildWeatherOverlay(passage: Passage): string {
  if (!passage.weather || passage.weather.length === 0) {
    return ''
  }
  
  const weatherPlacemarks: string[] = []
  
  passage.weather.forEach((segment, index) => {
    const windArrow = createWindArrow(
      segment.location,
      segment.wind.direction,
      segment.wind.speed,
      segment.startTime
    )
    weatherPlacemarks.push(windArrow)
  })
  
  return `
    <Folder>
      <name>Weather</name>
      ${weatherPlacemarks.join('\n      ')}
    </Folder>`
}

function createPlacemark(
  coords: Coordinates,
  name: string,
  description: string,
  styleId: string
): string {
  return `
      <Placemark>
        <name>${escapeXML(name)}</name>
        <description>${escapeXML(description)}</description>
        <styleUrl>#${styleId}</styleUrl>
        <Point>
          <coordinates>${coords.lng},${coords.lat},0</coordinates>
        </Point>
      </Placemark>`
}

function createWindArrow(
  location: Coordinates,
  direction: number,
  speed: number,
  time: Date
): string {
  // Create a simple wind barb representation
  const label = `${Math.round(speed)} kts from ${Math.round(direction)}°`
  
  return `
      <Placemark>
        <name>Wind: ${label}</name>
        <description>Time: ${time.toLocaleString()}</description>
        <Point>
          <coordinates>${location.lng},${location.lat},0</coordinates>
        </Point>
      </Placemark>`
}

function formatCoordinate(coord: Coordinates): string {
  return `${coord.lng},${coord.lat},0`
}

function getStyleId(type?: string): string {
  switch (type) {
    case 'anchorage':
      return 'anchorage'
    case 'marina':
      return 'marina'
    default:
      return 'waypoint'
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

/**
 * Download KML file
 */
export function downloadKML(passage: Passage): void {
  const kmlContent = passageToKML(passage)
  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `${passage.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_passage.kml`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
} 