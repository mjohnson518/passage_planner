import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { Passage } from '../../../shared/src/types/passage'

interface PDFExportOptions {
  includeCharts?: boolean
  includeWeather?: boolean
  includeTides?: boolean
  includeSafety?: boolean
  pageSize?: 'a4' | 'letter'
}

/**
 * Generate a professional PDF passage plan
 */
export async function generatePassagePDF(
  passage: Passage, 
  options: PDFExportOptions = {}
): Promise<jsPDF> {
  const {
    includeCharts = true,
    includeWeather = true,
    includeTides = true,
    includeSafety = true,
    pageSize = 'letter'
  } = options

  // Initialize PDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: pageSize
  })

  // Page dimensions
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  let yPosition = margin

  // Title Page
  addTitlePage(pdf, passage, yPosition, margin, contentWidth)
  
  // Route Overview
  pdf.addPage()
  yPosition = margin
  addRouteOverview(pdf, passage, yPosition, margin, contentWidth)
  
  // Waypoint Details
  pdf.addPage()
  yPosition = margin
  addWaypointDetails(pdf, passage, yPosition, margin, contentWidth)
  
  // Weather Information
  if (includeWeather && passage.weather.length > 0) {
    pdf.addPage()
    yPosition = margin
    addWeatherInformation(pdf, passage, yPosition, margin, contentWidth)
  }
  
  // Tidal Information
  if (includeTides && passage.tides.length > 0) {
    pdf.addPage()
    yPosition = margin
    addTidalInformation(pdf, passage, yPosition, margin, contentWidth)
  }
  
  // Safety Information
  if (includeSafety) {
    pdf.addPage()
    yPosition = margin
    addSafetyInformation(pdf, passage, yPosition, margin, contentWidth)
  }
  
  // Add page numbers
  addPageNumbers(pdf)
  
  return pdf
}

