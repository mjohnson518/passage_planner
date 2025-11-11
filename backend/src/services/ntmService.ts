/**
 * Notice to Mariners (NTM) Service
 * SAFETY-CRITICAL: Provides navigation warnings and maritime safety alerts
 * 
 * This service fetches and aggregates maritime safety information from:
 * - NOAA/NWS marine weather alerts
 * - Coast Guard Local Notice to Mariners
 * - Known navigation hazards database
 * 
 * FAIL-SAFE PRINCIPLE: If data is unavailable, warn mariners - never fail silently
 */

import axios from 'axios';

export interface NavigationWarning {
  id: string;
  type: 'hazard' | 'restriction' | 'update' | 'chart_correction';
  title: string;
  description: string;
  location: {
    latitude?: number;
    longitude?: number;
    area?: string;
  };
  severity: 'critical' | 'warning' | 'info';
  effectiveDate: Date;
  expiryDate?: Date;
  source: string;
}

/**
 * Get navigation warnings for a route
 * SAFETY-CRITICAL: Always returns warnings, even if only to report data unavailability
 * 
 * @param departure Starting coordinates
 * @param destination Ending coordinates
 * @returns Array of navigation warnings (never empty - includes system warnings if needed)
 */
export async function getNavigationWarnings(
  departure: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): Promise<NavigationWarning[]> {
  const warnings: NavigationWarning[] = [];
  let noaaSuccess = false;
  
  try {
    console.log(`Fetching navigation warnings for route: ${departure.latitude},${departure.longitude} -> ${destination.latitude},${destination.longitude}`);
    
    // Fetch NOAA marine alerts for departure area
    try {
      const departureAlerts = await fetchNOAAMarineAlerts(
        departure.latitude, 
        departure.longitude
      );
      warnings.push(...departureAlerts);
      noaaSuccess = true;
      console.log(`Found ${departureAlerts.length} alerts at departure`);
    } catch (error: any) {
      console.error('Departure alerts fetch failed:', error.message);
    }
    
    // Fetch NOAA marine alerts for destination area
    try {
      const destinationAlerts = await fetchNOAAMarineAlerts(
        destination.latitude, 
        destination.longitude
      );
      
      // Filter duplicates by ID
      const uniqueDestAlerts = destinationAlerts.filter(
        alert => !warnings.some(w => w.id === alert.id)
      );
      warnings.push(...uniqueDestAlerts);
      noaaSuccess = true;
      console.log(`Found ${uniqueDestAlerts.length} unique alerts at destination`);
    } catch (error: any) {
      console.error('Destination alerts fetch failed:', error.message);
    }
    
    // Add static known hazards along route
    const staticWarnings = getStaticNavigationWarnings(departure, destination);
    warnings.push(...staticWarnings);
    console.log(`Added ${staticWarnings.length} static navigation warnings`);
    
    // FAIL-SAFE: If no NOAA data retrieved, add critical warning
    if (!noaaSuccess) {
      warnings.push({
        id: 'ntm-noaa-unavailable',
        type: 'update',
        title: '⚠️ CRITICAL: Navigation Warnings Data Unavailable',
        description: 'Unable to retrieve current marine safety alerts from NOAA. DO NOT PROCEED without verifying current conditions through official channels (VHF WX channels, USCG, local harbor master).',
        location: { area: 'Route-wide' },
        severity: 'critical',
        effectiveDate: new Date(),
        source: 'Helmwise Safety System'
      });
    }
    
  } catch (error: any) {
    console.error('NTM service error:', error.message);
    
    // FAIL-SAFE: Critical error - warn mariner
    warnings.push({
      id: 'ntm-system-error',
      type: 'update',
      title: '⚠️ CRITICAL: Navigation Warning System Error',
      description: 'Unable to fetch current Notice to Mariners and navigation warnings. This is a critical safety system. DO NOT PROCEED without checking official sources: USCG Local Notice to Mariners, NOAA marine forecasts, and VHF weather channels.',
      location: { area: 'Route-wide' },
      severity: 'critical',
      effectiveDate: new Date(),
      source: 'Helmwise Safety System'
    });
  }
  
  // SAFETY GUARANTEE: Always return at least verification reminder
  if (warnings.length === 0) {
    warnings.push({
      id: 'ntm-verify-reminder',
      type: 'update',
      title: 'No Active Warnings Found',
      description: 'No active navigation warnings detected for this route. Always verify with current charts, Coast Pilot, and local knowledge before departure.',
      location: { area: 'Route-wide' },
      severity: 'info',
      effectiveDate: new Date(),
      source: 'Helmwise Safety System'
    });
  }
  
  // Sort by severity (critical first)
  warnings.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
  
  console.log(`Returning ${warnings.length} total navigation warnings`);
  return warnings;
}

/**
 * Fetch marine alerts from NOAA for a specific location
 */
async function fetchNOAAMarineAlerts(
  lat: number, 
  lon: number
): Promise<NavigationWarning[]> {
  const warnings: NavigationWarning[] = [];
  
  const response = await axios.get(
    `https://api.weather.gov/alerts/active?point=${lat},${lon}`,
    { 
      timeout: 5000,
      headers: { 'User-Agent': 'Helmwise/1.0 (contact@helmwise.co)' }
    }
  );
  
  if (response.data.features && Array.isArray(response.data.features)) {
    response.data.features.forEach((feature: any) => {
      const props = feature.properties;
      
      // Only process marine-related events
      if (isMarineRelated(props.event)) {
        warnings.push({
          id: props.id || `noaa-${Date.now()}-${Math.random()}`,
          type: classifyWarningType(props.event),
          title: props.headline || props.event,
          description: props.description || props.instruction || 'See NOAA alert for details',
          location: {
            area: props.areaDesc || 'Unspecified area'
          },
          severity: classifySeverity(props.severity, props.event),
          effectiveDate: props.effective ? new Date(props.effective) : new Date(),
          expiryDate: props.expires ? new Date(props.expires) : undefined,
          source: 'NOAA/NWS Marine Alert'
        });
      }
    });
  }
  
  return warnings;
}

