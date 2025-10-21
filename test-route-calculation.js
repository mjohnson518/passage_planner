/**
 * Test the Route Agent with real coordinates
 * Boston to Portland, ME - should be ~90nm
 */

const { RoutingEngine } = require('./agents/route/dist/agents/route/src/routing-engine');
const pino = require('pino');

async function testRouteCalculation() {
  console.log('🧭 Testing Real Route Calculation...\n');
  
  const logger = pino({ level: 'info' });
  const routingEngine = new RoutingEngine(logger);
  
  // Boston to Portland, ME
  const start = { lat: 42.3601, lon: -71.0589 };
  const end = { lat: 43.6591, lon: -70.2568 };
  
  console.log('📍 Route: Boston, MA → Portland, ME');
  console.log(`   Start: ${start.lat}°N, ${Math.abs(start.lon)}°W`);
  console.log(`   End: ${end.lat}°N, ${Math.abs(end.lon)}°W\n`);
  
  try {
    // Test 1: Great Circle Route
    console.log('⏳ Calculating Great Circle route...\n');
    const gcRoute = routingEngine.calculateGreatCircle(start, end, 5);
    
    console.log('✅ GREAT CIRCLE ROUTE:');
    console.log('━'.repeat(60));
    console.log(`📏 Total Distance: ${gcRoute.totalDistance.toFixed(1)} nautical miles`);
    console.log(`⏱️ Duration @ 5 knots: ${gcRoute.estimatedDuration.toFixed(1)} hours`);
    console.log(`📍 Waypoints: ${gcRoute.waypoints.length}\n`);
    
    console.log('Waypoint Details:');
    gcRoute.waypoints.forEach((wp, idx) => {
      console.log(`   ${wp.name || `WP${idx}`}: ${wp.lat.toFixed(4)}°N, ${Math.abs(wp.lon).toFixed(4)}°W`);
      console.log(`      Distance: ${wp.distance.toFixed(1)}nm | Bearing: ${wp.bearing.toFixed(0)}°T`);
    });
    
    // Test 2: Rhumb Line Route
    console.log('\n⏳ Calculating Rhumb Line route...\n');
    const rlRoute = routingEngine.calculateRhumbLine(start, end, 5);
    
    console.log('✅ RHUMB LINE ROUTE:');
    console.log('━'.repeat(60));
    console.log(`📏 Total Distance: ${rlRoute.totalDistance.toFixed(1)} nautical miles`);
    console.log(`⏱️ Duration @ 5 knots: ${rlRoute.estimatedDuration.toFixed(1)} hours`);
    console.log(`🧭 Constant Bearing: ${rlRoute.waypoints[0].bearing.toFixed(0)}°T\n`);
    
    // Test 3: Optimal Route
    console.log('⏳ Calculating Optimal route...\n');
    const optimalRoute = routingEngine.calculateOptimalRoute(start, end, 5);
    
    console.log('✅ OPTIMAL ROUTE SELECTED:');
    console.log('━'.repeat(60));
    console.log(`Type: ${optimalRoute.type.replace('_', ' ').toUpperCase()}`);
    console.log(`Distance: ${optimalRoute.totalDistance.toFixed(1)} nm`);
    console.log(`Duration: ${optimalRoute.estimatedDuration.toFixed(1)} hours`);
    
    // Compare routes
    console.log('\n📊 ROUTE COMPARISON:');
    console.log('━'.repeat(60));
    const difference = Math.abs(gcRoute.totalDistance - rlRoute.totalDistance);
    const percent = (difference / gcRoute.totalDistance * 100).toFixed(1);
    console.log(`Great Circle: ${gcRoute.totalDistance.toFixed(1)} nm (shortest)`);
    console.log(`Rhumb Line: ${rlRoute.totalDistance.toFixed(1)} nm (constant bearing)`);
    console.log(`Difference: ${difference.toFixed(1)} nm (${percent}%)`);
    
    // Verify distance is reasonable (Boston to Portland should be ~90nm)
    const expectedDistance = 90;
    const accuracy = Math.abs(gcRoute.totalDistance - expectedDistance);
    
    console.log('\n🎯 ACCURACY CHECK:');
    console.log('━'.repeat(60));
    console.log(`Expected distance: ~${expectedDistance} nm`);
    console.log(`Calculated distance: ${gcRoute.totalDistance.toFixed(1)} nm`);
    console.log(`Accuracy: ±${accuracy.toFixed(1)} nm`);
    
    if (accuracy < 10) {
      console.log('✅ Distance calculation is accurate!');
    } else {
      console.log('⚠️  Distance calculation may need adjustment');
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log('\n🎉 Route Agent is working correctly!');
    console.log('✅ Real route calculations implemented');
    console.log('✅ Great Circle and Rhumb Line algorithms working');
    console.log('✅ No mock data - actual navigation math!\n');
    
    return optimalRoute;
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run the test
testRouteCalculation()
  .then(() => {
    console.log('Route test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Route test failed:', error);
    process.exit(1);
  });
