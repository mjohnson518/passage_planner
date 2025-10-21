/**
 * Simple test of NOAA Tides API directly
 * Testing Boston Harbor station 8443970
 */

const axios = require('axios');

async function testTidesDirectly() {
  console.log('🌊 Testing NOAA Tides API Directly...\n');
  
  const BOSTON_STATION = '8443970';
  const TIDES_API = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
  
  // Format dates
  const now = new Date();
  const beginDate = now.toISOString().slice(0,10).replace(/-/g, '');
  
  console.log(`📍 Station: Boston Harbor (${BOSTON_STATION})`);
  console.log(`📅 Date: ${beginDate}\n`);
  
  try {
    // Test 1: Get high/low tides
    console.log('⏳ Fetching high/low tides for next 48 hours...\n');
    
    const params = {
      product: 'predictions',
      station: BOSTON_STATION,
      datum: 'MLLW',
      units: 'english',
      time_zone: 'lst_ldt', // Local time
      format: 'json',
      begin_date: beginDate,
      range: 48,
      interval: 'hilo' // High/Low only
    };
    
    const response = await axios.get(TIDES_API, { params });
    
    if (response.data.error) {
      throw new Error(response.data.error.message);
    }
    
    const predictions = response.data.predictions;
    
    console.log('✅ SUCCESS! Real tide data received:\n');
    console.log('━'.repeat(60));
    console.log(`📊 Total predictions: ${predictions.length}`);
    console.log('\n🌊 NEXT TIDE EVENTS (Boston Harbor):\n');
    console.log('━'.repeat(60));
    
    predictions.slice(0, 8).forEach(pred => {
      const type = pred.type === 'H' ? '📈 HIGH' : '📉 LOW ';
      const time = new Date(pred.t).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      const height = parseFloat(pred.v).toFixed(1);
      console.log(`${type}: ${time} - ${height} ft`);
    });
    
    // Test 2: Get hourly predictions for next 24 hours
    console.log('\n⏳ Fetching hourly tide heights...\n');
    
    const hourlyParams = {
      product: 'predictions',
      station: BOSTON_STATION,
      datum: 'MLLW',
      units: 'english',
      time_zone: 'gmt',
      format: 'json',
      begin_date: beginDate,
      range: 24,
      interval: 'h' // Hourly
    };
    
    const hourlyResponse = await axios.get(TIDES_API, { params: hourlyParams });
    const hourlyPredictions = hourlyResponse.data.predictions;
    
    console.log(`✅ Hourly predictions: ${hourlyPredictions.length} data points`);
    console.log('\nSample hourly heights:');
    hourlyPredictions.slice(0, 6).forEach(pred => {
      const time = new Date(pred.t + 'Z').toLocaleTimeString('en-US');
      const height = parseFloat(pred.v).toFixed(1);
      console.log(`   ${time}: ${height} ft`);
    });
    
    // Test 3: Check for current predictions (may not be available)
    console.log('\n⏳ Checking for current predictions...\n');
    
    const currentParams = {
      product: 'currents_predictions',
      station: BOSTON_STATION,
      units: 'english',
      time_zone: 'gmt',
      format: 'json',
      begin_date: beginDate,
      range: 6,
      interval: '6'
    };
    
    try {
      const currentResponse = await axios.get(TIDES_API, { params: currentParams });
      if (currentResponse.data.current_predictions) {
        console.log('✅ Current predictions available');
      }
    } catch (err) {
      console.log('ℹ️  No current predictions (tide-only station)');
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log('\n🎉 NOAA Tides API is working!');
    console.log('✅ Real tide predictions retrieved successfully');
    console.log('✅ Boston Harbor tides are now available');
    console.log('✅ Critical missing piece confirmed working!\n');
    
    return predictions;
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    throw error;
  }
}

// Run the test
testTidesDirectly()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
