// Minimal test server for Passage Planner
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://admin:secure_password@localhost:5432/passage_planner'
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'healthy', 
      timestamp: result.rows[0].now,
      database: 'connected' 
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Signup endpoint
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create user
    const userResult = await pool.query(
      'INSERT INTO users (email) VALUES ($1) RETURNING id, email, created_at',
      [email]
    );
    const user = userResult.rows[0];
    
    // Create free subscription
    await pool.query(
      `INSERT INTO subscriptions (user_id, tier, status) VALUES ($1, 'free', 'active')`,
      [user.id]
    );
    
    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ user, token });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Get subscription status
app.get('/api/subscription/status', async (req, res) => {
  try {
    // Simple auth check
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get subscription
    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [decoded.id]
    );
    
    res.json(result.rows[0] || { tier: 'free', status: 'active' });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// List tables (for debugging)
app.get('/api/debug/tables', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  POST /api/auth/signup');
  console.log('  GET  /api/subscription/status');
  console.log('  GET  /api/debug/tables');
}); 