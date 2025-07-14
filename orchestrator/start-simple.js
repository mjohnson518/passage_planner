#!/usr/bin/env node

// Register TypeScript compiler
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true
  }
});

// Start the server
require('./src/simple-server-no-db.ts'); 