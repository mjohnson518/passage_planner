/**
 * Mock NOAA Tides & Currents API Response Fixtures
 * Based on actual api.tidesandcurrents.noaa.gov response structures
 * Used for testing tidal predictions without external API dependencies
 */

/**
 * NOAA Tidal Station List Response
 * From: api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json
 */
export const MOCK_STATIONS_BOSTON_AREA = {
  stations: [
    {
      id: '8443970',
      name: 'Boston, MA',
      lat: '42.3540',
      lng: '-71.0534',
      tidal: 'true',
      greatlakes: 'false',
      shefcode: 'BOSM3',
      state: 'MA',
      region: 'NE',
      timezone: 'America/New_York',
      timezonecorr: '-5',
      observedst: 'true',
      stormsurge: 'false',
      nearby: 'false',
      forecast: 'true',
      overlays: 'true',
      means: 'true',
      datums: 'true',
      supersededdatums: 'false',
      benchmarks: 'true',
      tidepredoffsets: 'false',
      currents: 'true',
      currentssurvey: 'true',
      currentspredictions: 'true',
      currentstype: 'ebb and flood',
      harmonicConstituents: 'true',
      floodlevels: 'true',
      type: 'H', // Harmonic station
      reference_id: null
    },
    {
      id: '8443992',
      name: 'Deer Island Light, MA',
      lat: '42.3390',
      lng: '-70.9640',
      tidal: 'true',
      state: 'MA',
      timezone: 'America/New_York',
      type: 'S', // Subordinate station
      reference_id: '8443970'
    }
  ]
};

/**
 * NOAA Tidal Predictions Response (High/Low Tides)
 * From: api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW
 */
export const MOCK_TIDAL_PREDICTIONS_BOSTON = {
  predictions: [
    {
      t: '2024-01-20 06:00', // High tide
      v: '9.5',
      type: 'H'
    },
    {
      t: '2024-01-20 12:30', // Low tide
      v: '0.5',
      type: 'L'
    },
    {
      t: '2024-01-20 18:24', // High tide
      v: '9.8',
      type: 'H'
    },
    {
      t: '2024-01-21 00:48', // Low tide
      v: '0.3',
      type: 'L'
    },
    {
      t: '2024-01-21 06:36', // High tide
      v: '9.6',
      type: 'H'
    },
    {
      t: '2024-01-21 13:06', // Low tide
      v: '0.4',
      type: 'L'
    }
  ]
};

/**
 * Spring Tide (large range)
 */
export const MOCK_TIDAL_PREDICTIONS_SPRING = {
  predictions: [
    {
      t: '2024-01-20 06:00',
      v: '12.5', // High
      type: 'H'
    },
    {
      t: '2024-01-20 12:30',
      v: '0.2', // Very low
      type: 'L'
    },
    {
      t: '2024-01-20 18:24',
      v: '12.8', // High
      type: 'H'
    }
  ]
};

/**
 * Neap Tide (small range)
 */
export const MOCK_TIDAL_PREDICTIONS_NEAP = {
  predictions: [
    {
      t: '2024-01-20 06:00',
      v: '7.2', // High
      type: 'H'
    },
    {
      t: '2024-01-20 12:30',
      v: '2.8', // Not very low
      type: 'L'
    },
    {
      t: '2024-01-20 18:24',
      v: '7.5', // High
      type: 'H'
    }
  ]
};

/**
 * NOAA Current Predictions Response
 */
export const MOCK_CURRENT_PREDICTIONS_BOSTON = {
  current_predictions: [
    {
      t: '2024-01-20 06:00',
      v: '2.3', // Velocity in knots
      d: '045', // Direction in degrees
      Type: 'flood'
    },
    {
      t: '2024-01-20 09:00',
      v: '0.1', // Slack water
      d: '000',
      Type: 'slack'
    },
    {
      t: '2024-01-20 12:00',
      v: '2.8', // Ebb current
      d: '225',
      Type: 'ebb'
    },
    {
      t: '2024-01-20 15:00',
      v: '0.2', // Slack
      d: '000',
      Type: 'slack'
    },
    {
      t: '2024-01-20 18:00',
      v: '2.5', // Flood again
      d: '045',
      Type: 'flood'
    }
  ]
};

