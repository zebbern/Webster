#!/usr/bin/env node

import { execSync } from 'child_process';

try {
  console.log('Building with custom Node.js script...');
  
  // Try using node to run vite directly
  execSync('node ./node_modules/vite/bin/vite.js build', {
    stdio: 'inherit',
    env: process.env
  });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}