/**
 * Install Service Script - Installs Agent v2 as a system service
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ServiceInstaller {
  constructor() {
    this.platform = os.platform();
    this.serviceName = 'EverydayTech Agent v2';
    this.serviceId = 'everydaytech-agent-v2';
    this.executablePath = process.execPath;
    this.workingDirectory = path.dirname(this.executablePath);
  }
  
  async install() {
    console.log(`Installing ${this.serviceName} service...`);
    
    try {
      if (this.platform === 'win32') {
        await this.installWindowsService();
      } else {
        await this.installUnixService();
      }
      
      console.log('✅ Service installed successfully');
    } catch (error) {
      console.error('❌ Service installation failed:', error.message);
      process.exit(1);
    }
  }
  
  async installWindowsService() {
    const nodeService = require('node-windows').Service;
    
    const svc = new nodeService({
      name: this.serviceName,
      description: 'EverydayTech Agent v2 - RMM/PSA Platform Agent with Helper Architecture',
      script: path.join(this.workingDirectory, 'lib', 'start.js'),
      nodeOptions: ['--max-old-space-size=256'],
      env: {
        NODE_ENV: 'production'
      }
    });
    
    return new Promise((resolve, reject) => {
      svc.on('install', () => {
        console.log('Windows service installed');
        svc.start();
      });
      
      svc.on('start', () => {
        console.log('Service started');
        resolve();
      });
      
      svc.on('error', (error) => {
        reject(error);
      });
      
      svc.install();
    });
  }
  
  async installUnixService() {
    const serviceContent = this.generateSystemdService();
    const servicePath = `/etc/systemd/system/${this.serviceId}.service`;
    
    // Write service file
    fs.writeFileSync(servicePath, serviceContent);
    
    // Reload systemd and enable service
    execSync('systemctl daemon-reload');
    execSync(`systemctl enable ${this.serviceId}`);
    execSync(`systemctl start ${this.serviceId}`);
    
    console.log(`Unix service installed: ${servicePath}`);
  }
  
  generateSystemdService() {
    return `[Unit]
Description=EverydayTech Agent v2
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${this.workingDirectory}
ExecStart=${this.executablePath}
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;
  }
  
  async uninstall() {
    console.log(`Uninstalling ${this.serviceName} service...`);
    
    try {
      if (this.platform === 'win32') {
        await this.uninstallWindowsService();
      } else {
        await this.uninstallUnixService();
      }
      
      console.log('✅ Service uninstalled successfully');
    } catch (error) {
      console.error('❌ Service uninstallation failed:', error.message);
      process.exit(1);
    }
  }
  
  async uninstallWindowsService() {
    const nodeService = require('node-windows').Service;
    
    const svc = new nodeService({
      name: this.serviceName,
      script: path.join(this.workingDirectory, 'lib', 'start.js')
    });
    
    return new Promise((resolve, reject) => {
      svc.on('uninstall', () => {
        console.log('Windows service uninstalled');
        resolve();
      });
      
      svc.on('error', (error) => {
        reject(error);
      });
      
      svc.uninstall();
    });
  }
  
  async uninstallUnixService() {
    const servicePath = `/etc/systemd/system/${this.serviceId}.service`;
    
    // Stop and disable service
    try {
      execSync(`systemctl stop ${this.serviceId}`);
      execSync(`systemctl disable ${this.serviceId}`);
    } catch (e) {
      // Service might not be running
    }
    
    // Remove service file
    if (fs.existsSync(servicePath)) {
      fs.unlinkSync(servicePath);
    }
    
    // Reload systemd
    execSync('systemctl daemon-reload');
    
    console.log('Unix service uninstalled');
  }
}

// Command line interface
async function main() {
  const installer = new ServiceInstaller();
  const action = process.argv[2] || 'install';
  
  switch (action) {
    case 'install':
      await installer.install();
      break;
    case 'uninstall':
      await installer.uninstall();
      break;
    default:
      console.log('Usage: node install-service.js [install|uninstall]');
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Service operation failed:', error);
    process.exit(1);
  });
}

module.exports = { ServiceInstaller };