/**
 * Dangerous Current Conditions (>3 knots)
 */
export const MOCK_CURRENT_PREDICTIONS_DANGEROUS = {
  current_predictions: [
    {
      t: '2024-01-20 12:00',
      v: '4.5', // DANGEROUS - >3 knots
      d: '180',
      Type: 'ebb'
    },
    {
      t: '2024-01-20 15:00',
      v: '5.2', // VERY DANGEROUS - >5 knots
      d: '180',
      Type: 'ebb'
    }
  ]
};

/**
 * NOAA Error Responses for Tidal API
 */
export const MOCK_TIDAL_ERROR_INVALID_STATION = {
  error: {
    message: 'No data was found. This product may not be offered at this station.'
  }
};

export const MOCK_TIDAL_ERROR_INVALID_DATE = {
  error: {
    message: 'The begin_date or end_date value is invalid or out of range.'
  }
};

/**
 * Tidal Station Information Response
 */
export const MOCK_STATION_INFO_BOSTON = {
  stations: [
    {
      id: '8443970',
      name: 'Boston, MA',
      lat: 42.354,
      lng: -71.0534,
      affiliations: 'NWLON,PORTS',
      portscode: null,
      products: {
        water_level: true,
        predictions: true,
        currents: true,
        air_gap: false,
        wind: true,
        air_temperature: true,
        water_temperature: true
      },
      disclaimers: {
        processing: 'This station is maintained by NOAA',
        elevation: 'Elevations are referenced to Mean Lower Low Water (MLLW)'
      },
      datums: {
        MLLW: 0.0,
        MLW: 0.54,
        MTL: 4.78,
        MHW: 9.02,
        MHHW: 9.56,
        NAVD88: 4.35
      },
      tidal_constituents: {
        M2: { amplitude: 4.123, phase: 348.5 },
        S2: { amplitude: 1.234, phase: 12.3 },
        N2: { amplitude: 0.891, phase: 325.7 },
        K1: { amplitude: 0.456, phase: 156.2 },
        O1: { amplitude: 0.378, phase: 142.8 }
      }
    }
  ]
};

/**
 * Helper Functions
 */

/**
 * Create mock tidal prediction for specific time
 */
export function createMockTidalPrediction(time: Date, height: number, type: 'H' | 'L') {
  return {
    t: time.toISOString().slice(0, 16).replace('T', ' '),
    v: height.toString(),
    type
  };
}

/**
 * Create mock current prediction
 */
export function createMockCurrentPrediction(time: Date, velocity: number, direction: number, type: string) {
  return {
    t: time.toISOString().slice(0, 16).replace('T', ' '),
    v: velocity.toString(),
    d: direction.toString().padStart(3, '0'),
    Type: type
  };
}

/**
 * Generate daily tidal cycle (2 highs, 2 lows)
 */
export function generateDailyTidalCycle(startDate: Date, highTide: number, lowTide: number) {
  const predictions: any[] = [];
  const baseTime = startDate.getTime();
  
  // High tide at 6:00
  predictions.push(createMockTidalPrediction(
    new Date(baseTime),
    highTide,
    'H'
  ));
  
  // Low tide at 12:30 (6.5 hours later)
  predictions.push(createMockTidalPrediction(
    new Date(baseTime + 6.5 * 60 * 60 * 1000),
    lowTide,
    'L'
  ));
  
  // High tide at 18:24 (12.4 hours later)
  predictions.push(createMockTidalPrediction(
    new Date(baseTime + 12.4 * 60 * 60 * 1000),
    highTide,
    'H'
  ));
  
  // Low tide at 00:48 next day (18.8 hours later)
  predictions.push(createMockTidalPrediction(
    new Date(baseTime + 18.8 * 60 * 60 * 1000),
    lowTide,
    'L'
  ));
  
  return { predictions };
}

