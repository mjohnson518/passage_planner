// Import types - shared package not available in frontend, using any
// TODO: Add shared package to frontend or define types locally

/**
 * Convert passage plan to CSV format for spreadsheet import
 */
export function passageToCSV(passage: any): string {
  const headers = [
    'Waypoint',
    'Latitude',
    'Longitude',
    'Distance (nm)',
    'Bearing (°T)',
    'ETA',
    'Type',
    'Notes'
  ]
  
  const rows: string[][] = []
  
  // Add departure
  rows.push([
    passage.departure.name,
    passage.departure.coordinates.lat.toFixed(6),
    passage.departure.coordinates.lng.toFixed(6),
    '0',
    '',
    new Date(passage.departureTime).toISOString(),
    'Departure',
    passage.departure.notes || ''
  ])
  
  // Add waypoints with route info
  let cumulativeDistance = 0
  passage.route.forEach((segment, index) => {
    cumulativeDistance += segment.distance
    
    const waypoint = index < passage.waypoints.length ? passage.waypoints[index] : null
    const name = waypoint?.name || `Waypoint ${index + 1}`
    const eta = waypoint?.arrivalTime || calculateETA(passage.departureTime, cumulativeDistance, passage.estimatedDuration / passage.distance)
    
    rows.push([
      name,
      segment.to.lat.toFixed(6),
      segment.to.lng.toFixed(6),
      segment.distance.toFixed(1),
      segment.bearing.toFixed(0),
      new Date(eta).toISOString(),
      waypoint?.type || 'waypoint',
      waypoint?.notes || ''
    ])
  })
  
  // Add destination if not already included
  const lastSegment = passage.route[passage.route.length - 1]
  if (!lastSegment || 
      lastSegment.to.lat !== passage.destination.coordinates.lat || 
      lastSegment.to.lng !== passage.destination.coordinates.lng) {
    rows.push([
      passage.destination.name,
      passage.destination.coordinates.lat.toFixed(6),
      passage.destination.coordinates.lng.toFixed(6),
      passage.distance.toFixed(1),
      '',
      new Date(passage.estimatedArrivalTime).toISOString(),
      'Destination',
      passage.destination.notes || ''
    ])
  }
  
  // Convert to CSV
  const csvRows = [
    headers.join(','),
    ...rows.map(row => row.map(cell => escapeCSV(cell)).join(','))
  ]
  
  return csvRows.join('\n')
}

/**
 * Export weather data to CSV
 */
export function weatherToCSV(passage: any): string {
  if (!passage.weather || passage.weather.length === 0) {
    return ''
  }
  
  const headers = [
    'Time',
    'Latitude',
    'Longitude',
    'Wind Direction (°)',
    'Wind Speed (kts)',
    'Wind Gusts (kts)',
    'Wave Height (m)',
    'Wave Period (s)',
    'Visibility (nm)',
    'Temperature (°C)'
  ]
  
  const rows = passage.weather.map(segment => [
    new Date(segment.startTime).toISOString(),
    segment.location.lat.toFixed(6),
    segment.location.lng.toFixed(6),
    segment.wind.direction.toFixed(0),
    segment.wind.speed.toFixed(1),
    segment.wind.gusts?.toFixed(1) || '',
    segment.waves.height.toFixed(1),
    segment.waves.period.toFixed(0),
    segment.visibility?.toFixed(1) || '',
    segment.temperature?.toFixed(1) || ''
  ])
  
  const csvRows = [
    headers.join(','),
    ...rows.map(row => row.map(cell => escapeCSV(cell)).join(','))
  ]
  
  return csvRows.join('\n')
}

/**
 * Export tidal data to CSV
 */
export function tidesToCSV(passage: any): string {
  if (!passage.tides || passage.tides.length === 0) {
    return ''
  }
  
  const headers = [
    'Location',
    'Type',
    'Time',
    'Height (m)',
    'Current Speed (kts)',
    'Current Direction (°)'
  ]
  
  const rows = passage.tides.map(tide => [
    tide.location,
    tide.type.toUpperCase(),
    new Date(tide.time).toISOString(),
    tide.height.toFixed(2),
    tide.current?.speed.toFixed(1) || '',
    tide.current?.direction.toFixed(0) || ''
  ])
  
  const csvRows = [
    headers.join(','),
    ...rows.map(row => row.map(cell => escapeCSV(cell)).join(','))
  ]
  
  return csvRows.join('\n')
}

function calculateETA(departureTime: Date, distance: number, avgSpeed: number): Date {
  const hours = distance / avgSpeed
  return new Date(departureTime.getTime() + hours * 3600000)
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Download CSV file
 */
export function downloadCSV(
  passage: any, 
  type: 'route' | 'weather' | 'tides' = 'route'
): void {
  let csvContent: string
  let filename: string
  
  switch (type) {
    case 'weather':
      csvContent = weatherToCSV(passage)
      filename = `${passage.name}_weather.csv`
      break
    case 'tides':
      csvContent = tidesToCSV(passage)
      filename = `${passage.name}_tides.csv`
      break
    default:
      csvContent = passageToCSV(passage)
      filename = `${passage.name}_route.csv`
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
} 