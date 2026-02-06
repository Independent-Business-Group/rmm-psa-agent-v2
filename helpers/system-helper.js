/**
 * System Helper v2 - Elevated executable for system operations
 * 
 * Handles registry modifications, service management, and other
 * system-level operations that require elevated privileges.
 * 
 * Usage: system-helper [action] [parameters]
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class SystemHelperV2 {
  constructor() {
    this.platform = os.platform();
    this.version = '2.0.0';
    this.logFile = this.getLogPath();
    
    this.ensureLogDir();
    this.log(`System Helper v${this.version} started`);
  }
  
  getLogPath() {
    if (this.platform === 'win32') {
      return 'C:\\ProgramData\\EverydayTech\\logs\\system-helper.log';
    } else {
      return '/var/log/everydaytech/system-helper.log';
    }
  }
  
  ensureLogDir() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }
  
  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (e) {
      // Continue silently if logging fails
    }
    
    console.log(message);
  }
  
  async executeCommand(command, options = {}) {
    this.log(`Executing: ${command}`);
    
    try {
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: options.timeout || 30000,
        ...options
      });
      
      return this.success('Command executed successfully', { output: output.trim() });
    } catch (error) {
      this.log(`Command failed: ${error.message}`);
      return this.error(`Command failed: ${error.message}`);
    }
  }
  
  async getSystemInfo() {
    try {
      const info = {
        platform: this.platform,
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        memory: {
          total: os.totalmem(),
          free: os.freemem()
        },
        cpus: os.cpus().length,
        networkInterfaces: Object.keys(os.networkInterfaces())
      };
      
      if (this.platform === 'win32') {
        // Get Windows-specific information
        try {
          const versionOutput = this.executeCommandSync('ver');
          info.osVersion = versionOutput.trim();
        } catch (e) {
          info.osVersion = 'unknown';
        }
        
        try {
          const serviceOutput = this.executeCommandSync('sc query state= all');
          info.serviceCount = (serviceOutput.match(/SERVICE_NAME:/g) || []).length;
        } catch (e) {
          info.serviceCount = 0;
        }
      }
      
      return this.success('System information collected', info);
    } catch (error) {
      return this.error(`Failed to collect system info: ${error.message}`);
    }
  }
  
  async manageService(action, serviceName) {
    if (this.platform !== 'win32') {
      return this.error('Service management is only supported on Windows');
    }
    
    try {
      let command;
      switch (action) {
        case 'start':
          command = `net start "${serviceName}"`;
          break;
        case 'stop':
          command = `net stop "${serviceName}"`;
          break;
        case 'restart':
          command = `net stop "${serviceName}" && net start "${serviceName}"`;
          break;
        case 'status':
          command = `sc query "${serviceName}"`;
          break;
        default:
          return this.error(`Unknown service action: ${action}`);
      }
      
      const output = this.executeCommandSync(command);
      return this.success(`Service ${action} completed`, { output: output.trim() });
    } catch (error) {
      return this.error(`Service ${action} failed: ${error.message}`);
    }
  }
  
  async setRegistryValue(keyPath, valueName, valueType, valueData) {
    if (this.platform !== 'win32') {
      return this.error('Registry operations are only supported on Windows');
    }
    
    try {
      const command = `reg add "${keyPath}" /v ${valueName} /t ${valueType} /d ${valueData} /f`;
      const output = this.executeCommandSync(command);
      
      this.log(`Registry value set: ${keyPath}\\${valueName} = ${valueData}`);
      return this.success('Registry value set successfully', { 
        keyPath, 
        valueName, 
        valueType, 
        valueData 
      });
    } catch (error) {
      return this.error(`Registry operation failed: ${error.message}`);
    }
  }
  
  async getRegistryValue(keyPath, valueName) {
    if (this.platform !== 'win32') {
      return this.error('Registry operations are only supported on Windows');
    }
    
    try {
      const command = `reg query "${keyPath}" /v ${valueName}`;
      const output = this.executeCommandSync(command);
      
      // Parse the registry value from output
      const lines = output.split('\n');
      const valueLine = lines.find(line => line.trim().startsWith(valueName));
      
      if (valueLine) {
        const parts = valueLine.trim().split(/\s+/);
        const value = parts.slice(2).join(' ');
        
        return this.success('Registry value retrieved', {
          keyPath,
          valueName,
          value
        });
      } else {
        return this.error('Registry value not found');
      }
    } catch (error) {
      return this.error(`Registry query failed: ${error.message}`);
    }
  }
  
  async enableWindowsFeature(featureName) {
    if (this.platform !== 'win32') {
      return this.error('Windows features are only supported on Windows');
    }
    
    try {
      const command = `dism /online /enable-feature /featurename:${featureName} /all /norestart`;
      const output = this.executeCommandSync(command);
      
      return this.success(`Windows feature ${featureName} enabled`, { output: output.trim() });
    } catch (error) {
      return this.error(`Failed to enable Windows feature: ${error.message}`);
    }
  }
  
  async installSoftware(installerPath, args = []) {
    try {
      if (!fs.existsSync(installerPath)) {
        return this.error(`Installer not found: ${installerPath}`);
      }
      
      const command = `"${installerPath}" ${args.join(' ')}`;
      const output = this.executeCommandSync(command);
      
      return this.success('Software installation completed', { output: output.trim() });
    } catch (error) {
      return this.error(`Software installation failed: ${error.message}`);
    }
  }
  
  async getInstalledSoftware() {
    try {
      let software = [];
      
      if (this.platform === 'win32') {
        // Get software from Windows registry
        const command = 'powershell -Command "Get-WmiObject -Class Win32_Product | Select-Object Name, Version, Vendor | ConvertTo-Json"';
        const output = this.executeCommandSync(command);
        
        try {
          software = JSON.parse(output);
          if (!Array.isArray(software)) {
            software = [software];
          }
        } catch (e) {
          software = [];
        }
      } else if (this.platform === 'linux') {
        // Get software from package managers
        try {
          const dpkgOutput = this.executeCommandSync('dpkg -l');
          // Parse dpkg output...
        } catch (e) {
          // Try other package managers
        }
      }
      
      return this.success('Installed software retrieved', { software, count: software.length });
    } catch (error) {
      return this.error(`Failed to get installed software: ${error.message}`);
    }
  }
  
  executeCommandSync(command, options = {}) {
    return execSync(command, {
      encoding: 'utf8',
      timeout: 30000,
      ...options
    });
  }
  
  success(message, data = null) {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      version: this.version
    };
  }
  
  error(message, data = null) {
    return {
      success: false,
      error: message,
      data,
      timestamp: new Date().toISOString(),
      version: this.version
    };
  }
}

// Command Line Interface
async function main() {
  const helper = new SystemHelperV2();
  const action = process.argv[2] || 'info';
  
  let result;
  
  switch (action) {
    case 'info':
      result = await helper.getSystemInfo();
      break;
    case 'exec':
      const command = process.argv.slice(3).join(' ');
      result = await helper.executeCommand(command);
      break;
    case 'service':
      const serviceAction = process.argv[3];
      const serviceName = process.argv[4];
      result = await helper.manageService(serviceAction, serviceName);
      break;
    case 'registry-set':
      result = await helper.setRegistryValue(
        process.argv[3], // keyPath
        process.argv[4], // valueName
        process.argv[5], // valueType
        process.argv[6]  // valueData
      );
      break;
    case 'registry-get':
      result = await helper.getRegistryValue(
        process.argv[3], // keyPath
        process.argv[4]  // valueName
      );
      break;
    case 'feature':
      result = await helper.enableWindowsFeature(process.argv[3]);
      break;
    case 'software-list':
      result = await helper.getInstalledSoftware();
      break;
    case '--version':
      result = helper.success(`System Helper v${helper.version}`);
      break;
    default:
      console.log('Usage: system-helper [info|exec|service|registry-set|registry-get|feature|software-list]');
      process.exit(1);
  }
  
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

// Export for testing
module.exports = SystemHelperV2;

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2));
    process.exit(1);
  });
}