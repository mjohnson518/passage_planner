const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'passage_planner',
  user: 'admin',
  password: 'secure_password'
});

async function testConnection() {
  try {
    console.log('Attempting to connect to PostgreSQL...');
    const result = await pool.query('SELECT NOW()');
    console.log('Success! Current time from DB:', result.rows[0].now);
    await pool.end();
  } catch (error) {
    console.error('Connection failed:', error.message);
    console.error('Error code:', error.code);
    await pool.end();
  }
}

testConnection(); 