function addTitlePage(
  pdf: jsPDF, 
  passage: Passage, 
  y: number, 
  margin: number, 
  contentWidth: number
): void {
  // Title
  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.text('PASSAGE PLAN', margin, y)
  y += 15

  // Passage name
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'normal')
  const lines = pdf.splitTextToSize(passage.name, contentWidth)
  pdf.text(lines, margin, y)
  y += lines.length * 8 + 10

  // Route summary
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('ROUTE SUMMARY', margin, y)
  y += 10

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  
  // From/To
  pdf.text(`From: ${passage.departure.name}`, margin, y)
  y += 7
  pdf.text(`To: ${passage.destination.name}`, margin, y)
  y += 10

  // Key metrics
  pdf.text(`Distance: ${passage.distance.toFixed(1)} nautical miles`, margin, y)
  y += 7
  pdf.text(`Estimated Duration: ${formatDuration(passage.estimatedDuration)}`, margin, y)
  y += 7
  pdf.text(`Departure: ${formatDateTime(passage.departureTime)}`, margin, y)
  y += 7
  pdf.text(`ETA: ${formatDateTime(passage.estimatedArrivalTime)}`, margin, y)
  y += 15

  // Vessel information (if available)
  pdf.setFont('helvetica', 'bold')
  pdf.text('VESSEL INFORMATION', margin, y)
  y += 10
  
  pdf.setFont('helvetica', 'normal')
  // TODO: Add vessel details when available
  pdf.text('Vessel: [Vessel Name]', margin, y)
  y += 7
  pdf.text('Type: Sailboat', margin, y)
  y += 7
  pdf.text('Draft: 5.0 ft', margin, y)
  y += 15

  // Weather limits
  pdf.setFont('helvetica', 'bold')
  pdf.text('PLANNING PARAMETERS', margin, y)
  y += 10
  
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Max Wind Speed: ${passage.preferences.maxWindSpeed} knots`, margin, y)
  y += 7
  pdf.text(`Max Wave Height: ${passage.preferences.maxWaveHeight} meters`, margin, y)
  y += 7
  pdf.text(`Night Sailing: ${passage.preferences.avoidNight ? 'Avoid' : 'Allowed'}`, margin, y)
  
  // Footer
  const footerY = pdf.internal.pageSize.getHeight() - 20
  pdf.setFontSize(10)
  pdf.setTextColor(128)
  pdf.text(`Generated on ${new Date().toLocaleDateString()} by Helmwise`, margin, footerY)
  pdf.text('www.helmwise.co', margin, footerY + 5)
  pdf.setTextColor(0)
}

function addRouteOverview(
  pdf: jsPDF,
  passage: Passage,
  y: number,
  margin: number,
  contentWidth: number
): void {
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('ROUTE OVERVIEW', margin, y)
  y += 12

  // Route table headers
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  
  const col1 = margin
  const col2 = margin + 50
  const col3 = margin + 90
  const col4 = margin + 120
  const col5 = margin + 150
  
  pdf.text('WAYPOINT', col1, y)
  pdf.text('COORDINATES', col2, y)
  pdf.text('BEARING', col3, y)
  pdf.text('DISTANCE', col4, y)
  pdf.text('ETA', col5, y)
  
  y += 2
  pdf.line(margin, y, margin + contentWidth, y)
  y += 8

  pdf.setFont('helvetica', 'normal')
  
  // Departure
  pdf.text(truncateText(passage.departure.name, 45), col1, y)
  pdf.text(formatCoordinates(passage.departure.coordinates), col2, y)
  pdf.text('-', col3, y)
  pdf.text('0.0 nm', col4, y)
  pdf.text(formatTime(passage.departureTime), col5, y)
  y += 7

  // Waypoints
  let cumulativeDistance = 0
  passage.waypoints.forEach((waypoint, index) => {
    const segment = passage.route[index]
    if (segment) {
      cumulativeDistance += segment.distance
      
      pdf.text(truncateText(waypoint.name, 45), col1, y)
      pdf.text(formatCoordinates(waypoint.coordinates), col2, y)
      pdf.text(`${segment.bearing.toFixed(0)}° T`, col3, y)
      pdf.text(`${segment.distance.toFixed(1)} nm`, col4, y)
      
      const eta = calculateETA(passage.departureTime, cumulativeDistance, passage.estimatedDuration / passage.distance)
      pdf.text(formatTime(eta), col5, y)
      y += 7
      
      // Add page break if needed
      if (y > pdf.internal.pageSize.getHeight() - 40) {
        pdf.addPage()
        y = margin
      }
    }
  })
  
  // Destination
  const lastSegment = passage.route[passage.route.length - 1]
  if (lastSegment) {
    pdf.text(truncateText(passage.destination.name, 45), col1, y)
    pdf.text(formatCoordinates(passage.destination.coordinates), col2, y)
    pdf.text(`${lastSegment.bearing.toFixed(0)}° T`, col3, y)
    pdf.text(`${lastSegment.distance.toFixed(1)} nm`, col4, y)
    pdf.text(formatTime(passage.estimatedArrivalTime), col5, y)
    y += 10
  }
  
  // Total line
  pdf.line(margin, y, margin + contentWidth, y)
  y += 7
  pdf.setFont('helvetica', 'bold')
  pdf.text('TOTAL', col1, y)
  pdf.text(`${passage.distance.toFixed(1)} nm`, col4, y)
  pdf.text(formatDuration(passage.estimatedDuration), col5, y)
}

function addWaypointDetails(
  pdf: jsPDF,
  passage: Passage,
  y: number,
  margin: number,
  contentWidth: number
): void {
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('WAYPOINT DETAILS', margin, y)
  y += 12

  // Departure details
  y = addWaypointInfo(pdf, {
    name: passage.departure.name,
    coordinates: passage.departure.coordinates,
    type: 'DEPARTURE',
    facilities: passage.departure.facilities,
    vhfChannel: passage.departure.vhfChannel,
    notes: passage.departure.notes,
    time: passage.departureTime
  }, y, margin, contentWidth)

  // Waypoint details
  passage.waypoints.forEach((waypoint, index) => {
    if (y > pdf.internal.pageSize.getHeight() - 60) {
      pdf.addPage()
      y = margin
    }
    
    const eta = calculateETA(
      passage.departureTime, 
      passage.route.slice(0, index + 1).reduce((sum, seg) => sum + seg.distance, 0),
      passage.estimatedDuration / passage.distance
    )
    
    y = addWaypointInfo(pdf, {
      name: waypoint.name,
      coordinates: waypoint.coordinates,
      type: waypoint.type?.toUpperCase() || 'WAYPOINT',
      notes: waypoint.notes,
      time: eta
    }, y, margin, contentWidth)
  })

  // Destination details
  if (y > pdf.internal.pageSize.getHeight() - 60) {
    pdf.addPage()
    y = margin
  }
  
  addWaypointInfo(pdf, {
    name: passage.destination.name,
    coordinates: passage.destination.coordinates,
    type: 'DESTINATION',
    facilities: passage.destination.facilities,
    vhfChannel: passage.destination.vhfChannel,
    notes: passage.destination.notes,
    time: passage.estimatedArrivalTime
  }, y, margin, contentWidth)
}

function addWaypointInfo(
  pdf: jsPDF,
  waypoint: any,
  y: number,
  margin: number,
  contentWidth: number
): number {
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`${waypoint.type}: ${waypoint.name}`, margin, y)
  y += 7

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  
  pdf.text(`Position: ${formatCoordinates(waypoint.coordinates)}`, margin, y)
  y += 6
  
  if (waypoint.time) {
    pdf.text(`ETA: ${formatDateTime(waypoint.time)}`, margin, y)
    y += 6
  }
  
  if (waypoint.vhfChannel) {
    pdf.text(`VHF: Channel ${waypoint.vhfChannel}`, margin, y)
    y += 6
  }
  
  if (waypoint.facilities && waypoint.facilities.length > 0) {
    pdf.text(`Facilities: ${waypoint.facilities.join(', ')}`, margin, y)
    y += 6
  }
  
  if (waypoint.notes) {
    const noteLines = pdf.splitTextToSize(`Notes: ${waypoint.notes}`, contentWidth)
    pdf.text(noteLines, margin, y)
    y += noteLines.length * 5 + 6
  }
  
  y += 8 // Extra spacing between waypoints
  return y
}

function addWeatherInformation(
  pdf: jsPDF,
  passage: Passage,
  y: number,
  margin: number,
  contentWidth: number
): void {
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('WEATHER FORECAST', margin, y)
  y += 12

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  
  passage.weather.forEach((segment) => {
    if (y > pdf.internal.pageSize.getHeight() - 40) {
      pdf.addPage()
      y = margin
    }
    
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${formatDateTime(segment.startTime)} - ${formatDateTime(segment.endTime)}`, margin, y)
    y += 7
    
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Position: ${formatCoordinates(segment.location)}`, margin, y)
    y += 6
    pdf.text(`Wind: ${segment.wind.direction}° at ${segment.wind.speed} kts` + 
             (segment.wind.gusts ? `, gusting ${segment.wind.gusts} kts` : ''), margin, y)
    y += 6
    pdf.text(`Waves: ${segment.waves.height}m @ ${segment.waves.period}s`, margin, y)
    y += 6
    
    if (segment.visibility) {
      pdf.text(`Visibility: ${segment.visibility} nm`, margin, y)
      y += 6
    }
    
    y += 6 // Extra spacing
  })
}

function addTidalInformation(
  pdf: jsPDF,
  passage: Passage,
  y: number,
  margin: number,
  contentWidth: number
): void {
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('TIDAL INFORMATION', margin, y)
  y += 12

  pdf.setFontSize(10)
  
  // Group tides by location
  const tidesByLocation = passage.tides.reduce((acc, tide) => {
    if (!acc[tide.location]) acc[tide.location] = []
    acc[tide.location].push(tide)
    return acc
  }, {} as Record<string, typeof passage.tides>)
  
  Object.entries(tidesByLocation).forEach(([location, tides]) => {
    if (y > pdf.internal.pageSize.getHeight() - 40) {
      pdf.addPage()
      y = margin
    }
    
    pdf.setFont('helvetica', 'bold')
    pdf.text(location, margin, y)
    y += 7
    
    pdf.setFont('helvetica', 'normal')
    tides.forEach(tide => {
      const tideText = `${tide.type === 'high' ? 'High' : 'Low'} tide: ${formatDateTime(tide.time)} - ${tide.height.toFixed(1)}m`
      pdf.text(tideText, margin + 5, y)
      y += 6
      
      if (tide.current) {
        pdf.text(`Current: ${tide.current.speed.toFixed(1)} kts @ ${tide.current.direction}°`, margin + 10, y)
        y += 6
      }
    })
    
    y += 4 // Extra spacing
  })
}

function addSafetyInformation(
  pdf: jsPDF,
  passage: Passage,
  y: number,
  margin: number,
  contentWidth: number
): void {
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('SAFETY INFORMATION', margin, y)
  y += 12

  pdf.setFontSize(10)
  
  // VHF Channels
  pdf.setFont('helvetica', 'bold')
  pdf.text('VHF MONITORING', margin, y)
  y += 7
  
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Channels: ${passage.safety.vhfChannels.join(', ')}`, margin, y)
  y += 10

  // Navigation Warnings
  if (passage.safety.navigationWarnings.length > 0) {
    pdf.setFont('helvetica', 'bold')
    pdf.text('NAVIGATION WARNINGS', margin, y)
    y += 7
    
    pdf.setFont('helvetica', 'normal')
    passage.safety.navigationWarnings.forEach(warning => {
      const warningLines = pdf.splitTextToSize(`• ${warning}`, contentWidth - 5)
      pdf.text(warningLines, margin + 5, y)
      y += warningLines.length * 5 + 3
    })
    y += 7
  }

  // Emergency Contacts
  pdf.setFont('helvetica', 'bold')
  pdf.text('EMERGENCY CONTACTS', margin, y)
  y += 7
  
  pdf.setFont('helvetica', 'normal')
  pdf.text('• USCG: VHF Channel 16 or call 911', margin, y)
  y += 6
  pdf.text('• TowBoatUS: 1-800-888-4869', margin, y)
  y += 6
  pdf.text('• SeaTow: 1-800-473-2869', margin, y)
  
  // Add custom emergency contacts if available
  passage.safety.emergencyContacts.forEach(contact => {
    y += 6
    let contactText = `• ${contact.name}`
    if (contact.vhfChannel) contactText += ` - VHF ${contact.vhfChannel}`
    if (contact.phoneNumber) contactText += ` - ${contact.phoneNumber}`
    pdf.text(contactText, margin, y)
  })
}

