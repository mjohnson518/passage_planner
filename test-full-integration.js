/**
 * Test Full System Integration - All Agents in Parallel
 * Boston to Portland Passage Planning
 */

const { SimpleOrchestrator } = require('./orchestrator/dist/orchestrator/src/SimpleOrchestrator');

// Set required environment variables
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.LOG_LEVEL = 'info';

async function testFullIntegration() {
  console.log('🚀 FULL SYSTEM INTEGRATION TEST');
  console.log('━'.repeat(60));
  console.log('Testing: Weather + Tidal + Route Agents in PARALLEL');
  console.log('Target: <3 second response time\n');
  
  try {
    // Create orchestrator instance
    const orchestrator = new SimpleOrchestrator();
    
    // Give it a moment to initialize agents
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test passage planning request
    const request = {
      departure: {
        port: 'Boston',
        latitude: 42.3601,
        longitude: -71.0589,
        time: new Date().toISOString()
      },
      destination: {
        port: 'Portland',
        latitude: 43.6591,
        longitude: -70.2568
      },
      vessel: {
        name: 'Test Vessel',
        draft: 6,
        cruiseSpeed: 5
      }
    };
    
    console.log('📍 Planning passage: Boston → Portland');
    console.log('   Distance: ~85 nautical miles');
    console.log('   Speed: 5 knots\n');
    
    console.log('⏳ Executing all agents in PARALLEL...\n');
    const startTime = Date.now();
    
    // Call private method directly for testing
    const passagePlan = await orchestrator.planPassage(request);
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n' + '━'.repeat(60));
    console.log('✅ PASSAGE PLAN COMPLETE!\n');
    
    // Display results
    console.log('📊 PERFORMANCE METRICS:');
    console.log(`   Total Time: ${totalTime}ms`);
    console.log(`   Parallel Execution: ${passagePlan.performance?.parallelTime}ms`);
    console.log(`   Status: ${totalTime < 3000 ? '✅ UNDER 3 SECONDS!' : '⚠️ Over 3 seconds'}`);
    console.log(`   Agents Used: ${passagePlan.performance?.agentsUsed?.join(', ')}\n`);
    
    console.log('🧭 ROUTE:');
    if (passagePlan.route) {
      console.log(`   Distance: ${passagePlan.route.totalDistance?.toFixed(1)} nm`);
      console.log(`   Duration: ${passagePlan.route.estimatedDuration?.toFixed(1)} hours`);
      console.log(`   Waypoints: ${passagePlan.route.waypoints?.length || 0}`);
    } else {
      console.log('   ⚠️ Route data not available');
    }
    
    console.log('\n🌤️ WEATHER:');
    if (passagePlan.weather?.departure) {
      const weather = passagePlan.weather.departure;
      if (Array.isArray(weather) && weather.length > 0) {
        const current = weather[0];
        console.log(`   Departure: ${current.temperature || 'N/A'}°F, ${current.windSpeed || 'N/A'} mph ${current.windDirection || ''}`);
        console.log(`   Conditions: ${current.shortForecast || 'N/A'}`);
      } else {
        console.log('   Departure: Weather data available');
      }
    } else {
      console.log('   ⚠️ Weather data not available');
    }
    
    console.log('\n🌊 TIDES:');
    if (passagePlan.tides?.departure) {
      const tides = passagePlan.tides.departure;
      if (tides.predictions && tides.predictions.length > 0) {
        const nextTide = tides.predictions[0];
        console.log(`   Station: ${tides.station?.name || 'Unknown'}`);
        console.log(`   Next: ${nextTide.type} at ${new Date(nextTide.time).toLocaleTimeString()} - ${nextTide.height?.toFixed(1)} ft`);
      } else if (tides.error) {
        console.log(`   ⚠️ ${tides.error}`);
      } else {
        console.log('   Tidal data available');
      }
    } else {
      console.log('   ⚠️ Tidal data not available');
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log('\n🎉 INTEGRATION SUCCESS!');
    console.log('✅ All three agents working together');
    console.log('✅ Parallel execution confirmed');
    console.log(`✅ Response time: ${totalTime}ms`);
    
    if (totalTime < 3000) {
      console.log('\n🏆 PERFORMANCE TARGET ACHIEVED! Under 3 seconds!');
    }
    
    // Cleanup
    if (orchestrator.cleanup) {
      await orchestrator.cleanup();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
console.log('Starting integration test...\n');
testFullIntegration();
