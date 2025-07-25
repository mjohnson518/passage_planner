import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const passagePlanningSuccess = new Rate('passage_planning_success');
const apiCallSuccess = new Rate('api_call_success');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 100 },  // Ramp up to 100 users
    { duration: '10m', target: 200 }, // Stay at 200 users
    { duration: '5m', target: 300 },  // Peak load at 300 users
    { duration: '10m', target: 300 }, // Maintain peak load
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests should be below 3s
    http_req_failed: ['rate<0.1'],     // Error rate should be below 10%
    errors: ['rate<0.1'],              // Custom error rate below 10%
    passage_planning_success: ['rate>0.9'], // 90% success rate for planning
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'https://api.passageplanner.ai';
const API_KEY = __ENV.API_KEY;

const DEPARTURE_PORTS = [
  'Boston, MA', 'Portland, ME', 'Newport, RI', 'Annapolis, MD',
  'Charleston, SC', 'Miami, FL', 'San Francisco, CA', 'Seattle, WA'
];

const DESTINATION_PORTS = [
  'Bar Harbor, ME', 'Martha\'s Vineyard, MA', 'Block Island, RI',
  'Norfolk, VA', 'Savannah, GA', 'Key West, FL', 'Monterey, CA', 'Victoria, BC'
];

// Helper functions
function getRandomPort(ports) {
  return ports[randomIntBetween(0, ports.length - 1)];
}

function generatePassageQuery() {
  const departure = getRandomPort(DEPARTURE_PORTS);
  const destination = getRandomPort(DESTINATION_PORTS);
  const days = randomIntBetween(1, 7);
  
  return {
    query: `Plan a passage from ${departure} to ${destination} leaving in ${days} days`,
    preferences: {
      avoidNightSailing: Math.random() > 0.5,
      maxWindSpeed: randomIntBetween(15, 30),
      maxWaveHeight: randomIntBetween(4, 10)
    }
  };
}

// Main test scenario
export default function() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  // Scenario 1: User login (20% of virtual users)
  if (Math.random() < 0.2) {
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: `user${__VU}@example.com`,
      password: 'TestPassword123!'
    }), { headers: { 'Content-Type': 'application/json' } });

    check(loginRes, {
      'login successful': (r) => r.status === 200,
      'auth token returned': (r) => r.json('token') !== undefined,
    });
    
    errorRate.add(loginRes.status !== 200);
    
    if (loginRes.status === 200) {
      headers['Authorization'] = `Bearer ${loginRes.json('token')}`;
    }
  }

  sleep(randomIntBetween(1, 3));

  // Scenario 2: Plan a passage (60% of virtual users)
  if (Math.random() < 0.6) {
    const passageData = generatePassageQuery();
    
    const planRes = http.post(
      `${BASE_URL}/api/passages/plan`,
      JSON.stringify(passageData),
      { headers, timeout: '30s' }
    );

    const success = check(planRes, {
      'passage planning successful': (r) => r.status === 200,
      'route returned': (r) => r.json('route') !== undefined,
      'weather returned': (r) => r.json('weather') !== undefined,
      'response time < 5s': (r) => r.timings.duration < 5000,
    });
    
    passagePlanningSuccess.add(success);
    errorRate.add(planRes.status !== 200);
    
    // If planning successful, export the passage
    if (planRes.status === 200 && Math.random() < 0.3) {
      const passageId = planRes.json('id');
      sleep(randomIntBetween(2, 5));
      
      const exportRes = http.get(
        `${BASE_URL}/api/passages/${passageId}/export?format=gpx`,
        { headers, responseType: 'binary' }
      );
      
      check(exportRes, {
        'export successful': (r) => r.status === 200,
        'file size > 0': (r) => r.body.length > 0,
      });
    }
  }

  sleep(randomIntBetween(2, 5));

  // Scenario 3: Get user passages (40% of virtual users)
  if (Math.random() < 0.4) {
    const passagesRes = http.get(
      `${BASE_URL}/api/passages?limit=10`,
      { headers }
    );

    check(passagesRes, {
      'get passages successful': (r) => r.status === 200,
      'passages array returned': (r) => Array.isArray(r.json('passages')),
    });
    
    apiCallSuccess.add(passagesRes.status === 200);
  }

  sleep(randomIntBetween(1, 3));

  // Scenario 4: Weather API calls (30% of virtual users)
  if (Math.random() < 0.3) {
    const lat = 42.3601 + (Math.random() - 0.5) * 10;
    const lon = -71.0589 + (Math.random() - 0.5) * 10;
    
    const weatherRes = http.get(
      `${BASE_URL}/api/weather/forecast?lat=${lat}&lon=${lon}&days=3`,
      { headers }
    );

    check(weatherRes, {
      'weather API successful': (r) => r.status === 200,
      'forecasts returned': (r) => r.json('forecasts') !== undefined,
    });
    
    apiCallSuccess.add(weatherRes.status === 200);
  }

  sleep(randomIntBetween(3, 8));
}

// Spike test scenario
export function spikeTest() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  // Simulate sudden spike in passage planning
  for (let i = 0; i < 10; i++) {
    const passageData = generatePassageQuery();
    
    http.post(
      `${BASE_URL}/api/passages/plan`,
      JSON.stringify(passageData),
      { headers, timeout: '30s' }
    );
  }
}

// Stress test scenario
export function stressTest() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  // Complex multi-waypoint passage
  const complexQuery = {
    query: 'Plan a passage from Boston to Miami with stops in New York, Philadelphia, Norfolk, Charleston, and Savannah',
    preferences: {
      avoidNightSailing: true,
      maxWindSpeed: 20,
      maxWaveHeight: 6,
      preferredDepartureTime: '09:00',
      fuelStops: true
    }
  };

  const res = http.post(
    `${BASE_URL}/api/passages/plan`,
    JSON.stringify(complexQuery),
    { headers, timeout: '60s' }
  );

  check(res, {
    'complex passage successful': (r) => r.status === 200,
    'all waypoints included': (r) => r.json('route.waypoints').length >= 7,
  });
}

// Fleet management load test (Pro tier features)
export function fleetLoadTest() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`, // Assumes Pro tier API key
  };

  // Get fleet info
  const fleetRes = http.get(`${BASE_URL}/api/fleet`, { headers });
  
  if (fleetRes.status === 200) {
    const fleetId = fleetRes.json('id');
    
    // Get fleet vessels
    http.get(`${BASE_URL}/api/fleet/${fleetId}/vessels`, { headers });
    
    // Get fleet members
    http.get(`${BASE_URL}/api/fleet/${fleetId}/members`, { headers });
    
    // Get fleet analytics
    http.get(`${BASE_URL}/api/fleet/${fleetId}/analytics`, { headers });
  }
} 