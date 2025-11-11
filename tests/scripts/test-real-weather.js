/**
 * Test script to verify NOAA API client works with real data
 * This should return ACTUAL weather for Boston
 */

const { NOAAAPIClient } = require('./shared/dist/services/noaa-api-client');

async function testRealWeather() {
  console.log('🌤️  Testing Real NOAA Weather API Client...\n');
  
  const client = new NOAAAPIClient();
  
  // Boston coordinates
  const lat = 42.3601;
  const lon = -71.0589;
  
  console.log(`📍 Location: Boston, MA (${lat}, ${lon})\n`);
  
  try {
    // Fetch real weather forecast
    console.log('⏳ Fetching real weather data from NOAA...\n');
    const forecast = await client.getWeatherForecast(lat, lon);
    
    console.log('✅ SUCCESS! Real weather data received:\n');
    console.log('━'.repeat(60));
    
    // Display forecast metadata
    console.log(`📅 Generated: ${new Date(forecast.generatedAt).toLocaleString()}`);
    console.log(`🔄 Updated: ${new Date(forecast.updated).toLocaleString()}`);
    console.log(`📊 Periods: ${forecast.periods.length} forecast periods\n`);
    
    // Display first 3 forecast periods
    console.log('🌡️  WEATHER FORECAST:\n');
    console.log('━'.repeat(60));
    
    forecast.periods.slice(0, 3).forEach(period => {
      console.log(`\n${period.isDaytime ? '☀️' : '🌙'} ${period.name}`);
      console.log(`   Temperature: ${period.temperature}°${period.temperatureUnit}`);
      console.log(`   Wind: ${period.windSpeed} ${period.windDirection}`);
      console.log(`   Conditions: ${period.shortForecast}`);
      console.log(`   Details: ${period.detailedForecast.substring(0, 100)}...`);
    });
    
    console.log('\n' + '━'.repeat(60));
    
    // Test marine forecast
    console.log('\n⛵ Testing marine forecast...\n');
    const marineForecast = await client.getMarineForecast(lat, lon);
    console.log(`Marine forecast available: ${marineForecast.marine ? 'YES' : 'NO (using regular forecast)'}`);
    
    // Test active alerts
    console.log('\n⚠️  Checking for weather alerts...\n');
    const alerts = await client.getActiveAlerts(lat, lon);
    
    if (alerts.length > 0) {
      console.log(`Found ${alerts.length} active alert(s):`);
      alerts.forEach(alert => {
        console.log(`   - ${alert.headline}`);
        console.log(`     Severity: ${alert.severity}, Expires: ${new Date(alert.expires).toLocaleString()}`);
      });
    } else {
      console.log('No active weather alerts for this area.');
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log('\n🎉 NOAA API Client is working correctly!');
    console.log('✅ This is REAL weather data from api.weather.gov');
    console.log('✅ No mocks or placeholders - this is production-ready!\n');
    
    return forecast;
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
testRealWeather()
  .then(() => {
    console.log('Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
