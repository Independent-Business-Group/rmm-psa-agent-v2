/**
 * Development Start Script - Runs Agent v2 in development mode
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Ensure required directories exist
const dirs = [
  path.join(__dirname, '..', 'logs'),
  path.join(__dirname, '..', 'temp'),
  path.join(__dirname, '..', 'dist'),
  path.join(__dirname, '..', 'dist', 'helpers')
];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Start agent in development mode
const startPath = path.join(__dirname, '..', 'lib', 'start.js');
const child = spawn('node', [startPath, '--dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('close', (code) => {
  console.log(`Agent exited with code ${code}`);
  process.exit(code);
});

// Handle process signals
process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

console.log('🚀 Starting Agent v2 in development mode...');
console.log('Press Ctrl+C to stop');