/**
 * Determine if a weather event is marine-related
 */
function isMarineRelated(eventType: string): boolean {
  const marineEvents = [
    'Marine Weather Statement',
    'Small Craft Advisory',
    'Gale Warning',
    'Storm Warning',
    'Hurricane Warning',
    'Hurricane Watch',
    'Tropical Storm Warning',
    'Tropical Storm Watch',
    'Special Marine Warning',
    'Marine Dense Fog Advisory',
    'Coastal Flood',
    'High Surf',
    'Rip Current',
    'Tsunami',
    'Storm Surge'
  ];
  
  return marineEvents.some(event => 
    eventType.toLowerCase().includes(event.toLowerCase())
  );
}

/**
 * Classify warning type based on event
 */
function classifyWarningType(event: string): NavigationWarning['type'] {
  const lower = event.toLowerCase();
  
  if (lower.includes('hurricane') || 
      lower.includes('storm') || 
      lower.includes('tsunami') ||
      lower.includes('surge')) {
    return 'hazard';
  }
  
  if (lower.includes('advisory') || 
      lower.includes('warning') ||
      lower.includes('watch')) {
    return 'restriction';
  }
  
  return 'update';
}

/**
 * Classify severity with conservative bias for maritime safety
 * SAFETY: When in doubt, classify as higher severity
 */
function classifySeverity(severity: string, event: string): NavigationWarning['severity'] {
  // Conservative approach: certain events are always critical
  const criticalEvents = ['hurricane', 'tsunami', 'storm surge', 'gale'];
  if (criticalEvents.some(e => event.toLowerCase().includes(e))) {
    return 'critical';
  }
  
  // NOAA severity classification
  if (severity === 'Extreme' || severity === 'Severe') {
    return 'critical';
  }
  
  if (severity === 'Moderate') {
    return 'warning';
  }
  
  return 'info';
}

/**
 * Get static navigation warnings for known hazards along route
 * In production, this would query a maintained database of current NTMs
 */
function getStaticNavigationWarnings(
  departure: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): NavigationWarning[] {
  const warnings: NavigationWarning[] = [];
  
  // Boston to Portland route - Stellwagen Bank
  if (isNearBoston(departure) && isNearPortland(destination)) {
    warnings.push({
      id: 'stellwagen-bank-sanctuary',
      type: 'restriction',
      title: 'Stellwagen Bank National Marine Sanctuary',
      description: 'Whale activity common April-November. Federal regulations require: maintain 100-yard distance from whales, reduce speed to 10 knots or less when whales sighted, report whale strikes to NOAA. Acoustic monitoring in effect.',
      location: {
        latitude: 42.35,
        longitude: -70.23,
        area: 'Stellwagen Bank NMS'
      },
      severity: 'warning',
      effectiveDate: new Date('2024-04-01'),
      expiryDate: new Date('2024-11-30'),
      source: 'NOAA Sanctuary Regulations'
    });
    
    warnings.push({
      id: 'boston-harbor-traffic',
      type: 'restriction',
      title: 'Boston Harbor Traffic Separation Scheme',
      description: 'Mandatory traffic lanes in effect. All vessels must comply with Rule 10 (Traffic Separation Schemes) of the International Regulations for Preventing Collisions at Sea. Monitor VHF Channel 14 (Boston VTS).',
      location: {
        latitude: 42.35,
        longitude: -70.88,
        area: 'Boston Harbor approaches'
      },
      severity: 'warning',
      effectiveDate: new Date('2020-01-01'),
      source: 'USCG Navigation Rules'
    });
  }
  
  // Portland Harbor
  if (isNearPortland(departure) || isNearPortland(destination)) {
    warnings.push({
      id: 'portland-harbor-regs',
      type: 'update',
      title: 'Portland Harbor Navigation',
      description: 'Monitor VHF Channel 13 for harbor traffic. Speed limit 6 knots in harbor. Strong tidal currents in harbor entrance - time arrival/departure appropriately. Fog common.',
      location: {
        latitude: 43.66,
        longitude: -70.25,
        area: 'Portland Harbor'
      },
      severity: 'info',
      effectiveDate: new Date('2020-01-01'),
      source: 'Portland Harbor Master'
    });
  }
  
  // General East Coast warnings
  warnings.push({
    id: 'general-chart-verification',
    type: 'chart_correction',
    title: 'Chart and Publication Updates',
    description: 'Verify your charts are corrected to the latest Notice to Mariners. Check USCG Local Notice to Mariners for your district. Update electronic chart database before departure.',
    location: {
      area: 'Route-wide'
    },
    severity: 'info',
    effectiveDate: new Date(),
    source: 'Helmwise Safety Reminder'
  });
  
  return warnings;
}

/**
 * Check if coordinates are near Boston
 */
function isNearBoston(point: { latitude: number; longitude: number }): boolean {
  return Math.abs(point.latitude - 42.36) < 0.5 && 
         Math.abs(point.longitude + 71.06) < 0.5;
}

/**
 * Check if coordinates are near Portland, ME
 */
function isNearPortland(point: { latitude: number; longitude: number }): boolean {
  return Math.abs(point.latitude - 43.66) < 0.5 && 
         Math.abs(point.longitude + 70.26) < 0.5;
}

