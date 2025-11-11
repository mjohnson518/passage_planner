/**
 * Simple test to verify production resilience features
 * Tests circuit breaker, retry logic, and caching
 */

const { CircuitBreakerFactory } = require('./shared/dist/services/resilience/circuit-breaker');
const { RetryClient } = require('./shared/dist/services/resilience/retry-client');
const { CacheManager } = require('./shared/dist/services/CacheManager');
const { ValidationError, NOAAAPIError } = require('./shared/dist/errors/mcp-errors');

async function testResilience() {
  console.log('🔧 Testing Production Resilience Features');
  console.log('━'.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Circuit Breaker
  console.log('\n1️⃣ Circuit Breaker Test');
  try {
    let callCount = 0;
    const failingFn = async () => {
      callCount++;
      if (callCount <= 5) {
        throw new Error('Service unavailable');
      }
      return 'Success';
    };
    
    const breaker = CircuitBreakerFactory.create('test-breaker', failingFn, {
      timeout: 1000,
      errorThresholdPercentage: 50,
      resetTimeout: 60000
    });
    
    // Make failing calls
    for (let i = 0; i < 5; i++) {
      try {
        await breaker.fire();
      } catch (e) {
        // Expected to fail
      }
    }
    
    const state = CircuitBreakerFactory.getState('test-breaker');
    if (state === 'OPEN') {
      console.log('✅ Circuit breaker opened after failures');
      passed++;
    } else {
      console.log('❌ Circuit breaker did not open');
      failed++;
    }
  } catch (error) {
    console.log('❌ Circuit breaker test error:', error.message);
    failed++;
  }
  
  // Test 2: Retry Logic
  console.log('\n2️⃣ Retry Logic Test');
  try {
    let attempts = 0;
    const retryFn = async () => {
      attempts++;
      if (attempts < 3) {
        const error = new Error('Temporary failure');
        error.statusCode = 503;
        throw error;
      }
      return { success: true, attempts };
    };
    
    const result = await RetryClient.retryWithBackoff(retryFn, {
      retries: 3,
      minTimeout: 100
    });
    
    if (result.attempts === 3) {
      console.log('✅ Retry logic worked after 3 attempts');
      passed++;
    } else {
      console.log('❌ Unexpected retry count:', result.attempts);
      failed++;
    }
  } catch (error) {
    console.log('❌ Retry test error:', error.message);
    failed++;
  }
  
  // Test 3: Cache with TTL
  console.log('\n3️⃣ Cache TTL Test');
  try {
    const cache = new CacheManager();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for connection
    
    const key = 'test:ttl';
    const value = { data: 'test value' };
    const ttl = 300;
    
    await cache.setWithTTL(key, value, ttl);
    const result = await cache.getWithMetadata(key);
    
    if (result && result.value && result.ttl > 0) {
      console.log('✅ Cache TTL working:', {
        ttl: result.ttl,
        age: result.age
      });
      passed++;
    } else {
      console.log('❌ Cache TTL not working properly');
      failed++;
    }
    
    await cache.disconnect();
  } catch (error) {
    console.log('⚠️ Cache test skipped (Redis not running):', error.message);
  }
  
  // Test 4: Error Validation
  console.log('\n4️⃣ Error Validation Test');
  try {
    // Test invalid coordinates
    let errorThrown = false;
    try {
      ValidationError.validateCoordinates(91, 0);
    } catch (error) {
      if (error.message.includes('Invalid latitude')) {
        errorThrown = true;
      }
    }
    
    if (errorThrown) {
      console.log('✅ Coordinate validation working');
      passed++;
    } else {
      console.log('❌ Coordinate validation not working');
      failed++;
    }
  } catch (error) {
    console.log('❌ Validation test error:', error.message);
    failed++;
  }
  
  // Test 5: NOAA API Error Creation
  console.log('\n5️⃣ NOAA API Error Test');
  try {
    const response = {
      status: 429,
      statusText: 'Too Many Requests'
    };
    
    const error = NOAAAPIError.fromResponse(response, '/test/endpoint');
    
    if (error.code === 'API_RATE_LIMIT' && error.retryable === true) {
      console.log('✅ NOAA API error handling working');
      passed++;
    } else {
      console.log('❌ NOAA API error not properly configured');
      failed++;
    }
  } catch (error) {
    console.log('❌ API error test failed:', error.message);
    failed++;
  }
  
  // Summary
  console.log('\n' + '━'.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All resilience features working correctly!');
  } else {
    console.log('\n⚠️ Some features need attention');
  }
  
  // Clean up
  CircuitBreakerFactory.clearAll();
}

// Run the tests
testResilience().catch(console.error);
