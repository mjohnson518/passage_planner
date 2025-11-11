/**
 * Safety Service - Maritime Safety Analysis
 * SAFETY-CRITICAL: Provides comprehensive safety analysis for passage planning
 * 
 * Implements maritime safety logic based on Safety Agent algorithms
 * Provides go/no-go decisions, risk assessment, and safety recommendations
 * 
 * FAIL-SAFE PRINCIPLE: Conservative recommendations, clear warnings, never silent failures
 */

export interface SafetyAnalysis {
  safetyScore: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  goNoGo: 'GO' | 'CAUTION' | 'NO-GO';
  overallRisk: 'low' | 'moderate' | 'high' | 'critical';
  riskFactors: string[];
  safetyWarnings: string[];
  recommendations: string[];
  hazards: any[];
  emergencyContacts?: any;
  watchSchedule?: any;
  timestamp: string;
  source: string;
}

/**
 * Analyze safety for a passage route
 * 
 * @param route Array of waypoints
 * @param weatherData Weather conditions
 * @param tidalData Tidal information
 * @param vesselDraft Vessel draft in feet
 * @param crewExperience Crew experience level
 * @param crewSize Number of crew members
 * @returns Comprehensive safety analysis
 */
export async function analyzeSafety(
  route: Array<{ latitude: number; longitude: number; name?: string }>,
  weatherData: { departure: any; destination: any },
  tidalData: { departure: any; destination: any },
  vesselDraft?: number,
  crewExperience?: 'novice' | 'intermediate' | 'advanced' | 'professional',
  crewSize?: number
): Promise<SafetyAnalysis> {
  try {
    console.log('Performing comprehensive safety analysis...');
    
    // Analyze weather hazards and compile risk factors
    const riskFactors: string[] = [];
    const safetyWarnings: string[] = [];
    const hazards: any[] = [];

    // Weather-based risk factors
    const maxWindSpeed = Math.max(
      weatherData.departure.windSpeed,
      weatherData.destination.windSpeed
    );

    if (maxWindSpeed > 30) {
      riskFactors.push('Gale force winds (>30 mph)');
      safetyWarnings.push('⚠️ CRITICAL: Winds exceed safe limits for small craft');
    } else if (maxWindSpeed > 25) {
      riskFactors.push('Strong winds (25-30 mph)');
      safetyWarnings.push('Strong winds - experienced crew recommended');
    } else if (maxWindSpeed > 20) {
      riskFactors.push('Moderate winds (20-25 mph)');
    }

    // Wave height risk factors
    const maxWaveHeight = Math.max(
      weatherData.departure.waveHeight,
      weatherData.destination.waveHeight
    );

    if (maxWaveHeight > 8) {
      riskFactors.push('Heavy seas (>8 ft)');
      safetyWarnings.push('⚠️ CRITICAL: Heavy seas - not recommended for small vessels');
    } else if (maxWaveHeight > 6) {
      riskFactors.push('Rough seas (6-8 ft)');
      safetyWarnings.push('Rough seas expected - prepare for challenging conditions');
    } else if (maxWaveHeight > 4) {
      riskFactors.push('Moderate seas (4-6 ft)');
    }

    // Weather warnings
    if (weatherData.departure.warnings.length > 0) {
      riskFactors.push(`Active weather warnings at departure`);
      weatherData.departure.warnings.forEach((w: string) => {
        safetyWarnings.push(`Departure: ${w}`);
      });
    }

    if (weatherData.destination.warnings.length > 0) {
      riskFactors.push(`Active weather warnings at destination`);
      weatherData.destination.warnings.forEach((w: string) => {
        safetyWarnings.push(`Destination: ${w}`);
      });
    }

    // Crew experience risk factors
    if (crewExperience === 'novice') {
      riskFactors.push('Novice crew - increased safety margins required');
      safetyWarnings.push('NOVICE CREW: Consider experienced supervision or delay until more experience gained');
    } else if (crewExperience === 'intermediate' && (maxWindSpeed > 20 || maxWaveHeight > 4)) {
      riskFactors.push('Intermediate crew with challenging conditions');
      safetyWarnings.push('Challenging conditions for intermediate crew - ensure experienced backup available');
    }

    // Tidal risk factors
    if (tidalData.departure.warning) {
      riskFactors.push('Tidal data unavailable at departure');
      safetyWarnings.push(tidalData.departure.warning);
    }

    if (tidalData.destination.warning) {
      riskFactors.push('Tidal data unavailable at destination');
      safetyWarnings.push(tidalData.destination.warning);
    }

    // Determine overall risk level
    let overallRisk: SafetyAnalysis['overallRisk'] = 'low';
    let goNoGo: SafetyAnalysis['goNoGo'] = 'GO';

    if (maxWindSpeed > 30 || maxWaveHeight > 8) {
      overallRisk = 'critical';
      goNoGo = 'NO-GO';
    } else if (maxWindSpeed > 25 || maxWaveHeight > 6) {
      overallRisk = 'high';
      goNoGo = 'CAUTION';
    } else if (maxWindSpeed > 20 || maxWaveHeight > 4 || riskFactors.length > 3) {
      overallRisk = 'moderate';
      goNoGo = 'CAUTION';
    }

    // Check for depth/grounding hazards if vessel draft provided
    if (vesselDraft && vesselDraft > 0) {
      // Simplified depth check - real implementation would query depth database
      // Conservative assumption: shallow areas exist, apply 20% safety margin
      const requiredClearance = vesselDraft * 1.2; // 20% safety margin
      
      if (crewExperience === 'novice') {
        // Novice crew gets 30% safety margin
        const noviceClearance = vesselDraft * 1.3;
        riskFactors.push(`Novice crew requires ${noviceClearance.toFixed(1)}ft clearance (30% margin)`);
      }
      
      riskFactors.push(`Vessel draft ${vesselDraft}ft requires ${requiredClearance.toFixed(1)}ft minimum depth`);
    }

    // Adjust for novice crew - always CAUTION or NO-GO
    if (crewExperience === 'novice') {
      if (goNoGo === 'GO') {
        goNoGo = 'CAUTION';
      }
      if (overallRisk === 'low') {
        overallRisk = 'moderate';
      }
    }

    // Calculate safety score based on conditions
    let safetyScore: SafetyAnalysis['safetyScore'] = 'Excellent';
    
    if (overallRisk === 'critical' || goNoGo === 'NO-GO') {
      safetyScore = 'Poor';
    } else if (overallRisk === 'high' || riskFactors.length >= 4) {
      safetyScore = 'Fair';
    } else if (overallRisk === 'moderate' || riskFactors.length >= 2) {
      safetyScore = crewExperience === 'novice' ? 'Fair' : 'Good';
    }

    // Compile recommendations
    const recommendations: string[] = [];

    if (goNoGo === 'NO-GO') {
      recommendations.push('🛑 DO NOT PROCEED - Conditions exceed safe limits for this passage');
      recommendations.push('Monitor weather for improvement or consider alternative route/timing');
      recommendations.push('Contact Coast Guard or harbor master for current conditions');
    } else if (goNoGo === 'CAUTION') {
      recommendations.push('⚠️ PROCEED WITH CAUTION - Verify all safety equipment and crew preparedness');
      recommendations.push('Have contingency plan and alternate ports identified');
      recommendations.push('Monitor weather continuously and be prepared to abort if conditions worsen');
    } else {
      recommendations.push('✅ Conditions within acceptable limits for experienced crew');
      recommendations.push('Monitor weather forecasts for any changes');
    }

    // Crew-specific recommendations
    if (crewExperience === 'novice') {
      recommendations.push('NOVICE CREW: Ensure experienced crew available or consider delaying passage');
      recommendations.push('NOVICE CREW: Practice MOB drills before departure');
      recommendations.push('NOVICE CREW: Avoid night passages and heavy weather');
    } else if (crewExperience === 'intermediate') {
      recommendations.push('Have experienced crew available for consultation via radio');
      recommendations.push('Review emergency procedures before departure');
    }

    // Watch schedule recommendations
    if (crewSize && crewSize >= 2) {
      const watchType = crewSize === 2 ? 'two-person watch rotation (4 hours on, 4 off)' 
                                       : 'three-watch rotation (4 hours on, 8 off)';
      recommendations.push(`Establish ${watchType} for adequate crew rest`);
    } else if (crewSize === 1) {
      recommendations.push('Single-handed: Set timer alarms every 20 minutes, heave-to for rest when needed');
      safetyWarnings.push('Single-handed sailing increases risk - ensure adequate rest and safety equipment');
    }

    // General safety recommendations
    recommendations.push('File float plan with harbor master or trusted shore contact before departure');
    recommendations.push('Test all safety equipment: VHF radio, EPIRB, flares, life jackets');
    recommendations.push('Brief all crew on emergency procedures and equipment locations');
    recommendations.push('Monitor VHF Channel 16 continuously while underway');
    recommendations.push('Check weather updates every 4-6 hours during passage');

    // Emergency contacts
    const emergencyContacts = generateEmergencyContacts(route[0].latitude, route[0].longitude);

    // Watch schedule
    const watchSchedule = generateWatchSchedule(crewSize || 2);

    return {
      safetyScore,
      goNoGo,
      overallRisk,
      riskFactors,
      safetyWarnings: safetyWarnings.length > 0 ? safetyWarnings : ['No critical safety warnings'],
      recommendations,
      hazards,
      emergencyContacts,
      watchSchedule,
      timestamp: new Date().toISOString(),
      source: 'Helmwise Safety Analysis v1.0'
    };

  } catch (error: any) {
    console.error('Safety analysis failed:', error.message);
    
    // FAIL-SAFE: Return conservative analysis if agent fails
    return {
      safetyScore: 'Fair',
      goNoGo: 'CAUTION',
      overallRisk: 'moderate',
      riskFactors: ['Safety analysis system unavailable'],
      safetyWarnings: [
        '⚠️ CRITICAL: Safety analysis system temporarily unavailable',
        'DO NOT PROCEED without manual safety review',
        'Verify weather, tidal, and chart data from official sources',
        'Ensure all safety equipment is functional',
        'Contact Coast Guard or harbor master for current conditions'
      ],
      recommendations: [
        'Manual safety review required before departure',
        'Verify all data from official sources (NOAA, Coast Guard, local knowledge)',
        'Ensure experienced crew or supervision available',
        'Have contingency plan and abort criteria defined',
        'File float plan with detailed route and timing'
      ],
      hazards: [],
      timestamp: new Date().toISOString(),
      source: 'Helmwise Safety System (Fail-Safe Mode)'
    };
  }
}

