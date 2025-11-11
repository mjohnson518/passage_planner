// Simple test script for the API
const axios = require('axios');

const API_URL = 'http://localhost:8080';

async function testAPI() {
  console.log('Testing Passage Planner API...\n');
  
  // 1. Test health endpoint
  try {
    const health = await axios.get(`${API_URL}/health`);
    console.log('✅ Health check:', health.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
  
  // 2. Test signup
  try {
    const signup = await axios.post(`${API_URL}/api/auth/signup`, {
      email: `test${Date.now()}@example.com`,
      password: 'Test123!@#'
    });
    console.log('✅ Signup successful:', signup.data.user.email);
    
    const token = signup.data.token;
    
    // 3. Test authenticated request
    const subscription = await axios.get(`${API_URL}/api/subscription/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Subscription status:', subscription.data);
    
  } catch (error) {
    console.log('❌ Signup/Auth test failed:', error.response?.data || error.message);
  }
}

testAPI(); 