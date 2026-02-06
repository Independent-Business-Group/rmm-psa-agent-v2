/**
 * Build Helpers Script - Compiles helper applications for target platforms
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const platform = process.argv[2] || 'win32';
const helpersDir = path.join(__dirname, '..', 'helpers');
const distDir = path.join(__dirname, '..', 'dist', 'helpers');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Helper files to build
const helpers = [
  'rdp-helper-v2.js',
  'system-helper.js',
  'update-helper.js'
];

console.log(`Building helpers for platform: ${platform}`);

for (const helper of helpers) {
  const inputPath = path.join(helpersDir, helper);
  const outputName = helper.replace('.js', platform === 'win32' ? '.exe' : '');
  const outputPath = path.join(distDir, outputName);
  
  if (!fs.existsSync(inputPath)) {
    console.log(`⚠️  Helper not found: ${helper}`);
    continue;
  }
  
  try {
    console.log(`Building ${helper}...`);
    
    let target;
    switch (platform) {
      case 'win32':
        target = 'node18-win-x64';
        break;
      case 'linux':
        target = 'node18-linux-x64';
        break;
      case 'darwin':
        target = 'node18-macos-x64';
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
    
    const command = `npx pkg ${inputPath} --target ${target} --output ${outputPath}`;
    execSync(command, { stdio: 'inherit' });
    
    console.log(`✅ Built: ${outputName}`);
  } catch (error) {
    console.error(`❌ Failed to build ${helper}:`, error.message);
  }
}

console.log('Helper build process completed');
