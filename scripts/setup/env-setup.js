#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🚀 Setting up Passage Planner environment...\n');

// Check if .env exists
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');

if (fs.existsSync(envPath)) {
  console.log('✅ .env file already exists');
} else if (fs.existsSync(envExamplePath)) {
  // Copy .env.example to .env
  fs.copyFileSync(envExamplePath, envPath);
  
  // Generate secure keys
  const jwtSecret = crypto.randomBytes(64).toString('hex');
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  
  // Read the file
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Replace placeholder values
  envContent = envContent.replace('your_jwt_secret_key', jwtSecret);
  envContent = envContent.replace('your_encryption_key', encryptionKey);
  
  // Write back
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ Created .env file with generated secrets');
  console.log('⚠️  Please add your API keys to the .env file:');
  console.log('   - NOAA_API_KEY');
  console.log('   - OPENWEATHER_API_KEY');
  console.log('   - WINDFINDER_API_KEY');
} else {
  console.error('❌ No .env.example file found!');
  process.exit(1);
}

// Create necessary directories
const directories = [
  'logs',
  'uploads',
  '.temp',
];

directories.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

console.log('\n✨ Environment setup complete!');
console.log('\nNext steps:');
console.log('1. Edit .env file with your API keys');
console.log('2. Run: docker-compose up -d');
console.log('3. Run: npm run dev');
console.log('\nHappy sailing! ⛵️'); 