/**
 * Calculate total route distance (simple approximation)
 */
function calculateRouteDistance(route: Array<{ latitude: number; longitude: number }>): number {
  if (route.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 0; i < route.length - 1; i++) {
    totalDistance += haversineDistance(route[i], route[i + 1]);
  }
  
  return Math.round(totalDistance * 10) / 10;
}

/**
 * Haversine distance calculation
 */
function haversineDistance(
  p1: { latitude: number; longitude: number },
  p2: { latitude: number; longitude: number }
): number {
  const R = 3440.1; // Earth radius in nautical miles
  const lat1 = p1.latitude * Math.PI / 180;
  const lat2 = p2.latitude * Math.PI / 180;
  const deltaLat = (p2.latitude - p1.latitude) * Math.PI / 180;
  const deltaLon = (p2.longitude - p1.longitude) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Generate emergency contacts for a location
 */
function generateEmergencyContacts(lat: number, lon: number): any {
  return {
    location: { latitude: lat, longitude: lon },
    emergency: {
      coastGuard: {
        name: 'US Coast Guard',
        vhf: 'Channel 16 (156.8 MHz)',
        phone: '+1-800-368-5647',
        mmsi: '003669999'
      },
      rescue: {
        name: 'Search and Rescue',
        phone: '911 (US) or 112 (International)',
        vhf: 'Channel 16'
      }
    },
    towing: [
      {
        name: 'SeaTow',
        phone: '+1-800-473-2869',
        vhf: 'Channel 16'
      },
      {
        name: 'BoatUS',
        phone: '+1-800-391-4869',
        vhf: 'Channel 16'
      }
    ],
    weather: {
      vhf: ['WX1: 162.550 MHz', 'WX2: 162.400 MHz'],
      phone: '+1-800-472-0039'
    }
  };
}

/**
 * Generate watch schedule based on crew size
 */
function generateWatchSchedule(crewSize: number): any {
  if (crewSize === 1) {
    return {
      type: 'single-handed',
      schedule: 'Set alarms every 20 minutes',
      notes: 'Heave-to for rest when needed, use autopilot with alarm'
    };
  } else if (crewSize === 2) {
    return {
      type: 'two-watch',
      schedule: [
        '0000-0400: Crew A',
        '0400-0800: Crew B',
        '0800-1200: Crew A',
        '1200-1600: Crew B',
        '1600-2000: Crew A',
        '2000-0000: Crew B'
      ],
      notes: '4 hours on, 4 hours off'
    };
  } else {
    return {
      type: 'three-watch',
      schedule: [
        '0000-0400: Watch 1',
        '0400-0800: Watch 2',
        '0800-1200: Watch 3',
        '1200-1600: Watch 1',
        '1600-2000: Watch 2',
        '2000-0000: Watch 3'
      ],
      notes: '4 hours on, 8 hours off'
    };
  }
}

