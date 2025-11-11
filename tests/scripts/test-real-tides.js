/**
 * Test script to verify NOAA Tidal API client works with real data
 * This should return ACTUAL tide predictions for Boston Harbor
 */

const { NOAATidalService, CacheManager } = require('./shared/dist/services/NOAATidalService');
const { CacheManager: CM } = require('./shared/dist/services/CacheManager');
const pino = require('pino');

async function testRealTides() {
  console.log('🌊 Testing Real NOAA Tidal API Client...\n');
  
  const logger = pino({ level: 'info' });
  const cache = new CM(logger);
  const tidalService = new NOAATidalService(cache, logger);
  
  // Boston Harbor coordinates
  const lat = 42.3584;
  const lon = -71.0518;
  
  // Boston Harbor station ID (known station)
  const BOSTON_STATION = '8443970';
  
  console.log(`📍 Location: Boston Harbor (${lat}, ${lon})`);
  console.log(`🏢 Station: ${BOSTON_STATION}\n`);
  
  try {
    // Test 1: Find nearby tidal stations
    console.log('⏳ Finding nearby tidal stations...\n');
    const stations = await tidalService.findNearestStations(lat, lon, 25);
    
    console.log(`✅ Found ${stations.length} tidal stations within 25nm:`);
    stations.slice(0, 3).forEach(station => {
      console.log(`   - ${station.name} (${station.id}) - ${station.distance?.toFixed(1)}nm away`);
    });
    
    // Test 2: Get tidal predictions for Boston Harbor
    console.log('\n⏳ Fetching tidal predictions for next 48 hours...\n');
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setHours(endDate.getHours() + 48);
    
    const tidalData = await tidalService.getTidalPredictions(
      BOSTON_STATION,
      startDate,
      endDate
    );
    
    console.log('✅ Tidal Predictions Retrieved:\n');
    console.log('━'.repeat(60));
    console.log(`📊 Station: ${tidalData.station.name}`);
    console.log(`📍 Position: ${tidalData.station.lat}°N, ${tidalData.station.lon}°W`);
    console.log(`📏 Datum: ${tidalData.datum} (Mean Lower Low Water)`);
    console.log(`📐 Units: ${tidalData.units}`);
    console.log(`🌊 Current Height: ${tidalData.currentHeight?.toFixed(1)} ft\n`);
    
    // Display next high/low tides
    console.log('🌊 NEXT TIDE EVENTS:\n');
    console.log('━'.repeat(60));
    
    tidalData.extremes.slice(0, 6).forEach(extreme => {
      const icon = extreme.type === 'high' ? '📈 HIGH' : '📉 LOW ';
      const time = extreme.time.toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit'
      });
      console.log(`${icon}: ${time} - ${extreme.height.toFixed(1)} ft`);
    });
    
    // Test 3: Calculate tidal windows for safe navigation
    console.log('\n⏳ Calculating safe navigation windows...\n');
    
    const windows = await tidalService.calculateTidalWindows(
      BOSTON_STATION,
      startDate,
      24, // Next 24 hours
      {
        minTideHeight: 5.0, // Need at least 5ft of water
        preferRising: true
      }
    );
    
    console.log(`✅ Found ${windows.length} safe navigation windows:`);
    windows.slice(0, 3).forEach(window => {
      const start = window.start.toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
      const end = window.end.toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
      const duration = ((window.end.getTime() - window.start.getTime()) / 3600000).toFixed(1);
      console.log(`   ${start} - ${end} (${duration} hours)`);
      console.log(`     Height range: ${window.minHeight.toFixed(1)} - ${window.maxHeight.toFixed(1)} ft`);
    });
    
    // Test 4: Get current predictions (if available)
    console.log('\n⏳ Checking for current predictions...\n');
    
    const currents = await tidalService.getCurrentPredictions(
      BOSTON_STATION,
      startDate,
      6 // Next 6 hours
    );
    
    if (currents.length > 0) {
      console.log(`✅ Current predictions available:`);
      currents.slice(0, 3).forEach(current => {
        const time = current.time.toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
        console.log(`   ${time}: ${current.velocity.toFixed(1)} knots @ ${current.direction}°`);
      });
    } else {
      console.log('ℹ️  No current predictions available for this station (tide-only station)');
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log('\n🎉 NOAA Tidal Service is working correctly!');
    console.log('✅ This is REAL tidal data from api.tidesandcurrents.noaa.gov');
    console.log('✅ Critical missing piece now implemented!\n');
    
    return tidalData;
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Run the test
testRealTides()
  .then(() => {
    console.log('Tidal test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Tidal test failed:', error);
    process.exit(1);
  });
