/**
 * RDP Helper v2 - Elevated executable for Remote Desktop configuration
 * 
 * This helper runs with elevated privileges to configure Windows RDP
 * for use with Guacamole and other remote desktop systems.
 * 
 * Usage: rdp-helper-v2 [enable|disable|status|test|configure] [options]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class RDPHelperV2 {
  constructor() {
    this.platform = os.platform();
    this.logFile = this.getLogPath();
    this.version = '2.0.0';
    
    this.ensureLogDir();
    this.log(`RDP Helper v${this.version} started`);
  }
  
  getLogPath() {
    if (this.platform === 'win32') {
      return 'C:\\ProgramData\\EverydayTech\\logs\\rdp-helper.log';
    } else {
      return '/var/log/everydaytech/rdp-helper.log';
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
      // If we can't write to log file, continue silently
    }
    
    console.log(message);
  }
  
  async enable(options = {}) {
    if (this.platform !== 'win32') {
      return this.error('RDP is only supported on Windows');
    }
    
    try {
      this.log('Starting RDP enablement process...');
      
      // Step 1: Check current status
      const currentStatus = await this.getStatus();
      if (currentStatus.enabled && currentStatus.serviceRunning && currentStatus.portOpen) {
        this.log('RDP already enabled and working');
        return this.success('RDP already enabled', currentStatus);
      }
      
      // Step 2: Enable Remote Desktop via registry
      this.log('Enabling RDP in registry...');
      this.executeCommand(
        'reg add "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f'
      );
      
      // Step 3: Start Terminal Services
      this.log('Starting Terminal Services...');
      try {
        this.executeCommand('net start TermService');
      } catch (error) {
        // Service might already be running
        if (!error.message.includes('already')) {
          throw error;
        }
      }
      
      // Step 4: Enable firewall rules
      this.log('Enabling firewall rules...');
      this.executeCommand('netsh advfirewall firewall set rule group="remote desktop" new enable=Yes');
      
      // Step 5: Configure for Guacamole compatibility (if requested)
      if (options.configureForGuacamole !== false) {
        await this.configure({ guacamole: true });
      }
      
      // Step 6: Verify enablement
      await this.sleep(2000); // Allow services to start
      const finalStatus = await this.getStatus();
      
      if (finalStatus.enabled && finalStatus.serviceRunning) {
        this.log('✅ RDP successfully enabled');
        return this.success('RDP enabled successfully', finalStatus);
      } else {
        throw new Error('RDP enablement verification failed');
      }
      
    } catch (error) {
      this.log(`❌ Failed to enable RDP: ${error.message}`);
      return this.error(`Failed to enable RDP: ${error.message}`);
    }
  }
  
  async disable() {
    if (this.platform !== 'win32') {
      return this.error('RDP is only supported on Windows');
    }
    
    try {
      this.log('Disabling RDP...');
      
      // Disable Remote Desktop via registry
      this.executeCommand(
        'reg add "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 1 /f'
      );
      
      // Disable firewall rules
      this.executeCommand('netsh advfirewall firewall set rule group="remote desktop" new enable=No');
      
      this.log('✅ RDP disabled');
      return this.success('RDP disabled successfully');
      
    } catch (error) {
      this.log(`❌ Failed to disable RDP: ${error.message}`);
      return this.error(`Failed to disable RDP: ${error.message}`);
    }
  }
  
  async getStatus() {
    if (this.platform !== 'win32') {
      return this.error('RDP is only supported on Windows');
    }
    
    try {
      const status = {
        platform: this.platform,
        enabled: false,
        serviceRunning: false,
        serviceStatus: 'unknown',
        firewallEnabled: false,
        portOpen: false,
        port: 3389,
        protocol: 'rdp',
        ready: false,
        configuration: {}
      };
      
      // Check registry setting
      try {
        const regOutput = this.executeCommand(
          'reg query "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" /v fDenyTSConnections'
        );
        status.enabled = regOutput.includes('0x0');
      } catch (e) {
        this.log(`Registry check failed: ${e.message}`);
      }
      
      // Check service status
      try {
        const serviceOutput = this.executeCommand('sc query TermService');
        status.serviceRunning = serviceOutput.includes('RUNNING');
        status.serviceStatus = serviceOutput.includes('RUNNING') ? 'running' : 
                            serviceOutput.includes('STOPPED') ? 'stopped' : 'unknown';
      } catch (e) {
        this.log(`Service check failed: ${e.message}`);
      }
      
      // Check firewall status
      try {
        const firewallOutput = this.executeCommand('netsh advfirewall firewall show rule name="Remote Desktop"');
        status.firewallEnabled = firewallOutput.includes('Enabled:                              Yes');
      } catch (e) {
        this.log(`Firewall check failed: ${e.message}`);
      }
      
      // Test port accessibility
      try {
        this.executeCommand('netstat -an | findstr ":3389.*LISTENING"');
        status.portOpen = true;
      } catch (e) {
        status.portOpen = false;
      }
      
      // Check configuration
      status.configuration = await this.getConfiguration();
      
      // Determine if ready
      status.ready = status.enabled && status.serviceRunning && status.portOpen;
      
      this.log(`RDP Status: ${JSON.stringify(status, null, 2)}`);
      return this.success('Status retrieved', status);
      
    } catch (error) {
      this.log(`❌ Failed to get RDP status: ${error.message}`);
      return this.error(`Failed to get status: ${error.message}`);
    }
  }
  
  async configure(options = {}) {
    if (this.platform !== 'win32') {
      return this.error('RDP configuration is only supported on Windows');
    }
    
    try {
      this.log('Configuring RDP settings...');
      
      const configs = [];
      
      if (options.guacamole) {
        this.log('Applying Guacamole-optimized settings...');
        
        // Disable Network Level Authentication (for older clients)
        configs.push({
          key: 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp',
          value: 'UserAuthentication',
          type: 'REG_DWORD',
          data: '0',
          description: 'Disable NLA for compatibility'
        });
        
        // Set security layer to RDP
        configs.push({
          key: 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp',
          value: 'SecurityLayer',
          type: 'REG_DWORD', 
          data: '0',
          description: 'Use RDP security layer'
        });
        
        // Allow multiple sessions per user
        configs.push({
          key: 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server',
          value: 'fSingleSessionPerUser',
          type: 'REG_DWORD',
          data: '0',
          description: 'Allow multiple sessions per user'
        });
      }
      
      if (options.security === 'relaxed') {
        // Allow blank passwords (for testing)
        configs.push({
          key: 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Lsa',
          value: 'LimitBlankPasswordUse',
          type: 'REG_DWORD',
          data: '0',
          description: 'Allow blank passwords'
        });
        
        // Disable password complexity
        configs.push({
          key: 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp',
          value: 'fPromptForPassword',
          type: 'REG_DWORD',
          data: '0',
          description: 'Disable password prompts'
        });
      }
      
      // Apply configurations
      for (const config of configs) {
        try {
          this.log(`Setting: ${config.description}`);
          this.executeCommand(`reg add "${config.key}" /v ${config.value} /t ${config.type} /d ${config.data} /f`);
        } catch (error) {
          this.log(`⚠️ Configuration warning: ${config.description} - ${error.message}`);
        }
      }
      
      this.log('✅ RDP configuration completed');
      return this.success('RDP configured successfully', { applied: configs.length });
      
    } catch (error) {
      this.log(`❌ Failed to configure RDP: ${error.message}`);
      return this.error(`Configuration failed: ${error.message}`);
    }
  }
  
  async test() {
    if (this.platform !== 'win32') {
      return this.error('RDP testing is only supported on Windows');
    }
    
    try {
      this.log('Testing RDP connection...');
      
      const tests = [];
      
      // Test 1: Port listening
      try {
        this.executeCommand('netstat -an | findstr ":3389.*LISTENING"');
        tests.push({ name: 'Port 3389 listening', status: 'pass' });
      } catch {
        tests.push({ name: 'Port 3389 listening', status: 'fail' });
      }
      
      // Test 2: Service running
      try {
        const serviceOutput = this.executeCommand('sc query TermService');
        if (serviceOutput.includes('RUNNING')) {
          tests.push({ name: 'TermService running', status: 'pass' });
        } else {
          tests.push({ name: 'TermService running', status: 'fail' });
        }
      } catch {
        tests.push({ name: 'TermService running', status: 'fail' });
      }
      
      // Test 3: PowerShell connection test
      try {
        this.executeCommand('powershell -Command "Test-NetConnection -ComputerName localhost -Port 3389 -WarningAction SilentlyContinue"');
        tests.push({ name: 'Network connectivity', status: 'pass' });
      } catch {
        tests.push({ name: 'Network connectivity', status: 'fail' });
      }
      
      const passed = tests.filter(t => t.status === 'pass').length;
      const total = tests.length;
      
      this.log(`Connection test results: ${passed}/${total} tests passed`);
      
      if (passed === total) {
        return this.success('All RDP tests passed', { tests, score: `${passed}/${total}` });
      } else {
        return this.error('Some RDP tests failed', { tests, score: `${passed}/${total}` });
      }
      
    } catch (error) {
      this.log(`❌ RDP connection test failed: ${error.message}`);
      return this.error(`Connection test failed: ${error.message}`);
    }
  }
  
  async getConfiguration() {
    const config = {};
    
    try {
      // Get various RDP configuration values
      const settings = [
        { key: 'Terminal Server', value: 'fDenyTSConnections', name: 'enabled' },
        { key: 'Terminal Server\\WinStations\\RDP-Tcp', value: 'UserAuthentication', name: 'nla' },
        { key: 'Terminal Server\\WinStations\\RDP-Tcp', value: 'SecurityLayer', name: 'securityLayer' },
        { key: 'Terminal Server', value: 'fSingleSessionPerUser', name: 'singleSession' }
      ];
      
      for (const setting of settings) {
        try {
          const output = this.executeCommand(
            `reg query "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\${setting.key}" /v ${setting.value}`
          );
          
          if (output.includes('0x0')) {
            config[setting.name] = false;
          } else if (output.includes('0x1')) {
            config[setting.name] = true;
          }
        } catch (e) {
          config[setting.name] = 'unknown';
        }
      }
    } catch (error) {
      this.log(`Configuration retrieval failed: ${error.message}`);
    }
    
    return config;
  }
  
  executeCommand(command) {
    try {
      return execSync(command, { encoding: 'utf8', timeout: 15000 });
    } catch (error) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }
  
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
  const helper = new RDPHelperV2();
  const command = process.argv[2] || 'status';
  const options = {};
  
  // Parse additional arguments
  for (let i = 3; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--guacamole') {
      options.configureForGuacamole = true;
    } else if (arg === '--security=relaxed') {
      options.security = 'relaxed';
    }
  }
  
  let result;
  
  switch (command) {
    case 'enable':
      result = await helper.enable(options);
      break;
    case 'disable':
      result = await helper.disable();
      break;
    case 'status':
      result = await helper.getStatus();
      break;
    case 'configure':
      result = await helper.configure(options);
      break;
    case 'test':
      result = await helper.test();
      break;
    case '--version':
      result = helper.success(`RDP Helper v${helper.version}`);
      break;
    default:
      console.log('Usage: rdp-helper-v2 [enable|disable|status|configure|test] [--guacamole] [--security=relaxed]');
      process.exit(1);
  }
  
  // Output result as JSON
  console.log(JSON.stringify(result, null, 2));
  
  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Export for testing
module.exports = RDPHelperV2;

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