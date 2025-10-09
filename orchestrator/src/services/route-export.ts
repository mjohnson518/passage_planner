/**
 * Route Export Service
 * 
 * Exports passage routes to standard navigation formats (GPX, KML)
 * for import into chartplotters and navigation applications.
 */

import { Logger } from 'pino';

export interface Waypoint {
  latitude: number;
  longitude: number;
  name?: string;
  description?: string;
  symbol?: string;
}

export interface Route {
  name: string;
  description?: string;
  waypoints: Waypoint[];
  metadata?: {
    distance?: number;
    duration?: string;
    departure?: string;
    destination?: string;
    createdBy?: string;
    createdAt?: Date;
  };
}

export class RouteExportService {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Export route to GPX format (GPS Exchange Format)
   * Compatible with: Garmin, Raymarine, Navionics, OpenCPN
   */
  exportToGPX(route: Route): string {
    const gpx = this.buildGPX(route);
    
    this.logger.info({
      routeName: route.name,
      waypoints: route.waypoints.length,
      format: 'GPX',
    }, 'Route exported to GPX');

    return gpx;
  }

  /**
   * Export route to KML format (Keyhole Markup Language)
   * Compatible with: Google Earth, many mapping applications
   */
  exportToKML(route: Route): string {
    const kml = this.buildKML(route);
    
    this.logger.info({
      routeName: route.name,
      waypoints: route.waypoints.length,
      format: 'KML',
    }, 'Route exported to KML');

    return kml;
  }

  /**
   * Export route to CSV format (simple waypoint list)
   * Compatible with: Excel, spreadsheet applications
   */
  exportToCSV(route: Route): string {
    const csv = this.buildCSV(route);
    
    this.logger.info({
      routeName: route.name,
      waypoints: route.waypoints.length,
      format: 'CSV',
    }, 'Route exported to CSV');

    return csv;
  }

  /**
   * Build GPX XML string
   */
  private buildGPX(route: Route): string {
    const waypoints = route.waypoints
      .map((wp, index) => `
  <wpt lat="${wp.latitude}" lon="${wp.longitude}">
    <name>${this.escapeXML(wp.name || `WP${index + 1}`)}</name>
    ${wp.description ? `<desc>${this.escapeXML(wp.description)}</desc>` : ''}
    <sym>${wp.symbol || 'Flag, Blue'}</sym>
    <type>WPT</type>
  </wpt>`)
      .join('\n');

    const routePoints = route.waypoints
      .map((wp, index) => `
      <rtept lat="${wp.latitude}" lon="${wp.longitude}">
        <name>${this.escapeXML(wp.name || `WP${index + 1}`)}</name>
        ${wp.description ? `<desc>${this.escapeXML(wp.description)}</desc>` : ''}
      </rtept>`)
      .join('\n');

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Helmwise Passage Planner" 
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${this.escapeXML(route.name)}</name>
    ${route.description ? `<desc>${this.escapeXML(route.description)}</desc>` : ''}
    <author>
      <name>Helmwise</name>
      <link href="https://helmwise.co"/>
    </author>
    <time>${route.metadata?.createdAt?.toISOString() || new Date().toISOString()}</time>
  </metadata>
${waypoints}
  <rte>
    <name>${this.escapeXML(route.name)}</name>
    ${route.description ? `<desc>${this.escapeXML(route.description)}</desc>` : ''}
${routePoints}
  </rte>
</gpx>`;

    return gpx;
  }

  /**
   * Build KML string
   */
  private buildKML(route: Route): string {
    const placemarks = route.waypoints
      .map((wp, index) => `
    <Placemark>
      <name>${this.escapeXML(wp.name || `WP${index + 1}`)}</name>
      ${wp.description ? `<description>${this.escapeXML(wp.description)}</description>` : ''}
      <Point>
        <coordinates>${wp.longitude},${wp.latitude},0</coordinates>
      </Point>
    </Placemark>`)
      .join('\n');

    const coordinates = route.waypoints
      .map(wp => `${wp.longitude},${wp.latitude},0`)
      .join('\n        ');

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${this.escapeXML(route.name)}</name>
    ${route.description ? `<description>${this.escapeXML(route.description)}</description>` : ''}
    <Style id="route-line">
      <LineStyle>
        <color>ff0000ff</color>
        <width>3</width>
      </LineStyle>
    </Style>
${placemarks}
    <Placemark>
      <name>Route: ${this.escapeXML(route.name)}</name>
      <styleUrl>#route-line</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
        ${coordinates}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

    return kml;
  }

  /**
   * Build CSV string
   */
  private buildCSV(route: Route): string {
    const header = 'Waypoint,Latitude,Longitude,Name,Description';
    const rows = route.waypoints.map((wp, index) =>
      `WP${index + 1},${wp.latitude},${wp.longitude},"${wp.name || ''}","${wp.description || ''}"`
    );

    return [header, ...rows].join('\n');
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate printable waypoint list
   */
  generateWaypointList(route: Route): string {
    const lines: string[] = [];
    lines.push(`Route: ${route.name}`);
    lines.push(`Total Waypoints: ${route.waypoints.length}`);
    
    if (route.metadata?.distance) {
      lines.push(`Total Distance: ${route.metadata.distance.toFixed(1)} nm`);
    }
    if (route.metadata?.duration) {
      lines.push(`Estimated Duration: ${route.metadata.duration}`);
    }

    lines.push('');
    lines.push('Waypoints:');
    lines.push('-----------------------------------------------------------');
    lines.push('WP# | Name | Latitude | Longitude | Bearing | Distance');
    lines.push('-----------------------------------------------------------');

    route.waypoints.forEach((wp, index) => {
      const bearing = index > 0 
        ? this.calculateBearing(route.waypoints[index - 1], wp).toFixed(0) + '°'
        : 'START';
      
      const distance = index > 0
        ? this.calculateDistance(route.waypoints[index - 1], wp).toFixed(1) + ' nm'
        : '-';

      lines.push(
        `${String(index + 1).padStart(3)} | ` +
        `${(wp.name || `WP${index + 1}`).padEnd(15)} | ` +
        `${this.formatCoordinate(wp.latitude, 'lat').padEnd(12)} | ` +
        `${this.formatCoordinate(wp.longitude, 'lon').padEnd(13)} | ` +
        `${bearing.padEnd(7)} | ` +
        `${distance}`
      );
    });

    lines.push('-----------------------------------------------------------');

    return lines.join('\n');
  }

  /**
   * Format coordinate in degrees-minutes format
   */
  private formatCoordinate(decimal: number, type: 'lat' | 'lon'): string {
    const abs = Math.abs(decimal);
    const degrees = Math.floor(abs);
    const minutes = (abs - degrees) * 60;
    
    const direction = type === 'lat'
      ? (decimal >= 0 ? 'N' : 'S')
      : (decimal >= 0 ? 'E' : 'W');

    return `${degrees}° ${minutes.toFixed(3)}' ${direction}`;
  }

  /**
   * Calculate bearing between two waypoints
   */
  private calculateBearing(from: Waypoint, to: Waypoint): number {
    const lat1 = from.latitude * Math.PI / 180;
    const lat2 = to.latitude * Math.PI / 180;
    const dLon = (to.longitude - from.longitude) * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  /**
   * Calculate distance between two waypoints
   */
  private calculateDistance(from: Waypoint, to: Waypoint): number {
    const R = 3440.1; // Nautical miles
    const lat1 = from.latitude * Math.PI / 180;
    const lat2 = to.latitude * Math.PI / 180;
    const dLat = (to.latitude - from.latitude) * Math.PI / 180;
    const dLon = (to.longitude - from.longitude) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