function addPageNumbers(pdf: jsPDF): void {
  const pageCount = pdf.getNumberOfPages()
  
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(9)
    pdf.setTextColor(128)
    pdf.text(
      `Page ${i} of ${pageCount}`,
      pdf.internal.pageSize.getWidth() / 2,
      pdf.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }
  pdf.setTextColor(0)
}

// Helper functions
function formatCoordinates(coords: { lat: number; lng: number }): string {
  const latDir = coords.lat >= 0 ? 'N' : 'S'
  const lngDir = coords.lng >= 0 ? 'E' : 'W'
  return `${Math.abs(coords.lat).toFixed(4)}°${latDir}, ${Math.abs(coords.lng).toFixed(4)}°${lngDir}`
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDuration(hours: number): string {
  const days = Math.floor(hours / 24)
  const remainingHours = Math.floor(hours % 24)
  const minutes = Math.floor((hours % 1) * 60)
  
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (remainingHours > 0) parts.push(`${remainingHours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  
  return parts.join(' ')
}

function calculateETA(departureTime: Date, distance: number, avgSpeed: number): Date {
  const hours = distance / avgSpeed
  return new Date(new Date(departureTime).getTime() + hours * 3600000)
}

function truncateText(text: string, maxLength: number): string {
  return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text
}

/**
 * Download passage plan as PDF
 */
export async function downloadPassagePDF(
  passage: Passage,
  options?: PDFExportOptions
): Promise<void> {
  try {
    const pdf = await generatePassagePDF(passage, options)
    const filename = `${passage.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_passage_plan.pdf`
    pdf.save(filename)
  } catch (error) {
    console.error('Failed to generate PDF:', error)
    throw error
  }
}

/**
 * Generate PDF with chart image
 */
export async function generatePDFWithChart(
  passage: Passage,
  chartElement: HTMLElement,
  options?: PDFExportOptions
): Promise<void> {
  const pdf = await generatePassagePDF(passage, options)
  
  // Add chart page
  pdf.addPage()
  const margin = 20
  const pageWidth = pdf.internal.pageSize.getWidth()
  const contentWidth = pageWidth - (margin * 2)
  
  // Title
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('ROUTE CHART', margin, margin)
  
  // Capture chart as image
  const canvas = await html2canvas(chartElement, {
    scale: 2,
    useCORS: true,
    logging: false
  })
  
  const imgData = canvas.toDataURL('image/png')
  const imgWidth = contentWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  
  pdf.addImage(imgData, 'PNG', margin, margin + 15, imgWidth, imgHeight)
  
  // Save PDF
  const filename = `${passage.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_passage_plan.pdf`
  pdf.save(filename)
} 