/**
 * Service Installer - Handles service installation for packaged executable
 */

const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

class ServiceInstaller {
  constructor() {
    this.platform = os.platform();
    this.serviceName = 'EverydayTech Agent v2';
    this.serviceId = 'everydaytech-agent-v2';
    // When packaged with pkg, process.execPath points to the .exe
    this.executablePath = process.execPath;
    this.workingDirectory = path.dirname(this.executablePath);
  }
  
  async install() {
    console.log(`Installing ${this.serviceName} service...`);
    console.log(`Executable: ${this.executablePath}`);
    console.log(`Working directory: ${this.workingDirectory}`);
    
    try {
      if (this.platform === 'win32') {
        await this.installWindowsService();
      } else {
        await this.installUnixService();
      }
      
      console.log('✅ Service installed successfully');
    } catch (error) {
      console.error('❌ Service installation failed:', error.message);
      throw error;
    }
  }
  
  async installWindowsService() {
    const Service = require('node-windows').Service;
    
    const svc = new Service({
      name: this.serviceName,
      description: 'EverydayTech Agent v2 - RMM/PSA Platform Agent with Helper Architecture',
      script: this.executablePath,
      env: [{
        name: 'NODE_ENV',
        value: 'production'
      }],
      workingDirectory: this.workingDirectory,
      maxRetries: 3,
      maxRestarts: 5,
      wait: 2,
      grow: 0.5
    });
    
    return new Promise((resolve, reject) => {
      svc.on('install', () => {
        console.log('Windows service installed. Starting...');
        svc.start();
      });
      
      svc.on('alreadyinstalled', () => {
        console.log('Service already installed');
        resolve();
      });
      
      svc.on('start', () => {
        console.log('Service started successfully');
        resolve();
      });
      
      svc.on('error', (error) => {
        console.error('Service error:', error);
        reject(error);
      });
      
      console.log('Installing Windows service wrapper...');
      svc.install();
    });
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
      throw error;
    }
  }
  
  async uninstallWindowsService() {
    const Service = require('node-windows').Service;
    
    const svc = new Service({
      name: this.serviceName,
      script: this.executablePath
    });
    
    return new Promise((resolve, reject) => {
      svc.on('uninstall', () => {
        console.log('Service uninstalled');
        resolve();
      });
      
      svc.on('alreadyuninstalled', () => {
        console.log('Service was not installed');
        resolve();
      });
      
      svc.on('error', (error) => {
        reject(error);
      });
      
      svc.uninstall();
    });
  }
  
  async installUnixService() {
    const serviceContent = this.generateSystemdService();
    const servicePath = `/etc/systemd/system/${this.serviceId}.service`;
    
    // Write service file (requires root)
    require('fs').writeFileSync(servicePath, serviceContent);
    
    // Reload systemd and enable service
    execSync('systemctl daemon-reload');
    execSync(`systemctl enable ${this.serviceId}`);
    execSync(`systemctl start ${this.serviceId}`);
    
    console.log(`Unix service installed: ${servicePath}`);
  }
  
  async uninstallUnixService() {
    const servicePath = `/etc/systemd/system/${this.serviceId}.service`;
    
    // Stop and disable service
    execSync(`systemctl stop ${this.serviceId}`, { stdio: 'ignore' });
    execSync(`systemctl disable ${this.serviceId}`, { stdio: 'ignore' });
    
    // Remove service file
    if (require('fs').existsSync(servicePath)) {
      require('fs').unlinkSync(servicePath);
    }
    
    execSync('systemctl daemon-reload');
    console.log('Unix service uninstalled');
  }
  
  generateSystemdService() {
    return `[Unit]
Description=${this.serviceName}
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
}

module.exports = { ServiceInstaller };
