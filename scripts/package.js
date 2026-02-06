/**
 * Package Script - Creates distribution packages for Agent v2
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

const platforms = ['win32', 'linux', 'darwin'];
const version = require('../package.json').version;
const distDir = path.join(__dirname, '..', 'dist');
const packageDir = path.join(distDir, 'packages');

// Ensure directories exist
if (!fs.existsSync(packageDir)) {
  fs.mkdirSync(packageDir, { recursive: true });
}

async function createPackage(platform) {
  console.log(`📦 Creating package for ${platform}...`);
  
  const packageName = `EverydayTechAgent-v2-${version}-${platform}`;
  const packagePath = path.join(packageDir, `${packageName}.zip`);
  
  // Create archive
  const output = fs.createWriteStream(packagePath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  archive.pipe(output);
  
  // Add core agent binary
  const agentBinary = `EverydayTechAgent-v2${platform === 'win32' ? '.exe' : ''}`;
  const agentPath = path.join(distDir, agentBinary);
  
  if (fs.existsSync(agentPath)) {
    archive.file(agentPath, { name: `bin/${agentBinary}` });
  } else {
    console.warn(`⚠️  Agent binary not found: ${agentPath}`);
  }
  
  // Add helpers
  const helpersDir = path.join(distDir, 'helpers');
  if (fs.existsSync(helpersDir)) {
    const helperFiles = fs.readdirSync(helpersDir)
      .filter(file => file.includes(platform) || !file.includes('-'));
    
    for (const helperFile of helperFiles) {
      const helperPath = path.join(helpersDir, helperFile);
      archive.file(helperPath, { name: `helpers/${helperFile}` });
    }
  }
  
  // Add configuration files
  const configFiles = [
    'package.json',
    'README.md'
  ];
  
  for (const file of configFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: file });
    }
  }
  
  // Add installation scripts based on platform
  if (platform === 'win32') {
    // Add Windows installer script
    archive.append(`@echo off
:: Install EverydayTech Agent v2

echo Installing EverydayTech Agent v2...

:: Copy files
xcopy /Y /S bin\\* "C:\\Program Files\\EverydayTech\\Agent\\"
xcopy /Y /S helpers\\* "C:\\Program Files\\EverydayTech\\Agent\\helpers\\"

:: Install service
"C:\\Program Files\\EverydayTech\\Agent\\EverydayTechAgent-v2.exe" --install-service

:: Start service
net start "EverydayTech Agent v2"

echo Installation completed!
pause
`, { name: 'install.bat' });
  } else {
    // Add Unix installer script
    archive.append(`#!/bin/bash
# Install EverydayTech Agent v2

echo "Installing EverydayTech Agent v2..."

# Create directories
sudo mkdir -p /opt/everydaytech/agent
sudo mkdir -p /opt/everydaytech/agent/helpers

# Copy files
sudo cp bin/* /opt/everydaytech/agent/
sudo cp helpers/* /opt/everydaytech/agent/helpers/

# Make executable
sudo chmod +x /opt/everydaytech/agent/*
sudo chmod +x /opt/everydaytech/agent/helpers/*

# Install systemd service
sudo /opt/everydaytech/agent/EverydayTechAgent-v2 --install-service

# Start service
sudo systemctl start everydaytech-agent-v2
sudo systemctl enable everydaytech-agent-v2

echo "Installation completed!"
`, { name: 'install.sh' });
  }
  
  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const size = (fs.statSync(packagePath).size / 1024 / 1024).toFixed(2);
      console.log(`✅ Package created: ${packageName}.zip (${size}MB)`);
      resolve(packagePath);
    });
    
    archive.on('error', reject);
    archive.finalize();
  });
}

async function main() {
  console.log('📦 Creating distribution packages...');
  
  try {
    const packages = [];
    
    for (const platform of platforms) {
      const packagePath = await createPackage(platform);
      packages.push(packagePath);
    }
    
    console.log(`\n✅ All packages created successfully:`);
    packages.forEach(pkg => console.log(`  - ${path.basename(pkg)}`));
    
  } catch (error) {
    console.error('❌ Package creation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { createPackage };
